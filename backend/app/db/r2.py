import os
import boto3

_client = None


def _get_client():
    global _client
    if _client is not None:
        return _client
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID")
    _client = boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
        region_name="auto",
    )
    return _client


def _bucket() -> str:
    return os.getenv("R2_BUCKET_NAME", "pseudolab-exp")


def upload(key: str, data: bytes, content_type: str) -> bool:
    try:
        _get_client().put_object(
            Bucket=_bucket(),
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return True
    except Exception:
        return False


def presigned_url(key: str, expires_in: int = 3600) -> str | None:
    try:
        return _get_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": _bucket(), "Key": key},
            ExpiresIn=expires_in,
        )
    except Exception:
        return None
