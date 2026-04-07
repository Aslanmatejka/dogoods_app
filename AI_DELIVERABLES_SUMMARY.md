# DoGoods AI — Deliverables Summary

> Generated: April 7, 2026 | Backend v2.0.0

---

## 1. Backend Engine Setup

### Status: ✅ COMPLETE — All core systems operational

| Component | File | Status | Notes |
|---|---|---|---|
| FastAPI application | `backend/app.py` | ✅ Working | 14 endpoints, CORS, lifespan management |
| Conversation engine | `backend/ai_engine.py` | ✅ Working | GPT-4o chat, Whisper STT, TTS, tool calling |
| Tool definitions (8) | `backend/tools.py` | ✅ Working | All 8 tools have real Supabase implementations |
| Training data | `backend/ai_training_data.json` | ✅ Working | System prompt, roles, processes, safety, tone |
| Circuit breaker | `backend/ai_engine.py` | ✅ Working | 5-failure threshold, 60s reset, half-open probe |
| Rate limiter | `backend/ai_engine.py` | ✅ Working | 50 req/min per IP, in-memory |
| Retry logic | `backend/ai_engine.py` | ✅ Working | 3 retries with exponential backoff |
| Dependencies | `backend/requirements.txt` | ✅ Working | fastapi, uvicorn, httpx, pydantic, python-dotenv, python-multipart |

### API Endpoints

| Method | Path | Purpose | Status |
|---|---|---|---|
| `POST` | `/api/ai/chat` | Text conversation (GPT-4o + tools) | ✅ Working |
| `POST` | `/api/ai/voice` | Voice → Whisper STT → GPT-4o → response | ✅ Working |
| `POST` | `/api/ai/transcribe` | Whisper STT only (no chat processing) | ✅ Working |
| `POST` | `/api/ai/tts` | Text-to-speech (returns audio/mpeg) | ✅ Working |
| `GET` | `/api/ai/history/{user_id}` | Retrieve conversation history | ✅ Working |
| `DELETE` | `/api/ai/history/{user_id}` | Clear conversation history | ✅ Working |
| `POST` | `/api/ai/feedback` | Submit message feedback | ✅ Working |
| `GET` | `/health` | Health check + circuit status | ✅ Working |
| `POST` | `/api/chat` | Legacy chat (DeepSeek/OpenAI) | ✅ Working |
| `POST` | `/api/match` | Food matching engine | ✅ Working |
| `POST` | `/api/recipes` | AI recipe generation | ✅ Working |
| `POST` | `/api/storage-tips` | Food storage advice | ✅ Working |
| `POST` | `/api/impact` | Environmental impact calculator | ✅ Working |
| `POST` | `/api/food-pairings` | Food pairing suggestions | ✅ Working |

### Frontend ↔ Backend Wiring

| Frontend File | Backend Endpoint | Status |
|---|---|---|
| `utils/services/aiChatService.js` | `/api/ai/chat`, `/api/ai/voice`, `/api/ai/history/*`, `/api/ai/feedback` | ✅ Connected |
| `utils/hooks/useAIChat.js` | Via aiChatService | ✅ Connected |
| `utils/openaiVoice.js` | `/api/ai/transcribe`, `/api/ai/tts` | ✅ Connected |
| `components/assistant/AIChatPanel.jsx` | Via useAIChat + openaiVoice | ✅ Active UI |
| Vite proxy (`vite.config.js`) | `/api/ai` → `localhost:8000` | ✅ Configured |

### Background Jobs

| Job | Interval | Status |
|---|---|---|
| Reminder SMS processor | Every 15 min | ✅ Running (awaiting Twilio creds) |

---

## 2. Map and Food Data Integration

### Status: ✅ COMPLETE (with 1 bug to fix)

| Feature | Implementation | Status |
|---|---|---|
| Food search by location | `search_food_near_user` tool → Supabase `food_listings` + Haversine distance | ⚠️ Bug (see below) |
| Mapbox route directions | `get_mapbox_route` tool → Mapbox Directions API | ✅ Working |
| Mapbox fallback | Haversine straight-line estimate when no token | ✅ Working |
| Distribution center search | `query_distribution_centers` tool → Supabase `distribution_events` | ✅ Working |
| Food listing filters | Status (approved/active), expiry date, category/food_type | ✅ Working |
| Distance sorting | Results sorted by distance from user | ⚠️ Partially (see bug) |

### Data Sources Queried

| Table | Used By | Columns |
|---|---|---|
| `food_listings` | search_food, dashboard, schedule | title, description, category, quantity, unit, status, pickup_address, expiry_date, location |
| `distribution_events` | distribution_centers, schedule | title, location, event_date, start_time, end_time, capacity, registered_count, status |
| `food_claims` | schedule, dashboard, profile | claimer_id, listing_id, status, pickup_time |

### ⚠️ Known Bug

**`search_food_near_user` doesn't select `location` from users table** — The user profile query selects `id,name,organization,created_at` but omits the `location` column. This means `user_lat`/`user_lng` will always be `None`, making distance-based search return all listings without distance filtering.

**Fix needed**: Add `location` to the select query in `tools.py` line ~359.

### Environment Variables

| Variable | Status |
|---|---|
| `VITE_MAPBOX_TOKEN` | ✅ Set (`pk.eyJ1...`) |
| `VITE_SUPABASE_URL` | ✅ Set |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set |

---

## 3. User Dashboard and Schedule Integration

### Status: ✅ COMPLETE

