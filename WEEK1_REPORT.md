# Nouri AI Agent — Week 1 Report

**Project:** DoGoods Community Food Sharing Platform  
**Sprint:** Week 1 — Core AI Engine & Chat Interface  
**Date:** March 25–31, 2026  
**Budget Used:** ~$300 (of $1,200 total)

---

## Executive Summary

Week 1 delivered the foundational AI assistant **"Nouri"** — a fully functional chat interface with dual voice systems (free browser APIs + paid OpenAI Whisper/TTS), bilingual support (English/Spanish), and a Supabase Edge Function backend powered by **OpenAI GPT-4o-mini** function-calling. Users can now interact with a floating robot avatar on every page to search food, check pickups, manage listings, create reminders, and more using text, quick actions, or voice.

---

## Deliverables Completed

| #   | Task                                       | Status  |
| --- | ------------------------------------------ | ------- |
| 1   | AI CRUD methods in `dataService.js`        | ✅ Done |
| 2   | `ai-chat` Edge Function with 9 tools       | ✅ Done |
| 3   | `aiChatService.js` client service          | ✅ Done |
| 4   | `useAIChat.js` React hook                  | ✅ Done |
| 5   | `AIChatPanel.jsx` full chat UI             | ✅ Done |
| 6   | `VoiceInput.jsx` microphone component      | ✅ Done |
| 7   | `VoiceOutput.jsx` text-to-speech component | ✅ Done |
| 8   | `openaiVoice.js` OpenAI Whisper + TTS      | ✅ Done |
| 9   | Wired AIChatPanel into `MainLayout.jsx`    | ✅ Done |
| 10  | 5 unit tests (all passing)                 | ✅ Done |

**Completion: 10/10 tasks (100%)**

---

## Architecture Built

```
┌────────────────────────────────────────────────────────────────┐
│  Browser (React App)                                           │
│                                                                │
│  AIChatPanel.jsx ◄──► useAIChat.js ◄──► aiChatService.js      │
│       │                    │                    │               │
│  Text Mode:           Language              Fetch to           │
│   VoiceOutput.jsx     Detection             Edge Function      │
│   (free SpeechSynth)  (auto EN/ES)                             │
│                                                                │
│  Voice Mode:                                                   │
│   MediaRecorder → openaiVoice.js (Whisper STT + OpenAI TTS)   │
│   (paid OpenAI API)                                            │
└──────────────────────────────┬─────────────────────────────────┘
                               │ HTTPS
                               ▼
┌────────────────────────────────────────────────────────────────┐
│  Supabase Edge Function: ai-chat/index.ts                      │
│                                                                │
│  JWT Auth → Load Training Data → Build System Prompt           │
│       → OpenAI GPT-4o-mini (function calling, max 3 rounds)   │
│       → Execute Tools (DB queries) → Save Conversation         │
│       → Return response + tool results + suggested actions     │
└────────────────────────────────────────────────────────────────┘
```

---

## Files Created / Modified

### New Files (8)

