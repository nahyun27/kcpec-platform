from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import admin as admin_v1
from app.api.v1 import auth as auth_v1
from app.api.v1 import community as community_v1
from app.api.v1 import counseling as counseling_v1
from app.api.v1 import counseling_purchase as counseling_purchase_v1
from app.api.v1 import courses as courses_v1
from app.api.v1 import detention as detention_v1
from app.api.v1 import documents as documents_v1
from app.api.v1 import legal_letters as legal_letters_v1
from app.api.v1 import orders as orders_v1
from app.core.config import settings

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static (PDF/수료증 등)
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)


class _NoCacheStaticFiles(StaticFiles):
    """관리자가 같은 토큰(파일명)으로 덮어쓰는 finals/ 전용 — 반성문·탄원서,
    상담 의견서 최종 PDF 재업로드가 브라우저 캐시 때문에 곧바로 반영 안 된
    것처럼 보이는 문제를 막기 위해 캐시를 금지한다(2026-10)."""

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "no-store"
        return response


FINALS_DIR = STATIC_DIR / "finals"
FINALS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/finals", _NoCacheStaticFiles(directory=str(FINALS_DIR)), name="static-finals")
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

app.include_router(auth_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(courses_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(orders_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(documents_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(counseling_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(counseling_purchase_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(community_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(admin_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(detention_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(detention_v1.admin_router, prefix=settings.API_V1_PREFIX)
app.include_router(legal_letters_v1.router, prefix=settings.API_V1_PREFIX)
app.include_router(legal_letters_v1.admin_router, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
