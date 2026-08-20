from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.scheduler import start_scheduler, stop_scheduler
from app.routers import accounts, auth, balance, clicks, csv_upload, dashboard, export_excel, meta_oauth, meta_sync, orders, taglink


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="AdCommTrack API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])
app.include_router(csv_upload.router, prefix="/api/upload", tags=["upload"])
app.include_router(taglink.router, prefix="/api/taglink", tags=["taglink"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(orders.router, prefix="/api/orders", tags=["orders"])
app.include_router(clicks.router, prefix="/api/clicks", tags=["clicks"])
app.include_router(balance.router, prefix="/api/balance", tags=["balance"])
app.include_router(export_excel.router, prefix="/api/export", tags=["export"])
app.include_router(meta_sync.router, prefix="/api/meta-sync", tags=["meta-sync"])
app.include_router(meta_oauth.router, prefix="/api/meta-oauth", tags=["meta-oauth"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve frontend — harus SETELAH semua API router
FRONTEND_DIR = Path(__file__).parent.parent.parent / "frontend"

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR / "static")), name="static")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        return FileResponse(str(FRONTEND_DIR / "index.html"))
