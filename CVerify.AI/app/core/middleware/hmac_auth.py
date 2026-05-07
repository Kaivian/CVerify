import hmac
import time
import logging
from fastapi import Request, HTTPException, Header
import redis
from app.core.config import settings

logger = logging.getLogger("hmac_auth")

# Connect to Redis
try:
    redis_client = redis.from_url(settings.redis_url, decode_responses=True)
except Exception as e:
    logger.error(f"Failed to connect to Redis at {settings.redis_url}: {e}")
    redis_client = None

async def verify_hmac_signature(
    request: Request,
    x_client_id: str = Header(..., alias="X-Client-Id"),
    x_timestamp: str = Header(..., alias="X-Timestamp"),
    x_nonce: str = Header(..., alias="X-Nonce"),
    x_correlation_id: str = Header(..., alias="X-Correlation-Id"),
    x_signature: str = Header(..., alias="X-Signature")
):
    # 1. Validate Client ID
    if x_client_id != settings.client_id.strip('"'):
        logger.warning(f"Invalid X-Client-Id: {x_client_id}")
        raise HTTPException(status_code=401, detail="Unauthorized client.")

    # 2. Validate Timestamp (max 5 minutes skew to prevent replay attacks)
    try:
        req_time = int(x_timestamp)
    except ValueError:
        logger.warning("Invalid X-Timestamp format.")
        raise HTTPException(status_code=401, detail="Invalid timestamp format.")

    now = int(time.time())
    if abs(now - req_time) > 300:
        logger.warning(f"Timestamp skew exceeded. Now: {now}, Request: {req_time}")
        raise HTTPException(status_code=401, detail="Request expired.")

    # 3. Validate Nonce replay attack protection via Redis
    if redis_client:
        try:
            nonce_key = f"nonce:{x_nonce}"
            # SETNX (Set if Not Exists) with 5 min (300 sec) expiry
            is_new = redis_client.set(nonce_key, "1", ex=300, nx=True)
            if not is_new:
                logger.warning(f"Replay attack detected! Nonce already exists: {x_nonce}")
                raise HTTPException(status_code=401, detail="Invalid request signature (replay detected).")
        except redis.RedisError as re:
            logger.error(f"Redis connection error during nonce validation: {re}")
            # If Redis goes offline, we fail closed to preserve security integrity
            raise HTTPException(status_code=503, detail="Signature store unavailable.")
    else:
        logger.error("Redis client is offline. Signature verification failed closed.")
        raise HTTPException(status_code=503, detail="Distributed security store offline.")

    # 4. Reconstruct signed raw message
    body_bytes = await request.body()
    body_str = body_bytes.decode("utf-8")

    method = request.method.upper()
    path = request.url.path

    # Formula: HMAC_SHA256(HTTP_METHOD + URL + BODY + TIMESTAMP + NONCE, SHARED_SECRET)
    raw_message = f"{method}{path}{body_str}{x_timestamp}{x_nonce}"
    
    key_bytes = settings.shared_secret.strip('"').encode("utf-8")
    message_bytes = raw_message.encode("utf-8")

    # 5. Compute signature
    computed_mac = hmac.new(key_bytes, message_bytes, digestmod="sha256")
    computed_sig = computed_mac.hexdigest().lower()

    # 6. Constant-time comparison
    if not hmac.compare_digest(computed_sig, x_signature.lower()):
        logger.warning(f"Signature mismatch! Computed: {computed_sig}, Provided: {x_signature}")
        raise HTTPException(status_code=401, detail="Invalid signature.")

    # Ingest Correlation ID into request state for logs
    request.state.correlation_id = x_correlation_id
    return x_correlation_id
