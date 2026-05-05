"""Stream URL issuance.

If AWS credentials + bucket are configured, returns a real S3 presigned URL.
Otherwise returns the lecture's stored video_url as-is, or — if absent —
falls back to a bundled local sample video so the player page can be
exercised end-to-end without provisioning S3.
"""

from app.core.config import settings

# 로컬 개발용 샘플 (backend/scripts/download_sample_video.sh 로 다운로드).
LOCAL_SAMPLE_URL = "http://localhost:8000/static/videos/sample_lecture.mp4"


def _aws_configured() -> bool:
    return all(
        [
            settings.AWS_REGION,
            settings.AWS_ACCESS_KEY_ID,
            settings.AWS_SECRET_ACCESS_KEY,
            settings.AWS_S3_VIDEO_BUCKET,
        ]
    )


def issue_stream_url(video_url: str | None, lecture_id: int) -> tuple[str, int]:
    expires = settings.STREAM_URL_EXPIRE_SECONDS

    if not _aws_configured():
        # 강의에 video_url 이 등록돼 있으면 그대로 (예: 어드민이 입력한 절대 URL),
        # 없으면 번들된 로컬 샘플로 폴백 → <video> 가 즉시 재생 가능.
        return (video_url or LOCAL_SAMPLE_URL), expires

    # Lazy import so boto3 isn't required for local dev / tests.
    import boto3
    from botocore.client import Config

    object_key = video_url or f"lectures/{lecture_id}.mp4"
    client = boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )
    url = client.generate_presigned_url(
        ClientMethod="get_object",
        Params={"Bucket": settings.AWS_S3_VIDEO_BUCKET, "Key": object_key},
        ExpiresIn=expires,
    )
    return url, expires
