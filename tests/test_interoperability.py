"""API-level coverage for the demo-only interoperability network workflow."""
from fastapi.testclient import TestClient

from app import interoperability
from app.main import app


def _client(monkeypatch, tmp_path):
    monkeypatch.setattr(interoperability, "_STORE_PATH", tmp_path / "interop-state.json")
    return TestClient(app)


def test_dashboard_is_backend_derived_and_labels_disconnected_demo_participants(monkeypatch, tmp_path):
    with _client(monkeypatch, tmp_path) as client:
        response = client.get("/api/v1/interoperability/dashboard")
        openapi = client.get("/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert data["demo_only"] is True
    assert data["participant_counts"]["verified_connected"] == 0
    assert data["participant_counts"]["total"] == data["participant_counts"]["demo_not_connected"]
    assert data["exchangeable_records"] == 3
    assert data["schema_versions"] == ["1.0"]
    assert all(item["status"] == "demo_not_connected" for item in data["participants"])
    assert all("lat" not in item and "lon" not in item for item in data["participants"])
    assert "/api/v1/interoperability/exchanges" in openapi.json()["paths"]


def test_existing_network_navigation_now_serves_the_working_exchange_experience(monkeypatch, tmp_path):
    with _client(monkeypatch, tmp_path) as client:
        page = client.get("/")
        legacy_network = client.get("/api/network")
    assert page.status_code == 200
    assert 'id="view-network"' in page.text
    assert "AgriNet Interoperability Network" in page.text
    assert "interop-record-select" in page.text
    assert "interop-panel-developer" in page.text
    assert legacy_network.status_code == 200
    assert legacy_network.json()["states"]


def test_successful_cross_state_exchange_persists_record_and_source_provenance(monkeypatch, tmp_path):
    with _client(monkeypatch, tmp_path) as client:
        validation = client.post("/api/v1/interoperability/validate", json={
            "source_participant_id": "punjab", "destination_participant_id": "uttarakhand",
            "record_id": "practice-pb-cover-001", "resource_type": "practice",
        })
        exchange = client.post("/api/v1/interoperability/exchanges", json={
            "source_participant_id": "punjab", "destination_participant_id": "uttarakhand",
            "record_id": "practice-pb-cover-001", "resource_type": "practice",
        })
        dashboard = client.get("/api/v1/interoperability/dashboard").json()
        records = client.get("/api/v1/interoperability/records", params={"state": "Uttarakhand"}).json()
        detail = client.get(f"/api/v1/interoperability/records/{exchange.json()['exchange_record_id']}")
    assert validation.json()["accepted"] is True
    result = exchange.json()
    assert result["accepted"] is True
    assert result["status"] == "accepted"
    assert result["source"]["name"] == "Punjab"
    assert result["destination"]["name"] == "Uttarakhand"
    assert result["provenance_preserved"] is True
    assert result["record"]["provenance"][0]["source"] == "AgriNet synthetic demonstration fixture"
    assert result["warnings"][0]["code"] == "requires_local_review"
    assert dashboard["exchanges"] == 1 and dashboard["accepted_exchanges"] == 1
    assert any(item["exchange_status"] == "accepted" for item in records["items"])
    assert detail.status_code == 200
    assert detail.json()["provenance"] == result["record"]["provenance"]
    assert detail.json()["sharing"]["farmer_data"] is False


def test_validation_and_exchange_reject_incomplete_observation_with_audited_result(monkeypatch, tmp_path):
    with _client(monkeypatch, tmp_path) as client:
        payload = {"source_participant_id": "punjab", "destination_participant_id": "uttarakhand",
                   "record_id": "obs-pb-draft-002", "resource_type": "observation"}
        validation = client.post("/api/v1/interoperability/validate", json=payload).json()
        exchange = client.post("/api/v1/interoperability/exchanges", json=payload).json()
        dashboard = client.get("/api/v1/interoperability/dashboard").json()
        destination_records = client.get("/api/v1/interoperability/records", params={"state": "Uttarakhand"}).json()
    assert validation["accepted"] is False
    missing_fields = {issue["field"] for issue in validation["issues"]}
    assert "payload.evidence.unit" in missing_fields
    assert "payload.evidence.source" in missing_fields
    assert exchange["accepted"] is False
    assert exchange["status"] == "rejected"
    assert exchange["provenance_preserved"] is False
    assert dashboard["exchanges"] == 1 and dashboard["accepted_exchanges"] == 0
    assert any(event["event_type"] == "exchange" and event["status"] == "rejected"
               for event in dashboard["recent_activity"])
    assert not any(item.get("exchange_id") for item in destination_records["items"])


def test_complete_observation_uses_existing_evidence_fields_and_keeps_source_date(monkeypatch, tmp_path):
    with _client(monkeypatch, tmp_path) as client:
        response = client.post("/api/v1/interoperability/exchanges", json={
            "source_participant_id": "punjab", "destination_participant_id": "uttarakhand",
            "record_id": "obs-pb-ndvi-001", "resource_type": "observation",
        })
    result = response.json()
    evidence = result["record"]["payload"]["evidence"]
    assert result["accepted"] is True
    assert evidence["id"] == "SAT-NDVI-001"
    assert evidence["date"] == "2026-09-14"
    assert evidence["source"] == "Sentinel-2 demo fixture"
    assert {"id", "type", "indicator", "value", "unit", "source", "date", "interpretation", "confidence"} <= set(evidence)


def test_demo_reset_restores_seeded_state_and_requires_confirmation(monkeypatch, tmp_path):
    with _client(monkeypatch, tmp_path) as client:
        exchange = client.post("/api/v1/interoperability/exchanges", json={
            "source_participant_id": "punjab", "destination_participant_id": "uttarakhand",
            "record_id": "obs-pb-ndvi-001", "resource_type": "observation",
        })
        denied = client.post("/api/v1/interoperability/reset", json={"confirmation": "reset"})
        reset = client.post("/api/v1/interoperability/reset", json={"confirmation": "RESET DEMO"})
        dashboard = client.get("/api/v1/interoperability/dashboard").json()
    assert exchange.json()["accepted"] is True
    assert denied.status_code == 400
    assert reset.json()["reset"] is True
    assert dashboard["exchanges"] == 0
    assert dashboard["accepted_exchanges"] == 0
    assert dashboard["exchangeable_records"] == 3


def test_record_explorer_filters_and_paginates(monkeypatch, tmp_path):
    with _client(monkeypatch, tmp_path) as client:
        filtered = client.get("/api/v1/interoperability/records", params={
            "state": "Punjab", "district": "Ludhiana", "crop": "Rice",
            "resource_type": "observation", "page": 1, "page_size": 1,
        }).json()
        no_match = client.get("/api/v1/interoperability/records", params={"q": "not-a-resource"}).json()
    assert filtered["total"] == 2
    assert filtered["pages"] == 2
    assert len(filtered["items"]) == 1
    assert no_match["total"] == 0 and no_match["items"] == []


def test_practice_discovery_marks_cross_region_knowledge_unvalidated(monkeypatch, tmp_path):
    with _client(monkeypatch, tmp_path) as client:
        response = client.get("/api/v1/interoperability/practices")
    assert response.status_code == 200
    assert response.json()["items"]
    assert all(item["demo"] is True for item in response.json()["items"])
    assert all(item["local_validation"] == "not_validated_in_destination"
               for item in response.json()["items"])
    assert "validation" in response.json()["note"].lower()
