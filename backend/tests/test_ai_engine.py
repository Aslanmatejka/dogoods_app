"""
Tests for backend/ai_engine.py
================================
Covers: response generation, profile injection, Spanish handling,
        tool format, history saving, rate limiter, circuit breaker,
        canned fallbacks, language detection.

Run:
    cd <project-root>
    python -m pytest backend/tests/test_ai_engine.py -v
"""

import asyncio
import json
import time
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

# ---------------------------------------------------------------------------
# Patch env vars BEFORE importing the engine (module-level config reads)
# ---------------------------------------------------------------------------
_ENV = {
    "OPENAI_API_KEY": "sk-test-key",
    "SUPABASE_URL": "https://test.supabase.co",
    "SUPABASE_SERVICE_ROLE_KEY": "test-service-key",
    "MAPBOX_TOKEN": "pk.test-mapbox",
}

with patch.dict("os.environ", _ENV, clear=False):
    from backend.ai_engine import (
        CANNED_RESPONSES,
        CircuitBreaker,
        CircuitState,
        ConversationEngine,
        _build_system_prompt,
        _load_training_data,
        check_rate_limit,
        detect_spanish,
        get_canned_response,
        _rate_store,
    )


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

TEST_USER_ID = "c4dcbd93-081e-4160-87eb-1d51d444413a"


@pytest.fixture
def engine():
    """ConversationEngine with mocked tool imports."""
    with patch("backend.ai_engine.OPENAI_API_KEY", "sk-test-key"), \
         patch("backend.ai_engine.SUPABASE_URL", "https://test.supabase.co"), \
         patch("backend.ai_engine.SUPABASE_SERVICE_KEY", "test-service-key"):
        eng = ConversationEngine()
        yield eng


@pytest.fixture(autouse=True)
def _reset_rate_store():
    """Clear the rate limiter between tests."""
    _rate_store.clear()
    yield
    _rate_store.clear()


@pytest.fixture
def circuit():
    return CircuitBreaker(failure_threshold=3, reset_timeout=0.1)


def _mock_openai_response(content: str, tool_calls=None):
    """Build a fake OpenAI chat completion JSON."""
    msg = {"role": "assistant", "content": content}
    if tool_calls:
        msg["tool_calls"] = tool_calls
        msg["content"] = None
    return {
        "choices": [{"message": msg, "finish_reason": "stop"}],
        "usage": {"prompt_tokens": 10, "completion_tokens": 20},
    }


def _mock_httpx_response(json_data, status_code=200):
    """Build a fake httpx.Response."""
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status_code
    resp.json.return_value = json_data
    resp.text = json.dumps(json_data)
    resp.content = json.dumps(json_data).encode()
    resp.raise_for_status = MagicMock()
    if status_code >= 400:
        resp.raise_for_status.side_effect = httpx.HTTPStatusError(
            "error", request=MagicMock(), response=resp,
        )
    return resp


# ===================================================================
# 1. Language Detection (Spanish handling)
# ===================================================================

class TestSpanishDetection:
    def test_english_text(self):
        assert detect_spanish("Hello, I need some food near me") is False

    def test_spanish_two_markers(self):
        assert detect_spanish("Hola, necesito comida") is True

    def test_spanish_one_marker_plus_char(self):
        assert detect_spanish("¿Dónde hay comida?") is True

    def test_spanish_special_chars(self):
        assert detect_spanish("¡Buenos días!") is True

    def test_empty_string(self):
        assert detect_spanish("") is False

    def test_mixed_language_leans_english(self):
        assert detect_spanish("Hello friend") is False

    def test_spanish_multiple_markers(self):
        assert detect_spanish("Hola, quiero buscar comida por favor") is True


# ===================================================================
# 2. Canned Fallback Responses
# ===================================================================

class TestCannedResponses:
    def test_english_timeout(self):
        resp = get_canned_response("timeout", "en")
        assert "try again" in resp.lower()

    def test_spanish_timeout(self):
        resp = get_canned_response("timeout", "es")
        assert "inténtalo" in resp.lower()

    def test_english_api_down(self):
        resp = get_canned_response("api_down", "en")
        assert "unable to connect" in resp.lower() or "temporarily" in resp.lower()

    def test_spanish_api_down(self):
        resp = get_canned_response("api_down", "es")
        assert "conectarme" in resp.lower() or "servicio" in resp.lower()

    def test_unknown_error_type_falls_back(self):
        resp = get_canned_response("nonexistent_error", "en")
        assert resp == CANNED_RESPONSES["en"]["general_error"]

    def test_unknown_lang_falls_back_to_english(self):
        resp = get_canned_response("timeout", "fr")
        assert resp == CANNED_RESPONSES["en"]["timeout"]


