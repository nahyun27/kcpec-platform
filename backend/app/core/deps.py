from fastapi import Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.cookies import get_access_token
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User


def get_current_user_optional(
    request: Request,
    db: Session = Depends(get_db),
) -> User | None:
    """access 쿠키가 있으면 user 반환, 없거나 invalid 면 None.
    공개 + 인증된 사용자 모두 허용하는 엔드포인트(예: 강의 상세 — 비활성 강의는
    어드민/수강자만) 에 사용.
    """
    token = get_access_token(request)
    if not token:
        return None
    try:
        payload = decode_token(token, expected_type="access")
        user_id_str = payload.get("sub")
        if user_id_str is None:
            return None
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        return None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        return None
    return user


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> User:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="유효하지 않은 인증 정보입니다.",
    )
    token = get_access_token(request)
    if not token:
        raise credentials_exc
    try:
        payload = decode_token(token, expected_type="access")
        user_id_str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exc
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exc

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise credentials_exc
    return user
