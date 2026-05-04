"""Stream URL issuance.

If AWS credentials + bucket are configured, returns a real S3 presigned URL.
Otherwise returns a deterministic dummy URL so local dev can exercise the
player page without provisioning S3.
"""

from app.core.config import settings


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
        # Local dev fallback. The frontend treats this as opaque; if the file
        # truly doesn't exist the <video> tag simply fails to load.
        fallback = video_url or f"/dummy-video/lecture-{lecture_id}.mp4"
        return fallback, expires

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
