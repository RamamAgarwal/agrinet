"""Mocked tests for paid Gemini configuration, bounded calls, and multimodal inputs."""
import json

import httpx
from google.genai import errors

from app import ai


def test_default_flash_model_and_api_key_stay_server_side(monkeypatch):
    captured = {}

    class FakeClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setenv("GEMINI_API_KEY", "server-secret-test")
    monkeypatch.setattr(ai.genai, "Client", FakeClient)
    monkeypatch.setattr(ai, "_client", None)
    if not __import__("os").getenv("GEMINI_MODEL"):
        assert ai.MODEL == "gemini-3.8-flash"
    ai.client()
    assert captured["api_key"] == "server-secret-test"
    assert captured["http_options"].timeout == ai.HTTP_TIMEOUT_MS
    assert ai.HTTP_TIMEOUT_MS == 30_000


def test_live_client_uses_at_least_gemini_minimum_deadline(monkeypatch):
    captured = {}

    class FakeClient:
        def __init__(self, **kwargs):
            captured.update(kwargs)

    monkeypatch.setenv("GEMINI_API_KEY", "server-secret-test")
    monkeypatch.setattr(ai.genai, "Client", FakeClient)
    monkeypatch.setattr(ai, "_live_client", None)
    ai.live_client()
    assert captured["http_options"].timeout == ai.LIVE_HTTP_TIMEOUT_MS
    assert ai.LIVE_HTTP_TIMEOUT_MS >= 10_000


def test_advisory_and_crop_photo_use_configured_model(monkeypatch):
    monkeypatch.setattr(ai, "MODEL", "gemini-3.8-flash")
    calls = []
    response_text = json.dumps({"summary": "Evidence reviewed", "what_the_data_shows": [],
                                "priority_risks": [], "immediate_actions": [], "soil_management": [],
                                "water_management": [], "weather_response": [], "crop_management": [],
                                "regenerative_actions": [], "crop_options": [], "monitoring_plan": [],
                                "why_this_advice": [], "when_to_seek_expert_help": "", "confidence_note": "low"})

    class Response:
        text = response_text

    def generate(contents, config=None):
        calls.append((contents, config))
        return Response()

    monkeypatch.setattr(ai, "_generate", generate)
    ai._advisory_cache.clear()
    advisory = ai.advisory_v2({"field": {"crop": "wheat"}}, [], "en")
    assert advisory["summary"] == "Evidence reviewed"
    assert calls[0][1].max_output_tokens == 2048

    ai._diagnosis_cache.clear()
    photo_result = json.dumps({"healthy": True, "diagnosis": "No clear problem visible", "confidence": "low",
                               "observed_symptoms": [], "recommended_action": [], "expert_escalation": ""})
    class PhotoResponse:
        text = photo_result
    def photo_generate(contents, config=None):
        calls.append((contents, config))
        return PhotoResponse()
    monkeypatch.setattr(ai, "_generate", photo_generate)
    ai.diagnose(b"same-photo", "image/jpeg", "en", "wheat")
    parts, config = calls[-1]
    assert parts[0].inline_data.mime_type == "image/jpeg"
    assert parts[0].inline_data.data == b"same-photo"
    assert config.max_output_tokens == 2048


def test_transient_429_respects_retry_after_then_succeeds(monkeypatch):
    waits, calls = [], []
    response = httpx.Response(429, headers={"Retry-After": "1"})
    rate_error = errors.ClientError(429, {"error": {"message": "rate limited"}}, response)

    class Models:
        def generate_content(self, **kwargs):
            calls.append(kwargs)
            if len(calls) == 1:
                raise rate_error
            return "success"
    class Client:
        models = Models()
    monkeypatch.setattr(ai, "client", lambda: Client())
    monkeypatch.setattr(ai, "MODEL", "gemini-2.0-flash")
    monkeypatch.setattr(ai.time, "sleep", waits.append)
    monkeypatch.setattr(ai.random, "uniform", lambda a, b: .1)
    assert ai._generate("prompt") == "success"
    assert len(calls) == 2
    assert waits == [1.0]


def test_quota_and_billing_errors_are_not_retried(monkeypatch):
    calls = []
    quota = errors.ClientError(429, {"error": {"message": "Daily quota exceeded"}})
    class Models:
        def generate_content(self, **kwargs):
            calls.append(kwargs)
            raise quota
    class Client:
        models = Models()
    monkeypatch.setattr(ai, "client", lambda: Client())
    monkeypatch.setattr(ai, "MODEL", "gemini-2.0-flash")
    assert ai.is_quota_error(quota)
    try:
        ai._generate("prompt")
    except errors.ClientError:
        pass
    else:
        raise AssertionError("quota failures should propagate to the safe route fallback")
    assert len(calls) == 1


def test_server_error_retries_with_bounded_attempts(monkeypatch):
    calls = []
    transient = errors.ServerError(503, {"error": {"message": "temporarily unavailable"}})
    class Models:
        def generate_content(self, **kwargs):
            calls.append(kwargs)
            raise transient
    class Client:
        models = Models()
    monkeypatch.setattr(ai, "client", lambda: Client())
    monkeypatch.setattr(ai, "MODEL", "gemini-2.0-flash")
    monkeypatch.setattr(ai.time, "sleep", lambda _: None)
    monkeypatch.setattr(ai.random, "uniform", lambda a, b: 0)
    try:
        ai._generate("prompt")
    except errors.ServerError:
        pass
    assert len(calls) == ai.MAX_GENERATION_ATTEMPTS


def test_slow_504_retries_when_retry_after_fits_the_bounded_budget(monkeypatch):
    calls, waits = [], []
    response = httpx.Response(504, headers={"Retry-After": "1"})
    gateway_timeout = errors.ServerError(504, {"error": {"message": "gateway timeout"}}, response)

    class Models:
        def generate_content(self, **kwargs):
            calls.append(kwargs)
            if len(calls) == 1:
                raise gateway_timeout
            return "recovered"
    class Client:
        models = Models()

    ticks = iter((0.0, 9.5))
    monkeypatch.setattr(ai, "client", lambda: Client())
    monkeypatch.setattr(ai.time, "monotonic", lambda: next(ticks))
    monkeypatch.setattr(ai.time, "sleep", waits.append)
    monkeypatch.setattr(ai, "MODEL", "gemini-3.8-flash")
    assert ai._generate("prompt") == "recovered"
    assert len(calls) == 2
    assert waits == [1.0]


def test_followup_reuses_identical_result_without_second_model_call(monkeypatch):
    calls = []
    class Response:
        text = "Check the leaves and share a clear photo if symptoms continue."
    def generate(*args, **kwargs):
        calls.append(args)
        return Response()
    monkeypatch.setattr(ai, "_generate", generate)
    ai._followup_cache.clear()
    args = ({"field": {"crop": "wheat"}}, [], "What should I do first?", "en")
    first = ai.followup_answer(*args)
    second = ai.followup_answer(*args)
    assert first == second
    assert len(calls) == 1