| Feature | Tool | Tables Queried | Status |
|---|---|---|---|
| User dashboard | `get_user_dashboard` | users, food_claims, food_listings, ai_reminders | ✅ Working |
| Pickup schedule | `get_pickup_schedule` | food_claims, food_listings, distribution_events | ✅ Working |
| Reminder check | `check_pickup_schedule` | ai_reminders, food_claims, food_listings | ✅ Working |
| Create reminders | `create_reminder` | ai_reminders (INSERT) | ✅ Working |
| User profile | `get_user_profile` | users, food_listings, food_claims | ✅ Working |
| SMS reminders | Background job → Twilio | ai_reminders, users, sms_logs | 🔲 Awaiting Twilio creds |

### Dashboard Data Points

- Profile info (name, email, role, organization, member since)
- Active food listings (count + details)
- Pending food claims (count + details)
- Upcoming AI reminders (next 7 days)
- Favorite food categories (computed from claim history)
- Impact summary (items shared + received)

### Schedule Data Points

- Pending/approved food pickups with listing details
- Upcoming community distribution events with capacity/spots
- Reminders organized by type (pickup, listing_expiry, distribution_event, general)

### Twilio SMS Integration

| Component | Status |
|---|---|
| `send_sms_via_twilio()` | ✅ Implemented (awaiting credentials) |
| Background reminder loop | ✅ Running (checks every 15 min) |
| SMS opt-in check | ✅ Checks `sms_opt_in` and `sms_notifications_enabled` |
| SMS logging | ✅ Writes to `sms_logs` table |
| Twilio env vars | 🔲 Empty (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`) |

---

## 4. Spanish and Fallbacks

### Status: ✅ COMPLETE

| Feature | Implementation | Status |
|---|---|---|
| Spanish detection | 28 marker words + special character check (`¿ ¡ ñ á é í ó ú`) | ✅ Working |
| Spanish chat directive | System message injected when Spanish detected | ✅ Working |
| Spanish TTS voice | `TTS_VOICE_ES` (configurable, defaults to `nova`) | ✅ Working |
| Spanish training data | `spanish_guidelines` in `ai_training_data.json` | ✅ Working |
| Canned fallbacks (EN) | 4 error types: timeout, api_down, general_error, tool_error | ✅ Working |
| Canned fallbacks (ES) | Same 4 types, full Spanish translations | ✅ Working |
| GPT-4o fallback chain | GPT-4o → canned response (per error type + language) | ✅ Working |
| Tool error handling | Per-tool graceful errors → feeds context back to GPT | ✅ Working |
| Whisper noise filter | Backend `_is_whisper_noise()` + frontend `NOISE_PHRASES` | ✅ Working |

### Fallback Chain

```
User message
  → GPT-4o with tool calling
    ✅ Success → response text
    ❌ Timeout → canned "timeout" (EN/ES)
    ❌ HTTP Error → canned "api_down" (EN/ES)
    ❌ Runtime Error (no API key) → canned "api_down" (EN/ES)
    ❌ Any other error → canned "general_error" (EN/ES)
    ❌ Tool call fails → feed error context back to GPT → canned "tool_error" if follow-up also fails
```

### Spanish Detection Markers (28 words)

`hola, gracias, por favor, ayuda, comida, buscar, quiero, necesito, dónde, donde, cómo, como, cuándo, cuando, tengo, puedo, buenos, buenas, qué, que, disponible, recoger, compartir, alimentos, comunidad, recordatorio, horario`

---

## Overall Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite, port 3001)                         │
│                                                             │
│  AIChatPanel ──→ useAIChat ──→ aiChatService ──→ /api/ai/*  │
│       │                                                     │
│       └──→ openaiVoice ──→ /api/ai/transcribe, /api/ai/tts  │
│                                                             │
│  Vite Proxy: /api/ai/* → http://localhost:8000              │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Backend (FastAPI, port 8000)                               │
│                                                             │
│  app.py → 14 endpoints + background SMS job                 │
│  ai_engine.py → ConversationEngine (GPT-4o, Whisper, TTS)   │
│  tools.py → 8 tool implementations (Supabase + Mapbox)      │
│                                                             │
│  External APIs: OpenAI, Mapbox, Twilio, Supabase PostgREST  │
└─────────────────────────────────────────────────────────────┘
```

---

## What's Next — Recommended Priorities

### 🔴 High Priority (Bugs)

1. **Fix `search_food_near_user` location select** — Add `location` column to the user profile query in `tools.py` so distance-based food search actually works.

### 🟡 Medium Priority (Missing Functionality)

2. **Twilio SMS credentials** — Fill in `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` in `.env` to activate reminder SMS delivery.
3. **Endpoint authentication** — All `/api/ai/*` endpoints are publicly accessible with self-reported `user_id`. Add Supabase JWT verification to prevent impersonation and unauthorized history access.
4. **Inject `common_questions` and `response_examples`** from training data into the system prompt (currently loaded but not used).

### 🟢 Low Priority (Cleanup / Optimization)

5. **Delete dead code** — Remove `components/assistant/AIAssistant.jsx`, `utils/deepseekChat.js`, `utils/MatchingEngine.js` (all replaced by backend).
6. **Fix N+1 queries** — `get_user_dashboard`, `get_pickup_schedule`, `check_pickup_schedule` fetch food titles one-by-one; batch with `id=in.(...)`.
7. **UUID validation** — Add format validation on `user_id` parameters to prevent bad Supabase queries.
8. **Remove unused `sendVoice`** — `AIChatPanel` calls `transcribeAudio()` then `sendMessage()` separately; the hook's `sendVoice()` and `/api/ai/voice` endpoint are currently unused by the UI.