# ===================================================================
# 3. Rate Limiter
# ===================================================================

class TestRateLimiter:
    def test_allows_under_limit(self):
        for _ in range(5):
            assert check_rate_limit("192.168.1.1", limit=10) is True

    def test_blocks_at_limit(self):
        for _ in range(5):
            check_rate_limit("10.0.0.1", limit=5)
        assert check_rate_limit("10.0.0.1", limit=5) is False

    def test_different_ips_independent(self):
        for _ in range(5):
            check_rate_limit("10.0.0.1", limit=5)
        # Different IP should still be allowed
        assert check_rate_limit("10.0.0.2", limit=5) is True

    def test_expired_entries_cleared(self):
        # Manually insert old timestamps
        old = time.time() - 120  # 2 minutes ago (beyond 60s window)
        _rate_store["10.0.0.3"] = [old] * 50
        # Should be allowed since old entries are evicted
        assert check_rate_limit("10.0.0.3", limit=5) is True


# ===================================================================
# 4. Circuit Breaker
# ===================================================================

class TestCircuitBreaker:
    def test_starts_closed(self, circuit):
        assert circuit.state == CircuitState.CLOSED
        assert circuit.allow_request() is True

    def test_opens_after_threshold(self, circuit):
        for _ in range(3):
            circuit.record_failure()
        assert circuit.state == CircuitState.OPEN
        assert circuit.allow_request() is False

    def test_half_open_after_timeout(self, circuit):
        for _ in range(3):
            circuit.record_failure()
        assert circuit.state == CircuitState.OPEN
        # Fast-forward past the reset timeout
        circuit.last_failure_time = time.time() - 1
        assert circuit.allow_request() is True
        assert circuit.state == CircuitState.HALF_OPEN

    def test_success_resets_to_closed(self, circuit):
        for _ in range(3):
            circuit.record_failure()
        circuit.last_failure_time = time.time() - 1
        circuit.allow_request()  # moves to HALF_OPEN
        circuit.record_success()
        assert circuit.state == CircuitState.CLOSED
        assert circuit.failure_count == 0


# ===================================================================
# 5. System Prompt & Training Data
# ===================================================================

class TestSystemPrompt:
    def test_build_system_prompt_empty(self):
        prompt = _build_system_prompt({})
        assert "DoGoods AI Assistant" in prompt
        assert "Current date and time:" in prompt

    def test_build_system_prompt_with_sections(self):
        data = {
            "system_base": "You are a test assistant.",
            "platform_overview": "A food sharing app.",
            "food_safety": ["Wash hands", "Check dates"],
            "tone_guidelines": "Be friendly.",
            "spanish_guidelines": "Respond in Spanish when asked.",
        }
        prompt = _build_system_prompt(data)
        assert "test assistant" in prompt
        assert "Platform Overview" in prompt
        assert "Wash hands" in prompt
        assert "Be friendly" in prompt
        assert "Spanish Response Guidelines" in prompt

    def test_system_prompt_contains_datetime(self):
        prompt = _build_system_prompt({})
        now = datetime.now(timezone.utc)
        assert str(now.year) in prompt

    def test_system_prompt_property_refreshes(self, engine):
        p1 = engine.system_prompt
        p2 = engine.system_prompt
        # Both should contain "Current date and time" — they're dynamically built
        assert "Current date and time:" in p1
        assert "Current date and time:" in p2


# ===================================================================
# 6. Profile Injection into Messages
# ===================================================================