| File                                   | Lines | Purpose                                                                                                                         |
| -------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/functions/ai-chat/index.ts`  | 543   | Edge Function — authenticates users, calls OpenAI GPT-4o-mini with 9 tools, handles multi-round function calling, saves conversations |
| `utils/services/aiChatService.js`      | 108   | Client service — mediates between React hook and Edge Function                                                                  |
| `utils/hooks/useAIChat.js`             | 153   | React hook — manages chat state, language detection, conversation history, geolocation                                          |
| `components/assistant/AIChatPanel.jsx` | 818   | Main chat UI — floating robot bubble, expandable dark-theme panel, immersive voice mode, tool result cards, quick actions       |
| `components/assistant/VoiceInput.jsx`  | 136   | Microphone button — Web Speech API (free), push-to-talk, language-aware (en-US/es-ES). Standalone component for future use      |
| `components/assistant/VoiceOutput.jsx` | 137   | Text-to-speech — free SpeechSynthesis API, voice selection, mute toggle, markdown cleanup                                       |
| `utils/openaiVoice.js`                 | 100   | OpenAI voice services — Whisper STT (`transcribeAudio`) + TTS (`textToSpeech`) + audio playback (`playAudioBlob`). Used by Voice Mode |
| `tests/AIChat.test.js`                 | 165   | Unit tests — 5 test suites covering core chat flows                                                                             |

### Modified Files (2)

| File                               | Changes                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------- |
| `utils/dataService.js`             | Added ~244 lines: 8 AI CRUD methods at end of class (conversations, reminders, feedback) |
| `components/layout/MainLayout.jsx` | Replaced commented-out `AIAssistant` with `<AIChatPanel />` import + render              |

### Pre-Existing Files (Leveraged, not modified)

| File                                                            | Role                                                                      |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `supabase/functions/ai-chat/ai_training_data.json` (216 lines) | System prompt, Spanish rules, platform info, user roles, categories       |
| `supabase/migrations/20260327_create_ai_tables.sql` (94 lines) | Creates `ai_conversations`, `ai_reminders`, `ai_feedback` tables with RLS |

**Total new code written: ~2,160 lines across 8 new files + ~244 lines added to existing files**

---

## Feature Details

### 1. Chat Interface (`AIChatPanel.jsx` — 818 lines)

The largest deliverable. A dark-themed, futuristic chat experience with three modes:

- **Floating Bubble** — Custom robot SVG avatar (cyan/white, with antennae, happy-arc eyes, glossy body). Positioned bottom-right on every page. Hover reveals a "?" speech bubble. Bob animation + cyan glow ring draw user attention.
- **Chat Panel** — Expandable dark slate window (`#0f172a → #1e293b` gradient) with message thread, 6 quick action chips per language, text input + voice mode button + send button, dropdown menu (clear history, fullscreen), close/expand controls.
- **Voice Mode** — Immersive full-panel view with large animated robot avatar (eyes change to circles when listening, mouth pulses when speaking), audio equalizer bars, ambient glow that shifts with state (speaking=cyan, listening=blue). Uses MediaRecorder for mic input with silence detection (>1.5s silence auto-stops), OpenAI Whisper for transcription, OpenAI TTS for speech output. 30s recording safety limit.

**Sub-components built inside AIChatPanel.jsx:**

- `TypingIndicator` — Animated cyan bouncing dots with "Nouri is thinking..." label
- `ToolResultCard` — Rich cards for `search_food_nearby` (up to 3 listings with distance, category, dietary tags), `create_reminder` (checkmark), `claim_food` (success message), `create_food_listing` (success message)
- `MessageBubble` — User messages (cyan-to-blue gradient, right-aligned) vs. Assistant messages (slate with cyan accents, left-aligned, with robot avatar). Each assistant message has: VoiceOutput speak button, thumbs up/down feedback buttons, timestamp
- `SuggestedActionButton` — Navigate or retry action chips returned by AI

### 2. Edge Function Backend (`ai-chat/index.ts` — 543 lines)

**AI Model:** OpenAI GPT-4o-mini (via `https://api.openai.com/v1/chat/completions`)  
**Env Var:** `OPENAI_API_KEY`  
**Temperature:** 0.7 | **Max tokens:** 1500

**9 Tools Defined:**

| Tool                      | Action                                            | Auth Required |
| ------------------------- | ------------------------------------------------- | ------------- |
| `search_food_nearby`      | Search food listings by location/category/dietary | No            |
| `get_user_profile`        | Fetch user profile + stats                        | Yes           |
| `get_pickup_status`       | Check claimed food + status                       | Yes           |
| `get_my_listings`         | View user's own food listings                     | Yes           |
| `create_reminder`         | Set pickup/event/custom reminders                 | Yes           |
| `get_distribution_events` | Find upcoming community events                    | No            |
| `claim_food`              | Reserve a food listing                            | Yes           |
| `create_food_listing`     | Donate food (create listing)                      | Yes           |
| `get_platform_stats`      | Platform-wide impact metrics (admin only)         | Yes (admin)   |

**Key capabilities:**

- JWT authentication via Supabase Auth header; anonymous fallback limits tools to `search_food_nearby` + `get_distribution_events` only
- Multi-round function calling (max 3 rounds per message) — AI can call multiple tools sequentially
- Haversine distance calculation for `search_food_nearby` (filters within `radius_miles`, sorts by proximity)
- User context injection into system prompt (name, role, dietary restrictions, location, GPS)
- Conversation persistence to `ai_conversations` table (both user + assistant messages with metadata)
- Training data loaded from `ai_training_data.json` (system prompt + Spanish rules)
- `claim_food` validates: listing exists, is available, isn't user's own, no duplicate active claim
- Graceful error handling: returns HTTP 200 with friendly message + retry/browse actions even on failure

