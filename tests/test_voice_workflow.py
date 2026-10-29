"""Tests for the voice workflow, source quality checks, and secure token fallback."""
from datetime import datetime, timedelta, timezone
import asyncio

from fastapi.testclient import TestClient

from app import conversation, data_sources, evidence_quality, main


def test_location_is_explicitly_confirmed_and_validated():
    result = conversation.advance("session-location-001", "en")
    assert result["needs_location"] is True
    conversation.advance("session-location-001", "en")
    denied = conversation.advance("session-location-001", "en", location={"lat": 2, "lon": 14})
    assert denied["needs_location"] is True
    assert "India" in denied["error"]
    confirmed = conversation.advance("session-location-001", "en", location={"lat": 28.6, "lon": 77.2})
    assert confirmed["stage"] == "crop"
    assert confirmed["field"]["location_confirmed"] is True


def test_conversation_transitions_skip_and_independent_sessions():
    conversation.advance("session-workflow-001", "en")
    conversation.advance("session-workflow-002", "hi")
    a = conversation.advance("session-workflow-001", "en", location={"lat": 20, "lon": 78})
    b = conversation.advance("session-workflow-002", "hi", location={"lat": 21, "lon": 79})
    assert a["stage"] == "crop"
    assert b["stage"] == "crop"
    crop = conversation.advance("session-workflow-001", "en", "wheat")
    assert crop["stage"] == "symptoms"
    ready = conversation.advance("session-workflow-001", "en", "healthy")
    assert ready["stage"] == "ready"
    assert ready["field"]["crop"] == "wheat"
    assert conversation.get_field("session-workflow-002").get("crop") is None


def test_conversation_controls_repeat_back_edit_and_analyze_without_losing_other_sessions():
    session = "session-dynamic-voice-001"
    other = "session-dynamic-voice-002"
    conversation.advance(session, "en")
    conversation.advance(session, "en", location={"lat": 20, "lon": 78})
    conversation.advance(session, "en", "wheat")
    conversation.advance(session, "en", "healthy")
    conversation.advance(other, "en")

    repeated = conversation.control(session, "en", "repeat")
    assert repeated["stage"] == "ready"
    assert repeated["field"]["crop"] == "wheat"
    back = conversation.control(session, "en", "back")
    assert back["stage"] == "symptoms"
    edit_crop = conversation.control(session, "en", "edit_crop")
    assert edit_crop["stage"] == "crop"
    assert "symptoms" not in edit_crop["field"]
    assert conversation.get_field(other) == {}

    analyze = conversation.control(session, "en", "analyze_now")
    assert analyze["field_ready"] is True
    assert analyze["field"]["lat"] == 20
    change_location = conversation.control(session, "en", "edit_location")
    assert change_location["needs_location"] is True
    assert "lat" not in change_location["field"]
    assert "crop" not in change_location["field"]
    restarted = conversation.control(session, "en", "start_over")
    assert restarted["stage"] == "location"
    assert restarted["field"] == {}


def test_hindi_prompt_and_unsupported_language_falls_back_to_english():
    hindi = conversation.advance("session-hi-0000001", "hi")
    assert "नमस्ते" in hindi["prompt"]
    fallback = conversation.advance("session-mr-0000001", "mr")
    assert fallback["prompt"].startswith("Hello")


def test_evidence_quality_distinguishes_missing_stale_and_fresh_sources():
    missing = evidence_quality.assess({})
    assert missing["satellite"]["available"] is False
    assert missing["weather"]["available"] is False
    assert missing["soil"]["available"] is False
    stale_date = (datetime.now(timezone.utc).date() - timedelta(days=100)).isoformat()
    stale = evidence_quality.assess({
        "land_cover": {"source": "earth_engine_live", "observed": stale_date},
        "vegetation": {"ndvi_series": [{"date": stale_date, "ndvi": 0.4, "cloud_percent": 15}]},
        "weather": {"status": "available", "retrieved_at": "2000-01-01T00:00:00+00:00"},
        "soil": {"status": "available", "retrieved_at": "2026-10-28T00:00:00+00:00"},
    })
    assert stale["satellite"]["fresh"] is False
    assert stale["satellite"]["cloud_percent"] == 15
    assert stale["weather"]["fresh"] is False
    assert stale["field_specific_advice_supported"] is False
    fresh_date = datetime.now(timezone.utc).date().isoformat()
    fresh = evidence_quality.assess({
        "land_cover": {"source": "earth_engine_live", "observed": fresh_date},
        "vegetation": {"ndvi_series": [{"date": fresh_date, "ndvi": 0.4}]},
        "weather": {"status": "available", "retrieved_at": datetime.now(timezone.utc).isoformat()},
    })
    assert fresh["satellite"]["fresh"] is True
    assert fresh["weather"]["fresh"] is True
    assert "cannot identify" in fresh["satellite"]["limitation"]