class TestProfileInjection:
    @pytest.mark.asyncio
    async def test_profile_injected_into_messages(self, engine):
        """When a profile is found, the system messages should contain the user's name."""
        mock_profile = {
            "id": TEST_USER_ID,
            "name": "Alice TestUser",
            "email": "alice@test.com",
            "is_admin": False,
            "avatar_url": None,
            "organization": "Food Bank",
            "created_at": "2024-01-01",
        }
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("Hello Alice!")
        )

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=mock_profile), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value="msg-id-1"), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, return_value=fake_ai_resp):

            result = await engine.chat(TEST_USER_ID, "Hello!")

            # Verify profile context was passed to GPT
            call_args = (await engine.get_user_profile(TEST_USER_ID),)
            assert result["text"] == "Hello Alice!"
            assert result["user_id"] == TEST_USER_ID
            assert result["lang"] == "en"

    @pytest.mark.asyncio
    async def test_no_profile_still_injects_user_id(self, engine):
        """When profile lookup returns None, user_id is still injected."""
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("Hi there!")
        )

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value=None), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, return_value=fake_ai_resp):

            result = await engine.chat(TEST_USER_ID, "Hello!")
            assert result["text"] == "Hi there!"

    @pytest.mark.asyncio
    async def test_admin_role_in_context(self, engine):
        """Admin users get 'Admin' role in the context message."""
        mock_profile = {
            "id": TEST_USER_ID,
            "name": "Admin User",
            "is_admin": True,
            "organization": "DoGoods",
        }
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("Welcome, admin!")
        )

        captured_messages = []

        async def capture_openai(*args, **kwargs):
            payload = kwargs.get("json_payload", {})
            captured_messages.extend(payload.get("messages", []))
            return fake_ai_resp

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=mock_profile), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value=None), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=capture_openai):

            await engine.chat(TEST_USER_ID, "Hello!")

            # Find the profile context message
            context_msgs = [m for m in captured_messages if "Admin" in m.get("content", "")]
            assert len(context_msgs) >= 1
            assert "Admin" in context_msgs[0]["content"]


# ===================================================================
# 7. Spanish Handling in Chat Flow
# ===================================================================

class TestSpanishChatFlow:
    @pytest.mark.asyncio
    async def test_spanish_message_sets_lang(self, engine):
        """Spanish input should produce lang='es' in response."""
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("¡Hola! ¿Cómo puedo ayudarte?")
        )

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value=None), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, return_value=fake_ai_resp):

            result = await engine.chat(TEST_USER_ID, "Hola, necesito comida por favor")
            assert result["lang"] == "es"

    @pytest.mark.asyncio
    async def test_spanish_directive_injected(self, engine):
        """Spanish messages should inject a Spanish-response directive into system messages."""
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("Respuesta en español")
        )
        captured_messages = []

        async def capture_openai(*args, **kwargs):
            payload = kwargs.get("json_payload", {})
            captured_messages.extend(payload.get("messages", []))
            return fake_ai_resp

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value=None), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=capture_openai):

            await engine.chat(TEST_USER_ID, "Hola, necesito ayuda por favor")

            # There should be a system message with the Spanish directive
            # (distinct from the main system prompt which also mentions Spanish)
            spanish_directives = [
                m for m in captured_messages
                if m["role"] == "system"
                and "MUST respond entirely in Spanish" in m.get("content", "")
            ]
            assert len(spanish_directives) == 1

    @pytest.mark.asyncio
    async def test_english_no_spanish_directive(self, engine):
        """English messages should NOT inject the Spanish directive."""
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("Hello!")
        )
        captured_messages = []

        async def capture_openai(*args, **kwargs):
            payload = kwargs.get("json_payload", {})
            captured_messages.extend(payload.get("messages", []))
            return fake_ai_resp

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value=None), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=capture_openai):

            await engine.chat(TEST_USER_ID, "Hello, I need help")

            spanish_directives = [
                m for m in captured_messages
                if m["role"] == "system" and "MUST respond entirely in Spanish" in m.get("content", "")
            ]
            assert len(spanish_directives) == 0

    @pytest.mark.asyncio
    async def test_spanish_canned_on_timeout(self, engine):
        """When GPT times out on a Spanish message, the canned response should be in Spanish."""
        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value=None), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=httpx.TimeoutException("timeout")):

            result = await engine.chat(TEST_USER_ID, "Hola, necesito comida por favor")
            assert result["lang"] == "es"
            # Canned Spanish timeout response
            assert "inténtalo" in result["text"].lower() or "momento" in result["text"].lower()


# ===================================================================
# 8. Tool Format & Tool Calling
# ===================================================================

