import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import httpx
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    Request,
    Response,
    status,
)
from fastapi.responses import RedirectResponse
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.cookies import clear_auth_cookies, get_refresh_token, set_auth_cookies
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.email import send_password_reset_email, send_verification_email
from app.core.rate_limit import client_ip, enforce_rate_limit
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.models.counseling import CounselingSurvey
from app.models.user import User
from app.schemas.auth import (
    DeleteMeRequest,
    ForgotPasswordRequest,
    LoginRequest,
    ProfileUpdateRequest,
    ResetPasswordRequest,
    SignupRequest,
    SocialLoginRequest,
    SocialProvider,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])

PASSWORD_RESET_EXPIRE_MINUTES = 60


def _issue_tokens(user_id: int) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(
    payload: SignupRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> User:
    enforce_rate_limit(f"signup:ip:{client_ip(request)}", max_attempts=5, window_seconds=3600)

    exists = db.scalar(
        select(User).where((User.username == payload.username) | (User.email == payload.email))
    )
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 사용 중인 아이디 또는 이메일입니다.",
        )

    verify_token = secrets.token_urlsafe(32)
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        email=payload.email,
        birth_date=payload.birth_date,
        is_verified=False,
        email_verify_token=verify_token,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    verify_url = f"{settings.FRONTEND_BASE_URL}/verify-email?token={verify_token}"
    background_tasks.add_task(send_verification_email, to_email=user.email, verify_url=verify_url)

    set_auth_cookies(response, _issue_tokens(user.id))
    return user


@router.post("/verify-email", status_code=status.HTTP_200_OK)
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    user = db.scalar(select(User).where(User.email_verify_token == payload.token))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않은 인증 링크입니다.",
        )
    user.is_verified = True
    user.email_verify_token = None
    db.commit()
    return {"detail": "이메일 인증이 완료되었습니다."}


