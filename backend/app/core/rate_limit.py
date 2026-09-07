"""단순 in-memory sliding-window rate limiter.

Redis 같은 외부 저장소 없이 단일 프로세스 안에서 로그인/회원가입/비밀번호
재설정처럼 무차별 대입에 노출된 엔드포인트의 시도 횟수를 제한한다.
uvicorn 워커가 여러 개(현재 2개)면 워커별로 카운터가 분리돼 실제 허용치가
워커 수배로 늘어나지만, 지금 트래픽 규모에서는 무제한 방치보다 훨씬
안전하고 Redis 를 새로 들이는 비용을 정당화할 만큼 트래픽이 크지 않다.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status

_lock = threading.Lock()
_attempts: dict[str, deque[float]] = defaultdict(deque)


def enforce_rate_limit(key: str, *, max_attempts: int, window_seconds: int) -> None:
    now = time.monotonic()
    with _lock:
        bucket = _attempts[key]
        while bucket and now - bucket[0] > window_seconds:
            bucket.popleft()
        if len(bucket) >= max_attempts:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
            )
        bucket.append(now)


def client_ip(request: Request) -> str:
    """nginx 뒤에서 실제 접속 IP 조회.

    nginx 가 `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`
    로 기존 값 뒤에 실제 접속 IP 를 append 하므로, 마지막 값이 nginx 가 직접
    관측한 진짜 IP 다. 첫 값을 쓰면 클라이언트가 헤더를 위조해 넣은 값을
    그대로 신뢰하게 되어 rate limit 을 무력화할 수 있다.
    """
    xff = request.headers.get("x-forwarded-for")
    if xff:
        parts = [p.strip() for p in xff.split(",") if p.strip()]
        if parts:
            return parts[-1]
    return request.client.host if request.client else "unknown"