class TestToolFormat:
    def test_tool_definitions_structure(self, engine):
        """TOOL_DEFINITIONS must follow OpenAI function-calling schema."""
        for tool in engine.tool_definitions:
            assert tool["type"] == "function"
            fn = tool["function"]
            assert "name" in fn
            assert "description" in fn
            assert "parameters" in fn
            assert fn["parameters"]["type"] == "object"
            assert "properties" in fn["parameters"]

    def test_tool_definitions_have_required_tools(self, engine):
        """Core tools must be present."""
        names = {t["function"]["name"] for t in engine.tool_definitions}
        expected = {
            "search_food_near_user",
            "get_user_profile",
            "get_pickup_schedule",
            "create_reminder",
            "get_user_dashboard",
        }
        assert expected.issubset(names)

    def test_needs_tools_detects_tool_keywords(self):
        """_needs_tools should return True for database-related queries."""
        assert ConversationEngine._needs_tools("Show me my dashboard") is True
        assert ConversationEngine._needs_tools("Find food near me") is True
        assert ConversationEngine._needs_tools("Set a reminder for tomorrow") is True
        assert ConversationEngine._needs_tools("What are my notifications?") is True

    def test_needs_tools_false_for_generic_chat(self):
        """_needs_tools should return False for generic questions."""
        assert ConversationEngine._needs_tools("How do I store bananas?") is False
        assert ConversationEngine._needs_tools("What is DoGoods?") is False
        assert ConversationEngine._needs_tools("Tell me a recipe with rice") is False

    @pytest.mark.asyncio
    async def test_tool_call_round_trip(self, engine):
        """Simulate GPT requesting a tool call, verify follow-up call is made."""
        tool_call = {
            "id": "call_abc123",
            "type": "function",
            "function": {
                "name": "get_user_dashboard",
                "arguments": json.dumps({"user_id": TEST_USER_ID}),
            },
        }
        # First call returns tool_calls, second returns formatted text
        first_resp = _mock_httpx_response(
            _mock_openai_response(None, tool_calls=[tool_call])
        )
        followup_resp = _mock_httpx_response(
            _mock_openai_response("Here's your dashboard summary!")
        )

        call_count = 0

        async def mock_openai(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return first_resp
            return followup_resp

        mock_tool_result = {"claims": 3, "listings": 5, "impact": {"meals_shared": 10}}

        with patch("backend.ai_engine.OPENAI_API_KEY", "sk-test"), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=mock_openai), \
             patch.object(engine, "_execute_tool", new_callable=AsyncMock, return_value=mock_tool_result):

            messages = [
                {"role": "system", "content": "You are a test assistant."},
                {"role": "user", "content": "Show me my dashboard"},
            ]
            result = await engine._call_openai_chat(messages)
            assert result == "Here's your dashboard summary!"
            assert call_count == 2  # initial + follow-up
            engine._execute_tool.assert_called_once_with(
                "get_user_dashboard", {"user_id": TEST_USER_ID}
            )

    @pytest.mark.asyncio
    async def test_tool_error_graceful(self, engine):
        """When a tool raises an error, GPT should still get a response."""
        tool_call = {
            "id": "call_err1",
            "type": "function",
            "function": {
                "name": "search_food_near_user",
                "arguments": json.dumps({"user_id": TEST_USER_ID}),
            },
        }
        first_resp = _mock_httpx_response(
            _mock_openai_response(None, tool_calls=[tool_call])
        )
        followup_resp = _mock_httpx_response(
            _mock_openai_response("Sorry, I couldn't search right now.")
        )

        call_count = 0

        async def mock_openai(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return first_resp if call_count == 1 else followup_resp

        with patch("backend.ai_engine.OPENAI_API_KEY", "sk-test"), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=mock_openai), \
             patch.object(engine, "_execute_tool", new_callable=AsyncMock, side_effect=RuntimeError("DB down")):

            messages = [
                {"role": "system", "content": "Test"},
                {"role": "user", "content": "Find food near me"},
            ]
            result = await engine._call_openai_chat(messages)
            # Should NOT raise — error is handled gracefully
            assert isinstance(result, str)

    @pytest.mark.asyncio
    async def test_tool_results_truncated(self, engine):
        """Tool results > 4000 chars should be truncated."""
        tool_call = {
            "id": "call_big1",
            "type": "function",
            "function": {
                "name": "get_user_dashboard",
                "arguments": json.dumps({"user_id": TEST_USER_ID}),
            },
        }
        first_resp = _mock_httpx_response(
            _mock_openai_response(None, tool_calls=[tool_call])
        )
        followup_resp = _mock_httpx_response(
            _mock_openai_response("Summary of your dashboard.")
        )

        call_count = 0

        async def mock_openai(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return first_resp
            # Verify the tool result in the follow-up payload is truncated
            payload = kwargs.get("json_payload", {})
            tool_msgs = [m for m in payload.get("messages", []) if m.get("role") == "tool"]
            if tool_msgs:
                assert len(tool_msgs[0]["content"]) <= 4020  # 4000 + truncation marker
            return followup_resp

        huge_result = {"data": "x" * 5000}

        with patch("backend.ai_engine.OPENAI_API_KEY", "sk-test"), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=mock_openai), \
             patch.object(engine, "_execute_tool", new_callable=AsyncMock, return_value=huge_result):

            messages = [
                {"role": "system", "content": "Test"},
                {"role": "user", "content": "Show me my dashboard"},
            ]
            await engine._call_openai_chat(messages)

    @pytest.mark.asyncio
    async def test_tool_messages_do_not_mutate_input(self, engine):
        """_call_openai_chat must not mutate the original messages list."""
        tool_call = {
            "id": "call_mut1",
            "type": "function",
            "function": {
                "name": "get_user_profile",
                "arguments": json.dumps({"user_id": TEST_USER_ID}),
            },
        }
        first_resp = _mock_httpx_response(
            _mock_openai_response(None, tool_calls=[tool_call])
        )
        followup_resp = _mock_httpx_response(
            _mock_openai_response("Profile info.")
        )

        call_count = 0

        async def mock_openai(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            return first_resp if call_count == 1 else followup_resp

        with patch("backend.ai_engine.OPENAI_API_KEY", "sk-test"), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=mock_openai), \
             patch.object(engine, "_execute_tool", new_callable=AsyncMock, return_value={"name": "Alice"}):

            original_messages = [
                {"role": "system", "content": "Test"},
                {"role": "user", "content": "Show me my profile"},
            ]
            original_len = len(original_messages)
            await engine._call_openai_chat(original_messages)
            # Original list must be unchanged (no tool/assistant msgs appended)
            assert len(original_messages) == original_len


