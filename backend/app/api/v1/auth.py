import secrets
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import (
    DeleteMeRequest,
    LoginRequest,
    ProfileUpdateRequest,
    RefreshRequest,
    SignupRequest,
    SocialLoginRequest,
    SocialProvider,
    TokenResponse,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue_tokens(user_id: int) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    exists = db.scalar(
        select(User).where((User.username == payload.username) | (User.email == payload.email))
    )
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 사용 중인 아이디 또는 이메일입니다.",
        )

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        email=payload.email,
        birth_date=payload.birth_date,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _issue_tokens(user.id)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalar(select(User).where(User.username == payload.username))
    if user is None or user.password_hash is None or not verify_password(
        payload.password, user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다.",
        )
    return _issue_tokens(user.id)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> TokenResponse:
    try:
        decoded = decode_token(payload.refresh_token, expected_type="refresh")
        user_id = int(decoded["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 리프레시 토큰입니다.",
        )

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 리프레시 토큰입니다.",
        )
    return _issue_tokens(user.id)


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserResponse)
def patch_me(
    payload: ProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """이메일 / 비밀번호 변경. 소셜 로그인 사용자는 비밀번호 변경 불가."""
    is_social = current_user.social_provider is not None

    # 1) 이메일 변경
    if payload.email and payload.email != current_user.email:
        dup = db.scalar(
            select(User).where(User.email == payload.email, User.id != current_user.id)
        )
        if dup is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="이미 사용 중인 이메일입니다.",
            )
        current_user.email = payload.email

    # 2) 비밀번호 변경
    if payload.new_password is not None:
        if is_social:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.",
            )
        if not payload.current_password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="현재 비밀번호를 입력해 주세요.",
            )
        if current_user.password_hash is None or not verify_password(
            payload.current_password, current_user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="현재 비밀번호가 올바르지 않습니다.",
            )
        current_user.password_hash = hash_password(payload.new_password)

    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/me", status_code=status.HTTP_200_OK)
def delete_me(
    payload: DeleteMeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """회원 탈퇴 — 실제 삭제 대신 is_active=False 로 비활성화."""
    is_social = current_user.social_provider is not None
    if not is_social:
        if not payload.password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="비밀번호 확인이 필요합니다.",
            )
        if current_user.password_hash is None or not verify_password(
            payload.password, current_user.password_hash
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="비밀번호가 올바르지 않습니다.",
            )

    current_user.is_active = False
    db.commit()
    return {"detail": "탈퇴가 완료되었습니다."}


# ---------- 소셜 로그인 (B-flow: 백엔드 주도) --------------------------------
# 인가 → 토큰 교환 → 프로필 조회 → find-or-create + JWT 발급 흐름.
# CORS 우회를 위해 callback 은 fragment(#) 로 토큰을 전달 (서버에 노출 X).


def _social_redirect_uri(provider: str) -> str:
    """provider 별 callback 절대 URL — 각 OAuth 콘솔에 정확히 동일하게 등록 필요."""
    return (
        f"{settings.BACKEND_BASE_URL}{settings.API_V1_PREFIX}"
        f"/auth/social/{provider}/callback"
    )


# Provider 별 OAuth 엔드포인트 + 프로필 파싱.
# (production 에서는 state CSRF 토큰 + nonce 검증을 추가해야 함 — 현재는 스캐폴딩.)
PROVIDER_CONFIG: dict[str, dict] = {
    "kakao": {
        "auth": "https://kauth.kakao.com/oauth/authorize",
        "token": "https://kauth.kakao.com/oauth/token",
        "user": "https://kapi.kakao.com/v2/user/me",
        "scope": "account_email,profile_nickname",
    },
    "naver": {
        "auth": "https://nid.naver.com/oauth2.0/authorize",
        "token": "https://nid.naver.com/oauth2.0/token",
        "user": "https://openapi.naver.com/v1/nid/me",
        "scope": "",
    },
    "google": {
        "auth": "https://accounts.google.com/o/oauth2/v2/auth",
        "token": "https://oauth2.googleapis.com/token",
        "user": "https://www.googleapis.com/oauth2/v2/userinfo",
        "scope": "openid email profile",
    },
}


