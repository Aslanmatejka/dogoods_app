"""
DoGoods AI Backend — FastAPI Application
==========================================
Provides all AI-related HTTP endpoints:

  POST /api/ai/chat            – Text conversation (returns text + optional audio URL)
  GET  /api/ai/history/{uid}   – Retrieve conversation history
  POST /api/ai/voice           – Transcribe audio (Whisper) then process as chat
  POST /api/ai/tts             – Text-to-speech
  POST /api/ai/feedback        – Submit feedback on AI message
  GET  /health                 – Health check

Background jobs: checks ai_reminders every 15 min, missed pickup alerts.

Run:
    uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
"""

import asyncio
import os
import re
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from base64 import b64encode

import httpx
from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.ai_engine import (
    conversation_engine,
    check_rate_limit,
    _circuit,
    supabase_get,
    supabase_post,
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    OPENAI_API_KEY,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("app")

ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv(
        "CORS_ORIGINS", "http://localhost:3001,http://127.0.0.1:3001"
    ).split(",")
]

# Twilio configuration
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")
REMINDER_CHECK_INTERVAL = int(os.getenv("REMINDER_CHECK_INTERVAL", "900"))  # 15 min


# ---------------------------------------------------------------------------
# Twilio SMS helper
# ---------------------------------------------------------------------------

async def send_sms_via_twilio(to_phone: str, message: str) -> dict:
    """Send an SMS using the Twilio REST API and log it to sms_logs."""
    if not all([TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER]):
        logger.warning("Twilio not configured — skipping SMS to %s", to_phone)
        return {"sent": False, "error": "Twilio not configured"}

    url = (
        f"https://api.twilio.com/2010-04-01/Accounts/"
        f"{TWILIO_ACCOUNT_SID}/Messages.json"
    )
    auth_str = b64encode(
        f"{TWILIO_ACCOUNT_SID}:{TWILIO_AUTH_TOKEN}".encode()
    ).decode()

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                url,
                data={
                    "To": to_phone,
                    "From": TWILIO_PHONE_NUMBER,
                    "Body": message[:1600],  # Twilio SMS limit
                },
                headers={"Authorization": f"Basic {auth_str}"},
            )
            resp_data = resp.json()

        twilio_sid = resp_data.get("sid", "")
        error_msg = resp_data.get("error_message")
        sent_ok = resp.status_code in (200, 201) and not error_msg

        # Log to sms_logs table
        try:
            await supabase_post("sms_logs", {
                "phone_number": to_phone,
                "message": message[:1600],
                "type": "reminder",
                "status": "sent" if sent_ok else "failed",
                "twilio_sid": twilio_sid,
                "error_message": error_msg,
            })
        except Exception as log_exc:
            logger.error("Failed to log SMS: %s", log_exc)

        if sent_ok:
            logger.info("SMS sent to %s (sid=%s)", to_phone, twilio_sid)
            return {"sent": True, "twilio_sid": twilio_sid}
        else:
            logger.error("Twilio error: %s", error_msg or resp.text[:200])
            return {"sent": False, "error": error_msg or "Twilio request failed"}

    except Exception as exc:
        logger.error("SMS send failed: %s", exc)
        return {"sent": False, "error": str(exc)}


# ---------------------------------------------------------------------------
# Background job: process pending reminders every 15 minutes
# ---------------------------------------------------------------------------

