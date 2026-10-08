"""QR 코드 PNG 생성 — 전부 로컬에서 생성(외부 QR 생성 API 호출 금지).

변호사 파트너 포털 링크처럼 추측 불가능한 비밀 URL을 다룰 때, 외부 QR
생성 서비스에 그 URL을 보내면 그 서비스 로그에 비밀 링크가 그대로 남는다
— 반드시 로컬에서만 생성한다.
"""

from __future__ import annotations

import io

import qrcode


def generate_qr_png(data: str) -> bytes:
    img = qrcode.make(data)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()