def test_evidence_quality_marks_cloud_masked_or_absent_ndvi_unavailable():
    quality = evidence_quality.assess({
        "land_cover": {"source": "earth_engine_live", "observed": "2026-10-25",
                       "scene_cloud_filter_percent": 60, "scl_cloud_shadow_masking": True},
        "vegetation": {"ndvi_series": []},
    })
    assert quality["satellite"]["available"] is True
    assert quality["vegetation_index"]["available"] is False
    assert quality["vegetation_index"]["cloud_shadow_masking"] is True
    assert quality["field_specific_advice_supported"] is False


def test_voice_session_is_unavailable_without_configuration(monkeypatch):
    monkeypatch.delenv("GEMINI_LIVE_MODEL", raising=False)
    with TestClient(main.app) as client:
        response = client.post("/api/v1/voice-session")
    assert response.status_code == 503
    assert "browser speech" in response.json()["detail"]


def test_voice_session_uses_single_use_short_expiry_token(monkeypatch):
    class Tokens:
        def create(self, config):
            self.config = config
            return type("Token", (), {"name": "auth_tokens/example"})()

    class Client:
        auth_tokens = Tokens()

    sdk_client = Client()
    monkeypatch.setenv("GEMINI_LIVE_MODEL", "gemini-live-configured")
    monkeypatch.setattr(main.ai, "is_available", lambda: True)
    monkeypatch.setattr(main.ai, "live_client", lambda: sdk_client)
    main._voice_token_uses.clear()
    with TestClient(main.app) as client:
        response = client.post("/api/v1/voice-session")
    assert response.status_code == 200
    assert response.json()["token"] == "auth_tokens/example"
    config = sdk_client.auth_tokens.config
    assert config.uses == 1
    token_field = next(name for name in ("live_constrained_parameters", "live_connect_constraints", "live_ephemeral_parameters")
                       if name in type(config).model_fields)
    params = getattr(config, token_field)
    assert params.model == "gemini-live-configured"
    assert params.config is None
    assert config.new_session_expire_time <= config.expire_time


def test_live_token_provider_failure_returns_safe_fallback(monkeypatch):
    class Tokens:
        def create(self, config):
            raise RuntimeError("invalid credential: do-not-disclose")
    class Client:
        auth_tokens = Tokens()
    monkeypatch.setenv("GEMINI_LIVE_MODEL", "gemini-3.8-live")
    monkeypatch.setattr(main.ai, "is_available", lambda: True)
    monkeypatch.setattr(main.ai, "live_client", lambda: Client())
    with TestClient(main.app) as client:
        response = client.post("/api/v1/voice-session")
    assert response.status_code == 503
    assert "do-not-disclose" not in response.text


def test_conversation_endpoint_and_existing_route_contracts_remain_available():
    with TestClient(main.app) as client:
        response = client.post("/api/v1/conversation", json={"session_id": "api-session-000001", "lang": "en"})
        control = client.post("/api/v1/conversation/control", json={"session_id": "api-session-000001", "lang": "en", "action": "repeat"})
        manifest = client.get("/api/v1/manifest")
        health = client.get("/api/health")
    assert response.status_code == 200
    assert control.status_code == 200
    assert control.json()["stage"] == "location"
    assert response.json()["stage"] == "location"
    assert manifest.status_code == 200
    assert health.status_code == 200


def test_diagnosis_upload_rejects_unsupported_image_and_analyze_rejects_outside_india():
    with TestClient(main.app) as client:
        upload = client.post("/api/v1/diagnose", files={"image": ("leaf.txt", b"not an image", "text/plain")})
        coordinates = client.post("/api/v1/analyze", json={"lat": 2, "lon": 50})
    assert upload.status_code == 415
    assert coordinates.status_code == 400
    assert coordinates.json()["detail"] == "Location is outside India"