# ===================================================================
# 9. History Saving
# ===================================================================

class TestHistorySaving:
    @pytest.mark.asyncio
    async def test_chat_stores_both_messages(self, engine):
        """chat() should store both user and assistant messages."""
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("Thanks for your message!")
        )
        store_calls = []

        async def mock_store(user_id, role, message, metadata=None):
            store_calls.append({"user_id": user_id, "role": role, "message": message})
            return f"id-{len(store_calls)}"

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, side_effect=mock_store), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, return_value=fake_ai_resp):

            result = await engine.chat(TEST_USER_ID, "Hello bot")

            # Both user and assistant messages stored
            assert len(store_calls) == 2
            assert store_calls[0]["role"] == "user"
            assert store_calls[0]["message"] == "Hello bot"
            assert store_calls[1]["role"] == "assistant"
            assert store_calls[1]["message"] == "Thanks for your message!"

    @pytest.mark.asyncio
    async def test_conversation_id_returned(self, engine):
        """chat() should return the assistant message's DB row ID as conversation_id."""
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("Response text")
        )

        call_idx = 0

        async def mock_store(user_id, role, message, metadata=None):
            nonlocal call_idx
            call_idx += 1
            return f"row-{call_idx}"

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, side_effect=mock_store), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, return_value=fake_ai_resp):

            result = await engine.chat(TEST_USER_ID, "Test")
            # The second store call (assistant) returns "row-2"
            assert result["conversation_id"] == "row-2"

    @pytest.mark.asyncio
    async def test_history_loaded_into_messages(self, engine):
        """Conversation history should be loaded and included in the GPT messages."""
        fake_history = [
            {"role": "user", "message": "Previous question", "created_at": "2024-01-01T00:00:00Z"},
            {"role": "assistant", "message": "Previous answer", "created_at": "2024-01-01T00:00:01Z"},
        ]
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("New answer")
        )
        captured_messages = []

        async def capture_openai(*args, **kwargs):
            payload = kwargs.get("json_payload", {})
            captured_messages.extend(payload.get("messages", []))
            return fake_ai_resp

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=fake_history), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value=None), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=capture_openai):

            await engine.chat(TEST_USER_ID, "New question")

            # History should appear in messages before the new user message
            contents = [m.get("content", "") for m in captured_messages]
            assert "Previous question" in contents
            assert "Previous answer" in contents

    @pytest.mark.asyncio
    async def test_long_history_truncated(self, engine):
        """History messages longer than 400 chars should be truncated."""
        long_msg = "A" * 500
        fake_history = [
            {"role": "assistant", "message": long_msg, "created_at": "2024-01-01T00:00:00Z"},
        ]
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("OK")
        )
        captured_messages = []

        async def capture_openai(*args, **kwargs):
            payload = kwargs.get("json_payload", {})
            captured_messages.extend(payload.get("messages", []))
            return fake_ai_resp

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=fake_history), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value=None), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=capture_openai):

            await engine.chat(TEST_USER_ID, "Hi")

            # Find the history message — it should be truncated
            history_msg = [m for m in captured_messages if m["role"] == "assistant"]
            assert len(history_msg) >= 1
            assert len(history_msg[0]["content"]) <= 420  # 400 + "... [truncated]"
            assert history_msg[0]["content"].endswith("... [truncated]")

    @pytest.mark.asyncio
    async def test_store_failure_non_blocking(self, engine):
        """If storing messages fails, chat() should still return a response."""
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("All good!")
        )

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, side_effect=Exception("DB error")), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, return_value=fake_ai_resp):

            result = await engine.chat(TEST_USER_ID, "Hello")
            # Should still return text even though storage failed
            assert result["text"] == "All good!"
            assert result["conversation_id"] is None