### 3. Voice I/O — Two Tiers

**Tier 1: Free Browser APIs (Text Chat Mode)**
- **VoiceOutput.jsx** — SpeechSynthesis API. Renders per-message speak/stop button + mute toggle. Prefers Google/Microsoft voices, rate 0.95. Strips markdown before speaking. Returns `null` if browser unsupported.
- **VoiceInput.jsx** — Web Speech API SpeechRecognition. Push-to-talk toggle with red pulse when active. Routes to `en-US` / `es-ES`. Created as a standalone reusable component (not currently rendered in AIChatPanel — available for future integration in other views).

**Tier 2: Paid OpenAI APIs (Voice Mode)**
- **openaiVoice.js** — Three exported functions:
  - `transcribeAudio(audioBlob, language)` → calls OpenAI Whisper (`whisper-1`) for speech-to-text
  - `textToSpeech(text, { voice, speed })` → calls OpenAI TTS (`tts-1`, voice `nova`) for text-to-speech
  - `playAudioBlob(audioBlob, onStart, onEnd)` → HTML5 Audio playback with stop/cleanup
- **Voice Mode in AIChatPanel** — MediaRecorder captures user audio → silence detection via AudioContext/AnalyserNode (1.5s threshold) → auto-stops → sends to Whisper → response goes to OpenAI TTS → auto-plays → auto-starts listening again (conversational loop)

### 4. Language Support

- **Auto-detection:** `detectLanguage()` in `useAIChat.js` scans user input for Spanish keywords (`hola`, `comida`, `buscar`, `necesito`, `dónde`, `gracias`, `por favor`, etc.)
- **Dual welcome messages:** English ("Hi! I'm Nouri, your DoGoods assistant...") and Spanish ("¡Hola! Soy Nouri, tu asistente de DoGoods...")
- **Quick actions:** 6 locale-specific prompt chips per language (Find food, My pickups, Suggest recipe, Share food, Events, How it works)
- **Manual toggle:** Language switch button in chat header sends a message in the target language to trigger the switch
- **End-to-end:** Detection → system prompt context → OpenAI GPT-4o-mini response → VoiceOutput / OpenAI TTS voice selection all respect language setting

### 5. Data Layer (8 methods added to `dataService.js`)

| Method                                                            | Table              | Operation                     |
| ----------------------------------------------------------------- | ------------------ | ----------------------------- |
| `getAIConversations(userId, limit)`                               | `ai_conversations` | SELECT, ordered by created_at |
| `saveAIMessage(userId, role, message, metadata)`                  | `ai_conversations` | INSERT                        |
| `deleteAIConversations(userId)`                                   | `ai_conversations` | DELETE                        |
| `getAIReminders(userId)`                                          | `ai_reminders`     | SELECT, active only           |
| `createAIReminder(userId, message, triggerTime, type, relatedId)` | `ai_reminders`     | INSERT                        |
| `deleteAIReminder(reminderId)`                                    | `ai_reminders`     | DELETE                        |
| `saveAIFeedback(conversationId, userId, rating, comment)`         | `ai_feedback`      | INSERT                        |
| `getAIFeedbackStats()`                                            | `ai_feedback`      | SELECT, aggregated            |

All methods use the `supabaseClient` singleton. Error handling via `reportError()` — returns `[]` or `{}` on failure (graceful degradation).

---

## Test Results

