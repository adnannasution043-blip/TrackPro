from pydantic import BaseModel, EmailStr, field_validator


class RegisterRequest(BaseModel):
    nama: str
    email: EmailStr
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def username_alfanumerik(cls, v: str) -> str:
        v = v.strip()
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username hanya boleh huruf, angka, underscore, dan strip.")
        if len(v) < 3:
            raise ValueError("Username minimal 3 karakter.")
        return v

    @field_validator("password")
    @classmethod
    def password_cukup_panjang(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password minimal 8 karakter.")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    nama: str
    email: str
    username: str
    role: str
    status_akun: str

    model_config = {"from_attributes": True}