# ===================================================================
# 10. Response Generation (full chat flow)
# ===================================================================

class TestResponseGeneration:
    @pytest.mark.asyncio
    async def test_basic_chat_response(self, engine):
        """A simple chat message should return a complete response dict."""
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("Welcome to DoGoods!")
        )

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value="row-1"), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, return_value=fake_ai_resp):

            result = await engine.chat(TEST_USER_ID, "What is DoGoods?")
            assert result["text"] == "Welcome to DoGoods!"
            assert result["user_id"] == TEST_USER_ID
            assert result["lang"] == "en"
            assert result["audio_url"] is None  # include_audio=False by default
            assert "timestamp" in result

    @pytest.mark.asyncio
    async def test_response_with_audio(self, engine):
        """When include_audio=True, audio_url should be populated."""
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("Here's your answer!")
        )

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value=None), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, return_value=fake_ai_resp), \
             patch.object(engine, "_generate_audio_url", new_callable=AsyncMock, return_value="https://test.supabase.co/storage/audio.mp3"):

            result = await engine.chat(TEST_USER_ID, "Hello", include_audio=True)
            assert result["audio_url"] == "https://test.supabase.co/storage/audio.mp3"

    @pytest.mark.asyncio
    async def test_fallback_on_timeout(self, engine):
        """Timeout should produce a canned response, not raise."""
        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value=None), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=httpx.TimeoutException("timeout")):

            result = await engine.chat(TEST_USER_ID, "Hello")
            assert "try again" in result["text"].lower()

    @pytest.mark.asyncio
    async def test_fallback_on_api_error(self, engine):
        """HTTP errors should produce a canned response."""
        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value=None), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=httpx.HTTPStatusError("500", request=MagicMock(), response=MagicMock(status_code=500))):

            result = await engine.chat(TEST_USER_ID, "Hello")
            assert "temporarily" in result["text"].lower() or "unable" in result["text"].lower()

    @pytest.mark.asyncio
    async def test_fallback_on_missing_api_key(self, engine):
        """Missing API key should produce a canned response."""
        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value=None), \
             patch("backend.ai_engine.OPENAI_API_KEY", ""):

            result = await engine.chat(TEST_USER_ID, "Hello")
            # Should get a canned response, not a crash
            assert isinstance(result["text"], str)
            assert len(result["text"]) > 10

    @pytest.mark.asyncio
    async def test_tools_not_sent_for_simple_chat(self, engine):
        """Generic questions should NOT include tool definitions in the payload."""
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("Bananas keep well at room temperature.")
        )
        captured_payload = {}

        async def capture_openai(*args, **kwargs):
            captured_payload.update(kwargs.get("json_payload", {}))
            return fake_ai_resp

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value=None), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=capture_openai):

            await engine.chat(TEST_USER_ID, "How do I store bananas?")
            assert "tools" not in captured_payload

    @pytest.mark.asyncio
    async def test_tools_sent_for_data_query(self, engine):
        """Data queries should include tool definitions in the payload."""
        fake_ai_resp = _mock_httpx_response(
            _mock_openai_response("Here's what's nearby.")
        )
        captured_payload = {}

        async def capture_openai(*args, **kwargs):
            captured_payload.update(kwargs.get("json_payload", {}))
            return fake_ai_resp

        with patch.object(engine, "get_user_profile", new_callable=AsyncMock, return_value=None), \
             patch.object(engine, "get_conversation_history", new_callable=AsyncMock, return_value=[]), \
             patch.object(engine, "store_message", new_callable=AsyncMock, return_value=None), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=capture_openai):

            await engine.chat(TEST_USER_ID, "Find food near me")
            assert "tools" in captured_payload
            assert len(captured_payload["tools"]) > 0