@router.post("/resend-verification", status_code=status.HTTP_200_OK)
def resend_verification(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    enforce_rate_limit(f"resend-verify:user:{current_user.id}", max_attempts=3, window_seconds=3600)
    if current_user.is_verified:
        return {"detail": "이미 인증된 이메일입니다."}
    token = secrets.token_urlsafe(32)
    current_user.email_verify_token = token
    db.commit()
    verify_url = f"{settings.FRONTEND_BASE_URL}/verify-email?token={token}"
    background_tasks.add_task(
        send_verification_email, to_email=current_user.email, verify_url=verify_url
    )
    return {"detail": "인증 메일을 다시 보냈습니다."}


@router.post("/login", response_model=UserResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> User:
    enforce_rate_limit(f"login:ip:{client_ip(request)}", max_attempts=10, window_seconds=300)
    enforce_rate_limit(f"login:user:{payload.username}", max_attempts=5, window_seconds=300)

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
    set_auth_cookies(response, _issue_tokens(user.id))
    return user


@router.post("/refresh", status_code=status.HTTP_200_OK)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    invalid_token_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="유효하지 않은 리프레시 토큰입니다.",
    )
    refresh_token = get_refresh_token(request)
    if not refresh_token:
        raise invalid_token_exc
    try:
        decoded = decode_token(refresh_token, expected_type="refresh")
        user_id = int(decoded["sub"])
    except (JWTError, KeyError, ValueError):
        raise invalid_token_exc

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise invalid_token_exc
    set_auth_cookies(response, _issue_tokens(user.id))
    return {"detail": "갱신되었습니다."}


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(response: Response) -> dict[str, str]:
    clear_auth_cookies(response)
    return {"detail": "로그아웃 되었습니다."}


@router.post("/forgot-password", status_code=status.HTTP_200_OK)
def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """이메일이 실제로 가입돼 있는지 여부와 무관하게 항상 같은 응답을 준다
    (계정 존재 여부를 외부에 노출하지 않기 위한 표준적인 방어 — user
    enumeration 방지). 소셜 로그인 계정은 비밀번호가 없으므로 대상에서 제외."""
    enforce_rate_limit(f"forgot-pw:ip:{client_ip(request)}", max_attempts=5, window_seconds=3600)
    enforce_rate_limit(f"forgot-pw:email:{payload.email}", max_attempts=3, window_seconds=3600)

    user = db.scalar(select(User).where(User.email == payload.email))
    if user is not None and user.is_active and user.social_provider is None:
        token = secrets.token_urlsafe(32)
        user.password_reset_token = token
        user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(
            minutes=PASSWORD_RESET_EXPIRE_MINUTES
        )
        db.commit()
        reset_url = f"{settings.FRONTEND_BASE_URL}/reset-password?token={token}"
        background_tasks.add_task(
            send_password_reset_email, to_email=user.email, reset_url=reset_url
        )
    return {
        "detail": "입력하신 이메일로 비밀번호 재설정 링크를 보내드렸습니다. (가입된 이메일인 경우에만 발송됩니다)"
    }


@router.post("/reset-password", status_code=status.HTTP_200_OK)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)) -> dict[str, str]:
    user = db.scalar(select(User).where(User.password_reset_token == payload.token))
    if user is None or user.password_reset_expires_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않거나 만료된 링크입니다. 다시 요청해 주세요.",
        )
    expires_at = user.password_reset_expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="유효하지 않거나 만료된 링크입니다. 다시 요청해 주세요.",
        )
    user.password_hash = hash_password(payload.new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    db.commit()
    return {"detail": "비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요."}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.patch("/me", response_model=UserResponse)
def patch_me(
    payload: ProfileUpdateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> User:
    """이메일 / 비밀번호 변경. 소셜 로그인 사용자는 비밀번호 변경 불가."""
    is_social = current_user.social_provider is not None

    # 1) 이메일 변경 — 새 주소는 아직 검증 안 됐으므로 다시 미인증 처리하고
    # 인증 메일을 재발송한다 (검증된 옛 이메일을 계속 인증완료로 두면 의미 없음).
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
        if not is_social:
            token = secrets.token_urlsafe(32)
            current_user.is_verified = False
            current_user.email_verify_token = token
            verify_url = f"{settings.FRONTEND_BASE_URL}/verify-email?token={token}"
            background_tasks.add_task(
                send_verification_email, to_email=current_user.email, verify_url=verify_url
            )

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
    """회원 탈퇴.

    개인정보처리방침 제2조에 따르면 "홈페이지 회원 가입 및 관리" 목적의
    개인정보(아이디·비밀번호·생년월일·이메일 등)는 탈퇴 시까지만 보유하고,
    "재화 또는 서비스 제공" 관련 기록(주문/결제/발급 서류)은 전자상거래법에
    따라 탈퇴 여부와 무관하게 5년간 보관 의무가 있다(계약/청약철회·대금결제·
    공급기록). 그래서 예전처럼 is_active=False 만 세우고 개인정보를 그대로
    남겨두면 안 되고, 반대로 User row 를 통째로 지우면 orders/issued_documents
    등 법정 보관 대상 기록까지 FK cascade 로 같이 날아간다.

    그래서 row 는 남기되(주문·발급서류의 FK 무결성 유지) 식별 가능한 개인정보
    필드만 지우는 "익명화" 방식을 쓴다 — 제6조의 "별도 보관"과 같은 취지.
    이미 발급된 수료증/의견서(recipient_name 등)는 문서 자체에 스냅샷으로
    저장돼 있어 법원 재확인 용도로 계속 유효하게 남는다. 심리상담 설문
    응답(자유서술, 가장 민감한 항목)은 거래기록 보관의무 대상이 아니므로
    본문만 삭제한다.
    """
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

    anon_suffix = secrets.token_hex(4)
    current_user.username = f"deleted_{current_user.id}_{anon_suffix}"
    current_user.email = f"deleted_{current_user.id}_{anon_suffix}@withdrawn.kcpec.local"
    current_user.password_hash = None
    current_user.birth_date = None
    current_user.social_id = None
    current_user.password_reset_token = None
    current_user.password_reset_expires_at = None
    current_user.email_verify_token = None
    current_user.is_verified = False
    current_user.is_active = False

    surveys = db.scalars(
        select(CounselingSurvey).where(CounselingSurvey.user_id == current_user.id)
    ).all()
    for survey in surveys:
        survey.responses = {"_redacted": "회원 탈퇴로 삭제된 응답입니다."}

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

    # 2) 같은 이메일로 이미 가입된 계정(비밀번호 방식이든 다른 소셜이든)이
    # 있으면 그 계정으로 그대로 로그인시킨다. provider 로그인에 성공했다는
    # 것 자체가 이 이메일의 소유권을 이미 검증받았다는 뜻이므로, 새 계정을
    # 따로 만들거나 사용자에게 별도 "연결" 절차를 요구할 필요가 없다.
    # (예전엔 여기서 막고 "마이페이지에서 연결하라"고 안내했는데, 정작 그
    # 연결 기능이 없었고 — 기존 계정이 비밀번호 없는 소셜 전용 계정이면
    # "기존 방식으로 로그인" 자체가 불가능해 사용자가 영영 못 들어가는
    # 상황이었다. 2026-09 발견.)
    existing = db.scalar(select(User).where(User.email == email))
    if existing is not None:
        if not existing.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="비활성화된 계정입니다.",
            )
        return existing

    # 3) 신규 생성 — 소셜 provider 가 이미 이메일을 검증했다고 보고 바로 인증완료 처리.
    new_user = User(
        username=_unique_username_from(db, email),
        password_hash=None,
        email=email,
        birth_date=None,
        social_provider=provider,
        social_id=provider_id,
        is_verified=True,
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
    """provider 콜백 — 토큰 교환 + 유저 find-or-create + httpOnly 쿠키 발급.

    예전엔 URL fragment(#access_token=...) 로 토큰을 SPA 에 넘겼는데, 그러면
    SPA 가 결국 JS 에서 읽을 수 있는 localStorage 에 저장하게 된다. 지금은
    redirect 응답 자체에 Set-Cookie 를 실어 보내 프런트는 쿠키가 이미 설정된
    채로 도착한다.
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

    redirect = RedirectResponse(
        url=f"{settings.FRONTEND_BASE_URL}/social-callback",
        status_code=status.HTTP_302_FOUND,
    )
    set_auth_cookies(redirect, _issue_tokens(user.id))
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