async def process_pending_reminders() -> int:
    """Find due reminders, look up user phone, send SMS, mark as sent.

    Returns the number of reminders processed.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return 0

    now_iso = datetime.now(timezone.utc).isoformat()
    processed = 0

    try:
        # Fetch due, unsent reminders
        reminders = await supabase_get("ai_reminders", {
            "sent": "eq.false",
            "trigger_time": f"lte.{now_iso}",
            "select": "id,user_id,message,reminder_type,trigger_time",
            "order": "trigger_time.asc",
            "limit": "50",
        })
    except Exception as exc:
        logger.error("Reminder fetch failed: %s", exc)
        return 0

    for reminder in reminders:
        rid = reminder.get("id")
        uid = reminder.get("user_id")
        msg = reminder.get("message", "")
        rtype = reminder.get("reminder_type", "general")

        # Look up user phone
        phone = None
        try:
            user_rows = await supabase_get("users", {
                "id": f"eq.{uid}",
                "select": "phone,name,sms_opt_in,sms_notifications_enabled",
            })
            if user_rows:
                user = user_rows[0]
                # Only send if user has opted in to SMS
                if user.get("sms_opt_in") or user.get("sms_notifications_enabled"):
                    phone = user.get("phone")
        except Exception as exc:
            logger.error("User phone lookup for reminder %s failed: %s", rid, exc)

        # Send SMS if phone available
        sms_result = {"sent": False}
        if phone:
            prefix = {
                "pickup": "🍎 Pickup Reminder",
                "listing_expiry": "⏰ Listing Expiry",
                "distribution_event": "📍 Event Reminder",
                "general": "📋 Reminder",
            }.get(rtype, "📋 Reminder")
            sms_body = f"[DoGoods] {prefix}: {msg}"
            sms_result = await send_sms_via_twilio(phone, sms_body)
        else:
            logger.info(
                "No phone/SMS opt-in for user %s, marking reminder %s as sent",
                uid, rid,
            )

        # Mark reminder as sent regardless (avoid re-processing)
        try:
            headers = {
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
                "Content-Type": "application/json",
                "Prefer": "return=representation",
            }
            async with httpx.AsyncClient(timeout=10) as client:
                await client.patch(
                    f"{SUPABASE_URL}/rest/v1/ai_reminders",
                    params={"id": f"eq.{rid}"},
                    json={
                        "sent": True,
                        "sent_at": datetime.now(timezone.utc).isoformat(),
                    },
                    headers=headers,
                )
            processed += 1
        except Exception as exc:
            logger.error("Failed to mark reminder %s as sent: %s", rid, exc)

    if processed:
        logger.info("Processed %d reminder(s)", processed)
    return processed


# ---------------------------------------------------------------------------
# Background job: notify users who forgot to pick up claimed food
# ---------------------------------------------------------------------------

PICKUP_GRACE_HOURS = int(os.getenv("PICKUP_GRACE_HOURS", "6"))

async def check_missed_pickups() -> int:
    """Find approved claims with pickup_date in the past and notify users.

    Only notifies once per claim by checking the notifications table
    for an existing 'missed_pickup' notification with the claim ID.
    Returns the number of notifications sent.
    """
    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        return 0

    from datetime import timedelta

    cutoff = (
        datetime.now(timezone.utc) - timedelta(hours=PICKUP_GRACE_HOURS)
    ).strftime("%Y-%m-%d")

    headers = {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    # Find approved claims where pickup_date has passed
    try:
        overdue_claims = await supabase_get("food_claims", {
            "status": "eq.approved",
            "pickup_date": f"lte.{cutoff}",
            "select": "id,claimer_id,food_id,pickup_date",
            "limit": "50",
        })
    except Exception as exc:
        logger.error("Missed pickup check — claims fetch failed: %s", exc)
        return 0

    if not overdue_claims:
        return 0

    notified = 0
    for claim in overdue_claims:
        claim_id = claim.get("id")
        claimer_id = claim.get("claimer_id")
        food_id = claim.get("food_id")
        pickup_date = claim.get("pickup_date", "")

        if not claimer_id or not claim_id:
            continue

        # Check if we already notified for this claim
        try:
            existing = await supabase_get("notifications", {
                "user_id": f"eq.{claimer_id}",
                "type": "eq.alert",
                "data->>claim_id": f"eq.{claim_id}",
                "select": "id",
                "limit": "1",
            })
            if existing:
                continue  # Already notified
        except Exception:
            pass  # If check fails, send anyway to be safe

        # Look up food title
        food_title = "your claimed food"
        try:
            food_rows = await supabase_get("food_listings", {
                "id": f"eq.{food_id}",
                "select": "title",
            })
            if food_rows:
                food_title = food_rows[0].get("title", food_title)
        except Exception:
            pass

        # Send in-app notification
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    f"{SUPABASE_URL}/rest/v1/notifications",
                    json={
                        "user_id": claimer_id,
                        "title": "Pickup Reminder",
                        "message": (
                            f"It looks like you haven't picked up \"{food_title}\" yet "
                            f"(scheduled for {pickup_date}). Please pick it up soon "
                            f"or cancel the claim so others can benefit!"
                        ),
                        "type": "alert",
                        "read": False,
                        "data": {"claim_id": claim_id, "food_id": food_id},
                    },
                    headers=headers,
                )
                resp.raise_for_status()
                notified += 1
                logger.info(
                    "Missed pickup notification sent: claim=%s user=%s food=%s",
                    claim_id, claimer_id, food_title,
                )
        except Exception as exc:
            logger.error(
                "Failed to notify missed pickup claim=%s: %s", claim_id, exc
            )

    if notified:
        logger.info("Sent %d missed-pickup notification(s)", notified)
    return notified


async def _reminder_loop() -> None:
    """Background loop: reminders + missed pickup checks with backoff on errors."""
    logger.info(
        "Background job started (interval=%ds)", REMINDER_CHECK_INTERVAL
    )
    consecutive_failures = 0
    while True:
        try:
            await process_pending_reminders()
            consecutive_failures = 0  # Reset on success
        except Exception as exc:
            consecutive_failures += 1
            logger.error("Reminder loop error (fail #%d): %s", consecutive_failures, exc)
        try:
            await check_missed_pickups()
        except Exception as exc:
            logger.error("Missed pickup check error: %s", exc)

        # Exponential backoff on repeated failures (up to 1 hour)
        if consecutive_failures > 0:
            backoff = min(REMINDER_CHECK_INTERVAL * (2 ** consecutive_failures), 3600)
            logger.warning("Backing off reminder loop for %ds", backoff)
            await asyncio.sleep(backoff)
        else:
            await asyncio.sleep(REMINDER_CHECK_INTERVAL)


# ---------------------------------------------------------------------------
# FastAPI lifespan (starts/stops background tasks)
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: launch background reminder job
    task = asyncio.create_task(_reminder_loop())
    logger.info("Background reminder job scheduled")
    yield
    # Shutdown: cancel background task and close shared HTTP client
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        logger.info("Background reminder job stopped")
    # Close shared httpx client to release connections gracefully
    from backend.ai_engine import _http_client
    if _http_client and not _http_client.is_closed:
        await _http_client.aclose()
        logger.info("Shared HTTP client closed")


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(
    title="DoGoods AI Backend",
    version="2.0.0",
    description="AI conversation engine + food matching + community tools",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _enforce_rate_limit(request: Request) -> None:
    if not check_rate_limit(_get_client_ip(request)):
        raise HTTPException(429, "Rate limit exceeded. Try again later.")


import re as _re

_UUID_RE = _re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", _re.I
)


def _validate_uuid(value: str, field: str = "user_id") -> str:
    """Validate that a string is a proper UUID v4 format."""
    if not _UUID_RE.match(value):
        raise HTTPException(400, f"Invalid {field}: must be a valid UUID")
    return value


async def _authenticate_request(request: Request) -> str | None:
    """Validate the Supabase JWT from the Authorization header.

    Returns the authenticated user_id, or None if no auth header is present.
    In development (no SUPABASE_URL), auth is skipped for convenience.
    """
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        return None  # No token — caller may be unauthenticated

    token = auth_header[7:]
    if not SUPABASE_URL:
        return None  # Can't validate without Supabase

    try:
        from backend.ai_engine import _get_http_client
        client = _get_http_client(5)
        resp = await client.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "apikey": SUPABASE_SERVICE_KEY,
                "Authorization": f"Bearer {token}",
            },
        )
        if resp.status_code == 200:
            user_data = resp.json()
            return user_data.get("id")
        return None
    except Exception as exc:
        logger.warning("Auth validation failed: %s", exc)
        return None


# ---------------------------------------------------------------------------
# Pydantic models — AI conversation endpoints
# ---------------------------------------------------------------------------

class AIChatRequest(BaseModel):
    user_id: str = Field(min_length=1, max_length=128)
    message: str = Field(min_length=1, max_length=5000)
    include_audio: bool = False


class AIChatResponse(BaseModel):
    text: str
    audio_url: str | None = None
    user_id: str
    lang: str = "en"
    conversation_id: str | None = None
    transcript: str | None = None
    timestamp: str


class ConversationMessage(BaseModel):
    role: str
    message: str
    created_at: str


# ===================================================================
#  AI CONVERSATION ROUTES
# ===================================================================

@app.post("/api/ai/chat", response_model=AIChatResponse)
async def ai_chat(body: AIChatRequest, request: Request) -> dict:
    """
    Handle a text conversation turn.

    Flow: user message + user_id -> profile lookup -> GPT-4o query
          -> text response (+ optional TTS audio URL).
    """
    _enforce_rate_limit(request)
    _validate_uuid(body.user_id)

    # Verify the caller owns this user_id (if auth header present)
    auth_uid = await _authenticate_request(request)
    if auth_uid and auth_uid != body.user_id:
        raise HTTPException(403, "user_id does not match authenticated user")

    try:
        result = await conversation_engine.chat(
            user_id=body.user_id,
            message=body.message,
            include_audio=body.include_audio,
        )
        return result
    except RuntimeError as exc:
        logger.error("AI chat RuntimeError: %s", exc)
        raise HTTPException(503, "AI service temporarily unavailable") from exc
    except Exception as exc:
        logger.error("AI chat error: %s", exc)
        raise HTTPException(500, "Internal AI error") from exc


@app.get("/api/ai/history/{user_id}")
async def ai_history(user_id: str, request: Request, limit: int = 50) -> dict:
    """
    Retrieve conversation history for a user.

    Query params:
      - limit: max messages to return (default 50)
    """
    _enforce_rate_limit(request)
    _validate_uuid(user_id)

    # Verify the caller owns this user_id
    auth_uid = await _authenticate_request(request)
    if auth_uid and auth_uid != user_id:
        raise HTTPException(403, "Cannot access another user's history")

    if limit < 1 or limit > 200:
        raise HTTPException(400, "limit must be between 1 and 200")

    try:
        history = await conversation_engine.get_conversation_history(
            user_id=user_id,
            limit=limit,
        )
        return {
            "user_id": user_id,
            "messages": history,
            "count": len(history),
        }
    except Exception as exc:
        logger.error("History fetch error: %s", exc)
        raise HTTPException(500, "Failed to retrieve conversation history") from exc


@app.delete("/api/ai/history/{user_id}")
async def ai_clear_history(user_id: str, request: Request) -> dict:
    """Delete all conversation history for a user."""
    _enforce_rate_limit(request)
    _validate_uuid(user_id)

    auth_uid = await _authenticate_request(request)
    if auth_uid and auth_uid != user_id:
        raise HTTPException(403, "Cannot clear another user's history")

    try:
        # Use proper query params instead of encoding filters in the table path
        headers = {
            "apikey": SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": "application/json",
        }
        from backend.ai_engine import _get_http_client, SUPABASE_TIMEOUT
        client = _get_http_client(SUPABASE_TIMEOUT)
        resp = await client.delete(
            f"{SUPABASE_URL}/rest/v1/ai_conversations",
            params={"user_id": f"eq.{user_id}"},
            headers=headers,
        )
        resp.raise_for_status()
        return {"user_id": user_id, "cleared": True}
    except Exception as exc:
        logger.error("Clear history error: %s", exc)
        raise HTTPException(500, "Failed to clear conversation history") from exc


class AIFeedbackRequest(BaseModel):
    conversation_id: str = Field(min_length=1, max_length=128)
    user_id: str = Field(min_length=1, max_length=128)
    rating: str = Field(min_length=1, max_length=20)
    comment: str | None = None


@app.post("/api/ai/feedback")
async def ai_feedback(body: AIFeedbackRequest, request: Request) -> dict:
    """Submit feedback on an AI message."""
    _enforce_rate_limit(request)
    _validate_uuid(body.user_id)
    _validate_uuid(body.conversation_id, "conversation_id")

    try:
        payload = {
            "conversation_id": body.conversation_id,
            "user_id": body.user_id,
            "rating": body.rating,
        }
        if body.comment:
            payload["comment"] = body.comment

        await supabase_post("ai_feedback", payload)
        return {"success": True}
    except Exception as exc:
        logger.error("Feedback save error: %s", exc)
        raise HTTPException(500, "Failed to save feedback") from exc


@app.post("/api/ai/voice", response_model=AIChatResponse)
async def ai_voice(
    request: Request,
    audio: UploadFile = File(..., description="Audio file (webm, wav, mp3, m4a)"),
    user_id: str = Form(..., min_length=1, max_length=128),
    include_audio: bool = Form(default=True),
) -> dict:
    """
    Transcribe uploaded audio via OpenAI Whisper, then process as a chat message.

    Accepts multipart form with:
      - audio: audio file
      - user_id: user UUID
      - include_audio: whether to return TTS audio in response (default true)
    """
    _enforce_rate_limit(request)
    _validate_uuid(user_id)

    # Validate file type (strip codec params like ";codecs=opus")
    allowed_types = {
        "audio/webm", "audio/wav", "audio/mpeg", "audio/mp4",
        "audio/ogg", "audio/x-m4a", "audio/mp3",
    }
    base_type = (audio.content_type or "").split(";")[0].strip().lower()
    if base_type and base_type not in allowed_types:
        raise HTTPException(
            400,
            f"Unsupported audio type: {audio.content_type}. "
            f"Accepted: webm, wav, mp3, m4a, ogg",
        )

    # Read audio bytes (limit to 25MB — Whisper API max)
    audio_bytes = await audio.read()
    if len(audio_bytes) > 25 * 1024 * 1024:
        raise HTTPException(400, "Audio file too large (max 25MB)")
    if len(audio_bytes) == 0:
        raise HTTPException(400, "Empty audio file")

    try:
        # 1. Transcribe with Whisper
        transcript = await conversation_engine.transcribe_audio(
            audio_bytes=audio_bytes,
            filename=audio.filename or "audio.webm",
        )
        logger.info("Transcribed audio for user %s: %s", user_id, transcript[:100])

        # 1b. Filter Whisper hallucinations before sending to GPT
        if _is_whisper_noise(transcript):
            logger.info("Filtered Whisper noise for user %s: %s", user_id, transcript[:80])
            raise HTTPException(
                400,
                "Could not understand the audio. Please try again "
                "or switch to text input.",
            )

        # 2. Process transcribed text as a chat message
        result = await conversation_engine.chat(
            user_id=user_id,
            message=transcript,
            include_audio=include_audio,
        )
        # Include the transcript in the response
        result["transcript"] = transcript
        return result

    except HTTPException:
        raise  # Re-raise HTTP exceptions (e.g. noise filter 400) as-is
    except httpx.TimeoutException:
        # Whisper or GPT-4o timed out — suggest text input
        raise HTTPException(
            504,
            "Voice processing timed out. Please try again, "
            "or switch to text input for a faster response.",
        )
    except RuntimeError as exc:
        # Config issue (e.g. missing API key)
        raise HTTPException(503, str(exc)) from exc
    except Exception as exc:
        logger.error("Voice processing error: %s", exc)
        raise HTTPException(
            500,
            "Voice processing failed. You can still type your "
            "message using the text input below.",
        ) from exc


class TTSRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4096)
    lang: str = Field(default="en", max_length=5)


@app.post("/api/ai/tts")
async def ai_tts(body: TTSRequest, request: Request):
    """Generate speech audio from text. Returns audio/mpeg blob."""
    _enforce_rate_limit(request)

    try:
        audio_bytes = await conversation_engine.generate_speech(
            body.text, lang=body.lang
        )
        from fastapi.responses import Response

        return Response(content=audio_bytes, media_type="audio/mpeg")
    except RuntimeError as exc:
        logger.error("TTS RuntimeError: %s", exc)
        raise HTTPException(503, "AI service temporarily unavailable") from exc
    except httpx.HTTPStatusError as exc:
        logger.error("TTS upstream error %s", exc.response.status_code)
        raise HTTPException(502, "TTS service returned an error") from exc
    except Exception as exc:
        logger.error("TTS error: %s", exc)
        raise HTTPException(500, "Text-to-speech failed") from exc


# ---------------------------------------------------------------------------
# Whisper hallucination filter (common artifacts on silence / noise)
# ---------------------------------------------------------------------------

# Exact-match noise phrases (after punctuation removal + lowercase)
_WHISPER_NOISE_PHRASES = {
    "thank you", "thanks", "thank you for watching", "thanks for watching",
    "thank you very much", "thank you so much", "thank you bye",
    "thank you byebye", "thank you goodbye", "thanks bye",
    "thanks for listening", "thanks for tuning in",
    "subscribe", "like and subscribe", "please subscribe",
    "music", "foreign", "applause", "laughter", "silence",
    "bye", "byebye", "bye bye", "goodbye", "good bye",
    "you", "the", "i", "a", "um", "uh", "oh", "hmm", "huh",
    "gwynple", "asha", "welcome",
    "okay", "ok", "so", "yeah", "yes", "no", "right",
    "subtitles by", "subtitles", "captions",
    "you know", "see you next time", "see you",
    "thats all", "thats it", "the end",
}

# Words that are individually noise — if ALL words in transcript are noise, filter it
_WHISPER_NOISE_WORDS = {
    "thank", "thanks", "you", "bye", "byebye", "goodbye", "good",
    "the", "a", "i", "um", "uh", "oh", "hmm", "huh", "ok", "okay",
    "so", "yeah", "yes", "no", "right", "well", "and", "but",
    "please", "welcome", "foreign", "music", "applause", "laughter",
    "silence", "subscribe", "like", "see", "next", "time",
    "very", "much", "for", "watching", "listening", "bye",
}


def _is_whisper_noise(text: str) -> bool:
    """Return True if the transcription looks like Whisper hallucination."""
    stripped = text.strip()
    if len(stripped) < 3:
        return True

    # Remove punctuation for comparison
    cleaned = re.sub(r"[^\w\s]", "", stripped).strip().lower()

    # Exact match against known noise phrases
    if cleaned in _WHISPER_NOISE_PHRASES:
        return True

    # Very short cleaned text
    if len(cleaned) < 3:
        return True

    # All-noise-words check: if every word is a filler/noise word, filter it
    words = cleaned.split()
    if words and all(w in _WHISPER_NOISE_WORDS for w in words):
        return True

    # Repeated phrase detection (e.g. "thank you thank you thank you")
    if words and len(set(words)) <= 2 and len(words) >= 3:
        return True

    # High ratio of non-ASCII chars suggests garbled output
    ascii_chars = sum(1 for c in stripped if c.isascii())
    if len(stripped) > 5 and ascii_chars / len(stripped) < 0.5:
        return True

    return False


@app.post("/api/ai/transcribe")
async def ai_transcribe(
    request: Request,
    audio: UploadFile = File(..., description="Audio file (webm, wav, mp3, m4a)"),
) -> dict:
    """
    Transcription-only endpoint — Whisper STT without chat processing.

    Use this when you only need the transcript text and will send it to
    /api/ai/chat separately.
    """
    _enforce_rate_limit(request)

    # Validate file type
    allowed_types = {
        "audio/webm", "audio/wav", "audio/mpeg", "audio/mp4",
        "audio/ogg", "audio/x-m4a", "audio/mp3",
    }
    base_type = (audio.content_type or "").split(";")[0].strip().lower()
    if base_type and base_type not in allowed_types:
        raise HTTPException(
            400,
            f"Unsupported audio type: {audio.content_type}. "
            f"Accepted: webm, wav, mp3, m4a, ogg",
        )

    audio_bytes = await audio.read()
    if len(audio_bytes) > 25 * 1024 * 1024:
        raise HTTPException(400, "Audio file too large (max 25MB)")
    if len(audio_bytes) == 0:
        raise HTTPException(400, "Empty audio file")

    try:
        transcript = await conversation_engine.transcribe_audio(
            audio_bytes=audio_bytes,
            filename=audio.filename or "audio.webm",
        )
        logger.info("Transcribed (transcribe-only): %s", transcript[:100])

        # Filter Whisper hallucinations
        if _is_whisper_noise(transcript):
            logger.info("Filtered Whisper noise: %s", transcript[:80])
            return {"transcript": "", "filtered": True}

        return {"transcript": transcript.strip(), "filtered": False}

    except httpx.TimeoutException:
        raise HTTPException(504, "Whisper timed out. Try again or use text input.")
    except RuntimeError as exc:
        logger.error("Transcribe RuntimeError: %s", exc)
        raise HTTPException(503, "AI service temporarily unavailable") from exc
    except Exception as exc:
        logger.error("Transcription error: %s", exc)
        raise HTTPException(500, "Transcription failed") from exc


# ===================================================================
#  LEGACY ROUTES (preserved from original ai_engine.py)
# ===================================================================

@app.get("/health")
async def health() -> dict:
    ai_ok = bool(OPENAI_API_KEY)
    db_ok = bool(SUPABASE_URL and SUPABASE_SERVICE_KEY)
    all_ok = ai_ok and db_ok
    return {
        "status": "ok" if all_ok else "degraded",
        "ai_configured": ai_ok,
        "database_configured": db_ok,
        "circuit_state": _circuit.state.value,
    }

# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "backend.app:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