def test_diagnosis_upload_enforces_size_limit():
    with TestClient(main.app) as client:
        response = client.post("/api/v1/diagnose", files={"image": ("leaf.png", b"x" * 8_000_001, "image/png")})
    assert response.status_code == 413


def test_manual_place_search_returns_only_valid_indian_results(monkeypatch):
    payload = {"results": [
        {"name": "Village A", "admin1": "State A", "country_code": "IN", "latitude": 20.0, "longitude": 78.0},
        {"name": "Outside India", "country_code": "NP", "latitude": 27.0, "longitude": 85.0},
        {"name": "Invalid India result", "country_code": "IN", "latitude": 45.0, "longitude": 78.0},
    ]}

    class Response:
        def raise_for_status(self):
            pass

        def json(self):
            return payload

    class Client:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return None

        async def get(self, *args, **kwargs):
            return Response()

    monkeypatch.setattr(data_sources.httpx, "AsyncClient", lambda **kwargs: Client())
    result = asyncio.run(data_sources.geocode_location("village"))
    assert result["available"] is True
    assert len(result["locations"]) == 1
    assert result["locations"][0]["name"] == "Village A"


def test_stale_evidence_quality_reaches_gemini_prompt_context(monkeypatch):
    observed = {}

    def advisory(field_state, evidence, lang):
        observed.update(field_state)
        return {"summary": "Evidence-aware"}

    monkeypatch.setattr(main.ai, "is_available", lambda: True)
    monkeypatch.setattr(main.ai, "advisory_v2", advisory)
    stale_date = (datetime.now(timezone.utc).date() - timedelta(days=100)).isoformat()
    field_state = {
        "field": {"lat": 20, "lon": 78, "crop": "wheat"},
        "land_cover": {"class": "crops", "is_cropland": True, "source": "earth_engine_live", "observed": stale_date},
        "vegetation": {"ndvi": 0.4, "ndwi": None, "ndvi_series": [{"date": stale_date, "ndvi": 0.4}], "ndwi_series": []},
        "weather": {"status": "unavailable"}, "soil": {"status": "unavailable"},
        "health": {"status": "unknown", "score": None}, "evidence": [],
    }
    with TestClient(main.app) as client:
        response = client.post("/api/v1/advisory", json={"field_state": field_state, "evidence": [], "lang": "en"})
    assert response.status_code == 200
    assert observed["evidence_quality"]["satellite"]["fresh"] is False
    assert observed["evidence_quality"]["weather"]["available"] is False


def test_gemini_timeout_and_quota_failures_degrade_gracefully(monkeypatch):
    monkeypatch.setattr(main.ai, "is_available", lambda: True)
    monkeypatch.setattr(main.ai, "advisory_v2", lambda *args: (_ for _ in ()).throw(TimeoutError()))
    field_state = {"field": {"lat": 20, "lon": 78, "crop": ""},
                   "land_cover": {"class": "crops", "is_cropland": True},
                   "vegetation": {"ndvi": None, "ndwi": None, "ndvi_series": [], "ndwi_series": []},
                   "weather": {"status": "unavailable"}, "soil": {"status": "unavailable"},
                   "health": {"score": None}, "evidence": []}
    with TestClient(main.app) as client:
        timeout_response = client.post("/api/v1/advisory", json={"field_state": field_state, "evidence": [], "lang": "en"})
    assert "longer than expected" in timeout_response.json()["summary"].lower()

    monkeypatch.setattr(main.ai, "advisory_v2", lambda *args: (_ for _ in ()).throw(RuntimeError("quota")))
    monkeypatch.setattr(main.ai, "is_quota_error", lambda exc: True)
    with TestClient(main.app) as client:
        quota_response = client.post("/api/v1/advisory", json={"field_state": field_state, "evidence": [], "lang": "en"})
    assert "quota" in quota_response.json()["summary"].lower()


def test_follow_up_degrades_without_gemini_and_does_not_claim_data(monkeypatch):
    monkeypatch.setattr(main.ai, "is_available", lambda: False)
    with TestClient(main.app) as client:
        response = client.post("/api/v1/follow-up", json={
            "field_state": {}, "evidence": [], "question": "Is my crop diseased?", "lang": "en"
        })
    assert response.status_code == 200
    assert "evidence" in response.json()["answer"]
    assert "disease" not in response.json()["answer"].lower()
