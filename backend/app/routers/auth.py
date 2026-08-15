from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.core.deps import DB, CurrentUser
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.schemas.auth import ChangePasswordRequest, LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: DB):
    # Cek duplikat email / username
    existing = await db.execute(
        select(User).where((User.email == body.email) | (User.username == body.username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email atau username sudah dipakai.")

    user = User(
        nama=body.nama,
        email=body.email,
        username=body.username,
        password_hash=hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: DB):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Email atau password salah.")
    if user.status_akun != "aktif":
        raise HTTPException(status_code=403, detail="Akun dinonaktifkan. Hubungi admin.")

    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser):
    return current_user


@router.post("/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(body: ChangePasswordRequest, current_user: CurrentUser, db: DB):
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Password saat ini salah.")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=422, detail="Password minimal 8 karakter.")
    current_user.password_hash = hash_password(body.new_password)
    await db.commit()