def _provider_keys(provider: str) -> tuple[str | None, str | None]:
    if provider == "kakao":
        return settings.KAKAO_CLIENT_ID, settings.KAKAO_CLIENT_SECRET
    if provider == "naver":
        return settings.NAVER_CLIENT_ID, settings.NAVER_CLIENT_SECRET
    if provider == "google":
        return settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET
    return None, None


def _frontend_redirect(path: str, **params: str) -> RedirectResponse:
    qs = ("?" + urlencode(params)) if params else ""
    return RedirectResponse(
        url=f"{settings.FRONTEND_BASE_URL}{path}{qs}",
        status_code=status.HTTP_302_FOUND,
    )


def _unique_username_from(db: Session, email: str) -> str:
    base = email.split("@", 1)[0][:20] or "user"
    candidate = base
    n = 1
    while db.scalar(select(User).where(User.username == candidate)):
        n += 1
        candidate = f"{base}{n}"
    return candidate


def _find_or_create_social_user(
    db: Session, provider: SocialProvider, provider_id: str, email: str
) -> User:
    # 1) 동일 (provider, provider_id) 존재 → 기존 유저 반환
    user = db.scalar(
        select(User).where(
            User.social_provider == provider,
            User.social_id == provider_id,
        )
    )
    if user is not None:
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="비활성화된 계정입니다.",
            )
        return user

    # 2) 같은 이메일이 다른 방식으로 가입돼 있으면 충돌
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "이미 가입된 이메일입니다. 기존 로그인 방식으로 로그인 후 "
                "마이페이지에서 소셜 계정을 연결해 주세요."
            ),
        )

    # 3) 신규 생성
    new_user = User(
        username=_unique_username_from(db, email),
        password_hash=None,
        email=email,
        birth_date=None,
        social_provider=provider,
        social_id=provider_id,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.get("/social/{provider}/login")
def social_login(provider: SocialProvider, request: Request) -> RedirectResponse:
    """provider OAuth 인가 페이지로 리다이렉트.
    환경변수 미설정이면 프론트 /login 으로 에러 안내와 함께 되돌림."""
    cfg = PROVIDER_CONFIG.get(provider)
    if cfg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="지원하지 않는 provider")
    client_id, _ = _provider_keys(provider)
    if not client_id:
        return _frontend_redirect(
            "/login", social_error="not_configured", provider=provider
        )

    # 간단 state 토큰 — 콜백에서 검증할 수 있도록 cookie 로 함께 발급
    state = secrets.token_urlsafe(16)
    params = {
        "client_id": client_id,
        "redirect_uri": _social_redirect_uri(provider),
        "response_type": "code",
        "state": state,
    }
    if cfg.get("scope"):
        params["scope"] = cfg["scope"]

    response = RedirectResponse(
        url=f"{cfg['auth']}?{urlencode(params)}",
        status_code=status.HTTP_302_FOUND,
    )
    # secure flag 는 production HTTPS 환경에서만. 로컬 dev 호환을 위해 일단 미적용.
    response.set_cookie(
        key=f"oauth_state_{provider}",
        value=state,
        max_age=600,
        httponly=True,
        samesite="lax",
    )
    return response


def _exchange_token(
    provider: str, code: str, client_id: str, client_secret: str
) -> str:
    cfg = PROVIDER_CONFIG[provider]
    data = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "redirect_uri": _social_redirect_uri(provider),
    }
    res = httpx.post(cfg["token"], data=data, timeout=10.0)
    if res.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{provider} 토큰 교환 실패: {res.text[:120]}",
        )
    body = res.json()
    access = body.get("access_token")
    if not access:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{provider} access_token 누락",
        )
    return access