```
PASS tests/AIChat.test.js
  AI Chat — Message Send/Receive
    ✓ sends a message and displays AI response
  AI Chat — Conversation History
    ✓ loads conversation history on mount for authenticated user
  AI Chat — Voice Transcript
    ✓ voice transcript fills and sends a message
  AI Chat — Spanish Language Detection
    ✓ detects Spanish and responds accordingly
  AI Chat — Error Handling
    ✓ shows error message when AI service fails

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

**Mocks used:** `useAuthContext` (mock user), `aiChatService` (all 4 methods), `useNavigate`, `VoiceInput`/`VoiceOutput` (mock components), `navigator.geolocation`, `Element.scrollIntoView`.

**Coverage areas:** Send/receive cycle, conversation history loading, voice transcript → message flow, Spanish auto-detection, error graceful degradation.

---

## Technical Decisions

| Decision                                                         | Rationale                                                                                                  |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Edge Function (not client-side AI)                               | Keeps `OPENAI_API_KEY` server-side, enables service-role DB access, supports tool calling                  |
| OpenAI GPT-4o-mini (not DeepSeek)                                | Superior function-calling support, reliable tool execution, cost-effective ($0.15/1M input tokens)          |
| Dual voice tiers: free browser APIs + paid OpenAI                | Free tier (SpeechSynthesis/SpeechRecognition) for basic use; OpenAI Whisper + TTS for immersive Voice Mode |
| Single `AIChatPanel` component (not enhancing old `AIAssistant`) | Old component was 450+ lines of tightly coupled code; cleaner to build fresh with proper hook architecture |
| Dark futuristic UI theme (slate/cyan)                            | Distinguishes Nouri panel from main app's green/white theme; signals "AI assistant" visually               |
| Robot SVG avatar (not emoji)                                     | Custom-drawn with states (happy, listening, speaking); better branding than a generic emoji                |
| Singleton `aiChatService` pattern                                | Consistent with codebase conventions (`dataService`, `authService`)                                        |
| 3-round tool calling limit                                       | Prevents infinite loops while allowing multi-step queries (e.g., search → claim)                           |
| Conversation history capped at 20 messages                       | Keeps OpenAI context window manageable, reduces token costs                                                |
| MediaRecorder + silence detection for Voice Mode                 | More reliable than continuous SpeechRecognition; enables Whisper transcription for higher accuracy          |

---

## Known Limitations (To Address in Week 2+)

1. **VoiceInput.jsx not yet integrated** — Created as standalone component but not rendered in AIChatPanel. Voice Mode uses its own MediaRecorder + Whisper pipeline. VoiceInput could be added to text chat mode for a free voice option.
2. **Reminders are stored but not triggered** — No cron/scheduler yet to send push notifications when reminders fire
3. **Anonymous mode is basic** — Only 2 tools available; could expand with community info
4. **No streaming** — Responses wait for full completion; streaming would improve perceived latency
5. **Voice Mode requires OpenAI API key** — `openaiVoice.js` reads key from `config.js`; if not configured, Voice Mode transcription/TTS will fail (text chat still works)
6. **Edge Function not yet deployed** — Requires `supabase functions deploy ai-chat` with `OPENAI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` secrets set
7. **Tool handlers need real-world testing** — Food search proximity filtering, claim validation, and listing creation need testing against production data

---

## Cost Implications

| Service               | Usage Context                    | Cost Model                        |
| --------------------- | -------------------------------- | --------------------------------- |
| OpenAI GPT-4o-mini    | Every chat message (Edge Func.)  | ~$0.15/1M input, $0.60/1M output |
| OpenAI Whisper        | Voice Mode only (per utterance)  | $0.006/minute of audio            |
| OpenAI TTS            | Voice Mode only (per response)   | $0.015/1K characters              |
| Web Speech API        | Text chat VoiceInput/VoiceOutput | Free (browser built-in)           |
| SpeechSynthesis API   | Text chat VoiceOutput            | Free (browser built-in)           |

---

## Week 2 Preview

| Priority  | Task                                                                          |
| --------- | ----------------------------------------------------------------------------- |
| 🔴 High   | Deploy Edge Function + set production secrets                                 |
| 🔴 High   | End-to-end testing against real Supabase data                                 |
| 🔴 High   | Wire VoiceInput.jsx into text chat mode (free voice option)                   |
| 🟡 Medium | Reminder cron job (Supabase scheduled function)                               |
| 🟡 Medium | Donor-specific tools (listing analytics, expiry alerts)                       |
| 🟡 Medium | Spanish end-to-end pipeline testing                                           |
| 🟢 Normal | Anonymous mode expansion                                                      |
| 🟢 Normal | Admin monitoring dashboard integration                                        |

---

*Report generated March 31, 2026*
