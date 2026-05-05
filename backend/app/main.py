from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import admin as admin_v1
from app.api.v1 import auth as auth_v1
from app.api.v1 import community as community_v1
from app.api.v1 import counseling as counseling_v1
from app.api.v1 import courses as courses_v1
from app.api.v1 import documents as documents_v1
from app.api.v1 import orders as orders_v1
from app.api.v1 import packages as packages_v1
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static (PDF/이수증 등)
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(auth_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(courses_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(packages_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(orders_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(documents_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(counseling_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(community_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin_v1.router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