def _fetch_profile(provider: str, access_token: str) -> tuple[str, str, str]:
    """provider 사용자 프로필 조회 → (provider_id, email, name).
    이메일 권한이 없는 계정은 가입 거부.
    """
    cfg = PROVIDER_CONFIG[provider]
    res = httpx.get(
        cfg["user"],
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10.0,
    )
    if res.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"{provider} 프로필 조회 실패",
        )
    data = res.json()

    if provider == "kakao":
        pid = str(data.get("id", ""))
        acc = data.get("kakao_account", {}) or {}
        email = acc.get("email") or ""
        prof = acc.get("profile", {}) or {}
        name = prof.get("nickname") or email.split("@", 1)[0]
    elif provider == "naver":
        # naver 응답: { resultcode, message, response: { id, email, name, ... } }
        r = data.get("response", {}) or {}
        pid = str(r.get("id", ""))
        email = r.get("email") or ""
        name = r.get("name") or r.get("nickname") or (
            email.split("@", 1)[0] if email else "naver_user"
        )
    else:  # google
        pid = str(data.get("id", ""))
        email = data.get("email") or ""
        name = data.get("name") or (email.split("@", 1)[0] if email else "google_user")

    if not pid or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"{provider} 프로필에서 id/이메일을 가져오지 못했습니다. "
                "이메일 제공 동의가 필요합니다."
            ),
        )
    return pid, email, name


@router.get("/social/{provider}/callback")
def social_callback(
    provider: SocialProvider,
    request: Request,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> RedirectResponse:
    """provider 콜백 — 토큰 교환 + 유저 find-or-create + JWT fragment 로 전달.

    토큰을 URL fragment 에 담아 SPA 가 location.hash 로 읽고 즉시 history 에서
    제거하도록 한다 (브라우저 referer/서버 로그 노출 회피).
    """
    if error:
        return _frontend_redirect("/login", social_error=error, provider=provider)

    cfg = PROVIDER_CONFIG.get(provider)
    if cfg is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="지원하지 않는 provider")
    client_id, client_secret = _provider_keys(provider)
    if not client_id or not client_secret:
        return _frontend_redirect(
            "/login", social_error="not_configured", provider=provider
        )
    if not code:
        return _frontend_redirect("/login", social_error="missing_code", provider=provider)

    # state 검증 (cookie 와 일치해야 함)
    cookie_state = request.cookies.get(f"oauth_state_{provider}")
    if not state or not cookie_state or state != cookie_state:
        return _frontend_redirect(
            "/login", social_error="invalid_state", provider=provider
        )

    try:
        access = _exchange_token(provider, code, client_id, client_secret)
        pid, email, _name = _fetch_profile(provider, access)
        user = _find_or_create_social_user(db, provider, pid, email)
    except HTTPException as exc:
        # JSON 을 브라우저에 그대로 노출하지 않고 프런트 /login 으로 친절하게 redirect.
        msg = exc.detail if isinstance(exc.detail, str) else "소셜 로그인에 실패했습니다."
        return _frontend_redirect(
            "/login", social_error="fail", provider=provider, social_message=msg
        )

    tokens = _issue_tokens(user.id)

    # 토큰을 fragment 로 넘김 — SPA 가 hash 에서 꺼내고 location.replace 로 정리.
    redirect = RedirectResponse(
        url=(
            f"{settings.FRONTEND_BASE_URL}/social-callback"
            f"#access_token={tokens.access_token}"
            f"&refresh_token={tokens.refresh_token}"
        ),
        status_code=status.HTTP_302_FOUND,
    )
    redirect.delete_cookie(f"oauth_state_{provider}")
    return redirect


@router.post("/social", response_model=TokenResponse)
def social_login_internal(
    payload: SocialLoginRequest, db: Session = Depends(get_db)
) -> TokenResponse:
    """find-or-create + JWT 발급. callback 외부에서 (예: 테스트 / 다른 SDK 통합)
    에서도 같은 로직을 호출할 수 있도록 노출."""
    user = _find_or_create_social_user(
        db, payload.provider, payload.provider_id, payload.email
    )
    return _issue_tokens(user.id)