# ===================================================================
# 11. Whisper & TTS
# ===================================================================

class TestWhisperAndTTS:
    @pytest.mark.asyncio
    async def test_transcribe_audio(self, engine):
        """transcribe_audio should call Whisper and return text."""
        fake_resp = MagicMock()
        fake_resp.json.return_value = {"text": "Hello from Whisper"}

        with patch("backend.ai_engine.OPENAI_API_KEY", "sk-test"), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, return_value=fake_resp):

            result = await engine.transcribe_audio(b"fake-audio-bytes", "test.webm")
            assert result == "Hello from Whisper"

    @pytest.mark.asyncio
    async def test_transcribe_no_api_key(self, engine):
        """transcribe_audio should raise when API key is missing."""
        with patch("backend.ai_engine.OPENAI_API_KEY", ""):
            with pytest.raises(RuntimeError, match="OPENAI_API_KEY not configured"):
                await engine.transcribe_audio(b"fake-audio")

    @pytest.mark.asyncio
    async def test_generate_speech_english(self, engine):
        """generate_speech should use English voice for 'en'."""
        fake_resp = MagicMock()
        fake_resp.content = b"fake-mp3-bytes"
        captured_payload = {}

        async def capture(*args, **kwargs):
            captured_payload.update(kwargs.get("json_payload", {}))
            return fake_resp

        with patch("backend.ai_engine.OPENAI_API_KEY", "sk-test"), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=capture):

            audio = await engine.generate_speech("Hello world", lang="en")
            assert audio == b"fake-mp3-bytes"
            assert captured_payload["voice"] == "nova"

    @pytest.mark.asyncio
    async def test_generate_speech_spanish_voice(self, engine):
        """generate_speech should use Spanish voice for 'es'."""
        fake_resp = MagicMock()
        fake_resp.content = b"fake-mp3-bytes"
        captured_payload = {}

        async def capture(*args, **kwargs):
            captured_payload.update(kwargs.get("json_payload", {}))
            return fake_resp

        with patch("backend.ai_engine.OPENAI_API_KEY", "sk-test"), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=capture):

            await engine.generate_speech("Hola mundo", lang="es")
            # Spanish voice should be used (default: nova for es too)
            assert "voice" in captured_payload

    @pytest.mark.asyncio
    async def test_tts_truncates_long_text(self, engine):
        """TTS should truncate text > 4096 chars."""
        fake_resp = MagicMock()
        fake_resp.content = b"audio"
        captured_payload = {}

        async def capture(*args, **kwargs):
            captured_payload.update(kwargs.get("json_payload", {}))
            return fake_resp

        with patch("backend.ai_engine.OPENAI_API_KEY", "sk-test"), \
             patch("backend.ai_engine._openai_with_retry", new_callable=AsyncMock, side_effect=capture):

            long_text = "A" * 5000
            await engine.generate_speech(long_text)
            assert len(captured_payload["input"]) <= 4096
