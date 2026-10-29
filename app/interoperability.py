"""Demo-only, provenance-preserving agricultural interoperability workflow.

This module is a presentation sandbox, not a real participant registry or government integration.
It reuses the project's evidence record shape for observations and keeps demo exchange history in
an atomic JSON file because the application has no database or existing persistence service.
"""
from __future__ import annotations

import copy
import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field, ValidationError

from . import scenarios

router = APIRouter(prefix="/api/v1/interoperability", tags=["interoperability-demo"])
SCHEMA_VERSIONS = ["1.0"]
RESOURCE_TYPES = ["observation", "practice"]
OBSERVATION_FIELDS = ["id", "type", "indicator", "value", "unit", "source", "date", "interpretation", "confidence"]
PRACTICE_FIELDS = ["title", "description", "applicable_crops", "conditions", "agroecological_context",
                   "supporting_evidence", "limitations", "local_validation"]
ENVELOPE_FIELDS = ["record_id", "schema_version", "resource_type", "origin", "created_at", "payload", "provenance", "sharing"]
_STORE_PATH = Path(__file__).resolve().parent.parent / "data" / "interoperability-demo-state.json"
_STORE_LOCK = threading.RLock()


def _utc_now() -> str:
    """Return an ISO 8601 UTC timestamp suitable for exchange audit events."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _participant_rows() -> list[dict[str, Any]]:
    """Adapt existing state network metadata and add a labeled Uttarakhand demo endpoint."""
    rows = []
    for state in scenarios.NETWORK_STATES:
        rows.append({
            "id": state["id"], "name": state["name"], "code": state["code"],
            "sample_city": state["sample_city"], "agro_zone": state["agro_zone"],
            "crops": sorted({item["crop"] for item in scenarios.SCENARIOS.values()
                             if item.get("state") == state["name"]}),
            "status": "demo_not_connected", "kind": "Demo participant",
            "verified_integration": False,
        })
    rows.append({
        "id": "uttarakhand", "name": "Uttarakhand", "code": "UK",
        "sample_city": "Dehradun", "agro_zone": "Western Himalayan Region",
        "crops": ["Wheat", "Millet"], "status": "demo_not_connected",
        "kind": "Demo participant", "verified_integration": False,
    })
    return rows


PARTICIPANTS = _participant_rows()
_PARTICIPANT_BY_ID = {participant["id"]: participant for participant in PARTICIPANTS}


def _record(record_id: str, kind: str, state: str, district: str, crop: str,
            created_at: str, payload: dict[str, Any], source_label: str) -> dict[str, Any]:
    """Build a clearly synthetic record envelope with source attribution and no farmer data."""
    participant = next(row for row in PARTICIPANTS if row["name"] == state)
    return {
        "record_id": record_id,
        "schema_version": "1.0",
        "resource_type": kind,
        "origin": {"participant_id": participant["id"], "state": state, "district": district},
        "crop": crop,
        "created_at": created_at,
        "payload": payload,
        "provenance": [{"source": source_label, "source_record_id": record_id,
                        "retrieved_at": created_at, "method": "deterministic synthetic demo fixture"}],
        "sharing": {"classification": "public_demo", "basis": "synthetic_demo_data",
                    "farmer_data": False},
        "demo": True,
    }


DEMO_RECORDS = [
    _record("obs-pb-ndvi-001", "observation", "Punjab", "Ludhiana", "Rice",
            "2026-09-14T06:30:00Z", {"evidence": {
                "id": "SAT-NDVI-001", "type": "satellite", "indicator": "NDVI",
                "value": 0.48, "unit": "index (0–1)", "source": "Sentinel-2 demo fixture",
                "date": "2026-09-14", "interpretation": "Synthetic example of moderate vegetation greenness.",
                "confidence": "illustrative",
            }}, "AgriNet synthetic demonstration fixture"),
    _record("practice-pb-cover-001", "practice", "Punjab", "Ludhiana", "Wheat",
            "2026-08-20T10:00:00Z", {"title": "Retain crop residue as soil cover",
                "description": "Keep suitable crop residue on the soil surface to reduce exposure and help conserve moisture.",
                "applicable_crops": ["Wheat", "Maize"],
                "conditions": ["Residue is free of problematic disease or pest carryover", "Local planting equipment can handle surface residue"],
                "agroecological_context": "Illustrative Indo-Gangetic plains example",
                "supporting_evidence": ["General soil-cover principle; no local trial is asserted"],
                "limitations": ["Check local pest pressure, residue availability, and sowing practice"],
                "local_validation": "not_validated_in_destination"},
            "AgriNet synthetic demonstration fixture"),
    _record("obs-pb-draft-002", "observation", "Punjab", "Ludhiana", "Rice",
            "2026-09-20T08:00:00Z", {"evidence": {
                "id": "SAT-NDVI-DRAFT", "type": "satellite", "indicator": "NDVI",
                "value": 0.51, "date": "2026-09-20"}},
            "AgriNet synthetic incomplete-record fixture"),
    _record("practice-uk-millet-001", "practice", "Uttarakhand", "Dehradun", "Millet",
            "2026-07-10T09:00:00Z", {"title": "Use locally suitable millet diversity",
                "description": "Discuss locally adapted millet varieties with a nearby extension worker before sowing.",
                "applicable_crops": ["Millet"],
                "conditions": ["Variety and sowing window confirmed with local extension guidance"],
                "agroecological_context": "Synthetic western Himalayan example",
                "supporting_evidence": ["Demonstration copy only; no trial data supplied"],
                "limitations": ["Not a variety recommendation; verify local suitability"],
                "local_validation": "not_validated_in_destination"},
            "AgriNet synthetic demonstration fixture"),
]

_SEED_ACTIVITY = [
    {"event_id": "seed-1", "event_type": "submission", "status": "demo",
     "summary": "Synthetic Punjab observation made available", "created_at": "2026-09-14T06:30:00Z"},
    {"event_id": "seed-2", "event_type": "discovery", "status": "demo",
     "summary": "Residue-cover practice listed for discovery", "created_at": "2026-08-20T10:00:00Z"},
]


class ExchangeRequest(BaseModel):
    """Select one synthetic source record and a destination demo participant."""
    source_participant_id: str = Field(min_length=2, max_length=80)
    destination_participant_id: str = Field(min_length=2, max_length=80)
    record_id: str = Field(min_length=2, max_length=120)
    resource_type: str | None = Field(default=None, max_length=40)


class ResetRequest(BaseModel):
    """Require an explicit confirmation phrase before resetting demo history."""
    confirmation: str = Field(min_length=5, max_length=40)


class EvidenceRecordV1(BaseModel):
    """Validate the existing immutable evidence fields while retaining its optional additions."""
    model_config = ConfigDict(extra="allow")
    id: str
    type: str
    indicator: str
    value: str | int | float
    unit: str
    source: str
    date: str
    interpretation: str
    confidence: Any = None


class PracticePayloadV1(BaseModel):
    """Validate the demo's versioned practice description and its limitations."""
    title: str
    description: str
    applicable_crops: list[str]
    conditions: list[str]
    agroecological_context: str
    supporting_evidence: list[str]
    limitations: list[str]
    local_validation: str


class ParticipantResponse(BaseModel):
    """Public participant metadata for demo or future registered systems."""
    id: str
    name: str
    code: str
    sample_city: str
    agro_zone: str
    crops: list[str]
    status: str
    kind: str
    verified_integration: bool


class ActivityResponse(BaseModel):
    """Non-sensitive event summary for the network activity feed."""
    event_id: str
    event_type: str
    status: str
    summary: str
    created_at: str
    details: dict[str, Any] = Field(default_factory=dict)


class DashboardResponse(BaseModel):
    """Backend-derived counts and fixture metadata for the network overview."""
    system_health: dict[str, str]
    participants: list[ParticipantResponse]
    participant_counts: dict[str, int]
    schema_versions: list[str]
    resource_types: list[str]
    schemas: dict[str, Any]
    exchangeable_records: int
    exchanges: int
    accepted_exchanges: int
    recent_activity: list[ActivityResponse]
    demo_only: bool
    authentication: str


class ValidationResponse(BaseModel):
    """Field-level source-to-destination schema validation result."""
    accepted: bool
    status: str
    source: dict[str, Any] | None = None
    destination: dict[str, Any] | None = None
    record: dict[str, Any] | None = None
    schema_version: str | None = None
    issues: list[dict[str, str]]
    warnings: list[dict[str, str]]
    mapping: list[dict[str, str]]
    provenance_preserved: bool


class ExchangeResponse(BaseModel):
    """Recorded accepted or rejected synthetic exchange response."""
    exchange_id: str
    exchange_record_id: str | None = None
    accepted: bool
    status: str
    created_at: str
    source: dict[str, Any] | None = None
    destination: dict[str, Any] | None = None
    source_record_id: str
    record: dict[str, Any] | None = None
    schema_version: str | None = None
    warnings: list[dict[str, str]] = Field(default_factory=list)
    issues: list[dict[str, str]] = Field(default_factory=list)
    mapping: list[dict[str, str]] = Field(default_factory=list)
    provenance_preserved: bool


class RecordsResponse(BaseModel):
    """Filtered resource page and pagination metadata."""
    items: list[dict[str, Any]]
    page: int
    page_size: int
    total: int
    pages: int


class PracticesResponse(BaseModel):
    """Practice descriptions available in the synthetic discovery catalogue."""
    items: list[dict[str, Any]]
    note: str


class ResetResponse(BaseModel):
    """Acknowledgement from a successful synthetic-ledger reset."""
    reset: bool
    exchange_count: int
    message: str


def _read_store() -> dict[str, Any]:
    """Read the demo exchange ledger, returning an empty ledger before the first exchange."""
    if not _STORE_PATH.exists():
        return {"exchanges": [], "activity": []}
    with _STORE_PATH.open("r", encoding="utf-8") as stream:
        store = json.load(stream)
    if (not isinstance(store, dict) or not isinstance(store.get("exchanges", []), list)
            or not isinstance(store.get("activity", []), list)):
        raise ValueError("Demo exchange ledger has an invalid structure")
    store.setdefault("activity", [])
    return store


def _write_store(store: dict[str, Any]) -> None:
    """Atomically persist the synthetic demonstration ledger."""
    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary = _STORE_PATH.with_suffix(".tmp")
    temporary.write_text(json.dumps(store, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(_STORE_PATH)


def _activity(store: dict[str, Any], event_type: str, status: str, summary: str,
              details: dict[str, Any] | None = None) -> dict[str, Any]:
    """Append a small audit event without storing private farmer or location information."""
    event = {"event_id": str(uuid.uuid4()), "event_type": event_type, "status": status,
             "summary": summary, "created_at": _utc_now(), "details": details or {}}
    store["activity"].append(event)
    store["activity"] = store["activity"][-200:]
    return event


def _find_source_record(record_id: str) -> dict[str, Any] | None:
    return next((record for record in DEMO_RECORDS if record["record_id"] == record_id), None)


def _validate_exchange(request: ExchangeRequest) -> dict[str, Any]:
    """Validate participant and versioned record compatibility, returning field-level results."""
    issues: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    source = _PARTICIPANT_BY_ID.get(request.source_participant_id)
    destination = _PARTICIPANT_BY_ID.get(request.destination_participant_id)
    record = _find_source_record(request.record_id)
    if source is None:
        issues.append({"code": "unknown_source", "message": "The selected source participant is not registered in this demo."})
    if destination is None:
        issues.append({"code": "unknown_destination", "message": "The selected destination participant is not registered in this demo."})
    if source and destination and source["id"] == destination["id"]:
        issues.append({"code": "same_participant", "message": "Choose two different participants for a cross-state exchange."})
    if record is None:
        issues.append({"code": "unknown_record", "message": "The selected record is not available in the demo catalogue."})
    if source and record and record["origin"]["participant_id"] != source["id"]:
        issues.append({"code": "origin_mismatch", "message": "The record origin does not match the selected source participant."})
    if request.resource_type and record and request.resource_type != record["resource_type"]:
        issues.append({"code": "resource_type_mismatch", "message": "The selected resource type does not match this record."})
    if record and record["schema_version"] not in SCHEMA_VERSIONS:
        issues.append({"code": "unsupported_schema", "message": f"Schema version {record['schema_version']} is not supported."})

    mappings: list[dict[str, str]] = []
    if record:
        payload = record.get("payload", {})
        if record["resource_type"] == "observation":
            evidence = payload.get("evidence") if isinstance(payload, dict) else None
            required = OBSERVATION_FIELDS
            for field in required:
                null_allowed = field == "confidence"
                if (not isinstance(evidence, dict) or field not in evidence
                        or (evidence[field] is None and not null_allowed) or evidence[field] == ""):
                    issues.append({"code": "missing_evidence_field", "field": f"payload.evidence.{field}",
                                   "message": f"Required observation field '{field}' is missing."})
            if isinstance(evidence, dict):
                try:
                    EvidenceRecordV1.model_validate(evidence)
                    datetime.fromisoformat(str(evidence["date"]).replace("Z", "+00:00"))
                except (ValidationError, ValueError, TypeError, KeyError):
                    issues.append({"code": "invalid_evidence_schema", "field": "payload.evidence",
                                   "message": "The observation fields or date do not match schema version 1.0."})
                mappings = [{"source_field": field, "destination_field": field, "action": "preserved"}
                            for field in required if field in evidence]
        elif record["resource_type"] == "practice":
            required = PRACTICE_FIELDS
            for field in required:
                if field not in payload or payload[field] is None or payload[field] == "":
                    issues.append({"code": "missing_practice_field", "field": f"payload.{field}",
                                   "message": f"Required practice field '{field}' is missing."})
            try:
                PracticePayloadV1.model_validate(payload)
            except ValidationError:
                issues.append({"code": "invalid_practice_schema", "field": "payload",
                               "message": "The practice fields do not match schema version 1.0."})
            mappings = [{"source_field": field, "destination_field": field, "action": "preserved"}
                        for field in required if field in payload]
            if destination and source and destination["id"] != source["id"]:
                warnings.append({"code": "requires_local_review",
                                 "message": "Schema compatibility does not validate this practice locally. Seek destination-region extension review."})
        for field in ENVELOPE_FIELDS:
            if field in record:
                mappings.append({"source_field": field, "destination_field": field, "action": "preserved"})

    return {
        "accepted": not issues,
        "status": "valid" if not issues else "rejected",
        "source": source,
        "destination": destination,
        "record": copy.deepcopy(record),
        "schema_version": record.get("schema_version") if record else None,
        "issues": issues,
        "warnings": warnings,
        "mapping": mappings,
        "provenance_preserved": bool(record and record.get("provenance")),
    }


def _records_with_exchanges(store: dict[str, Any]) -> list[dict[str, Any]]:
    """Return source fixtures plus destination copies created by accepted exchanges."""
    records = copy.deepcopy(DEMO_RECORDS)
    for exchange in store["exchanges"]:
        if not exchange.get("accepted"):
            continue
        shared = copy.deepcopy(exchange["record"])
        shared["source_record_id"] = shared["record_id"]
        shared["record_id"] = exchange["exchange_record_id"]
        shared["shared_with"] = exchange["destination"]
        shared["exchange_id"] = exchange["exchange_id"]
        shared["exchange_status"] = "accepted"
        records.append(shared)
    for record in records:
        record["source"] = record.get("provenance", [{}])[0].get("source", "Not attributed")
        if record["resource_type"] == "observation":
            observation_date = record.get("payload", {}).get("evidence", {}).get("date")
            record["freshness"] = {"status": "synthetic_demo", "label": "Demo date · not a current observation",
                                   "observation_date": observation_date}
        else:
            record["freshness"] = {"status": "not_applicable", "label": "Knowledge record; no live measurement"}
        if record.get("exchange_status") == "accepted":
            record["validation_status"] = "accepted_exchange"
        else:
            origin_id = record.get("origin", {}).get("participant_id")
            destination = next(item for item in PARTICIPANTS if item["id"] != origin_id)
            check = _validate_exchange(ExchangeRequest(
                source_participant_id=origin_id, destination_participant_id=destination["id"],
                record_id=record.get("source_record_id", record["record_id"]),
                resource_type=record["resource_type"],
            ))
            record["validation_status"] = "ready_for_demo_validation" if check["accepted"] else "needs_validation"
    return records


@router.get("/dashboard", response_model=DashboardResponse)
def dashboard() -> dict[str, Any]:
    """Return actual demo fixture and exchange-ledger counts for the network dashboard."""
    try:
        with _STORE_LOCK:
            store = _read_store()
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(503, "The demo exchange ledger is unavailable. No exchange was performed.") from exc
    exchangeable_count = 0
    for record in DEMO_RECORDS:
        destination = next(item for item in PARTICIPANTS if item["id"] != record["origin"]["participant_id"])
        check = _validate_exchange(ExchangeRequest(
            source_participant_id=record["origin"]["participant_id"],
            destination_participant_id=destination["id"], record_id=record["record_id"],
            resource_type=record["resource_type"],
        ))
        exchangeable_count += int(check["accepted"])
    return {
        "system_health": {"status": "operational", "label": "AgriNet demo API responding"},
        "participants": PARTICIPANTS,
        "participant_counts": {"total": len(PARTICIPANTS), "verified_connected": 0,
                               "demo_not_connected": len(PARTICIPANTS)},
        "schema_versions": SCHEMA_VERSIONS,
        "resource_types": RESOURCE_TYPES,
        "schemas": {"1.0": {"envelope_required": ENVELOPE_FIELDS,
                             "observation_required": [f"payload.evidence.{item}" for item in OBSERVATION_FIELDS],
                             "practice_required": [f"payload.{item}" for item in PRACTICE_FIELDS]}},
        "exchangeable_records": exchangeable_count,
        "exchanges": len(store["exchanges"]),
        "accepted_exchanges": sum(1 for item in store["exchanges"] if item.get("accepted")),
        "recent_activity": sorted([*_SEED_ACTIVITY, *store["activity"]],
                                  key=lambda item: item["created_at"], reverse=True)[:12],
        "demo_only": True,
        "authentication": "No authentication configured; synthetic demo data only.",
    }


@router.get("/records", response_model=RecordsResponse)
def list_records(
    q: str = Query(default="", max_length=120), state: str = Query(default="", max_length=80),
    district: str = Query(default="", max_length=80), crop: str = Query(default="", max_length=60),
    resource_type: str = Query(default="", max_length=40), date_from: str = Query(default="", max_length=10),
    date_to: str = Query(default="", max_length=10), page: int = Query(default=1, ge=1),
    page_size: int = Query(default=8, ge=1, le=50),
) -> dict[str, Any]:
    """Filter and paginate demo resources without revealing private farmer data."""
    try:
        with _STORE_LOCK:
            records = _records_with_exchanges(_read_store())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(503, "The demo resource catalogue is unavailable.") from exc
    query = q.strip().casefold()
    filtered = []
    for record in records:
        search_text = json.dumps(record, ensure_ascii=False).casefold()
        created_date = str(record.get("created_at", ""))[:10]
        if query and query not in search_text: continue
        if state and state.casefold() not in (record["origin"]["state"].casefold(),
                                               str(record.get("shared_with", {}).get("name", "")).casefold()): continue
        if district and district.casefold() != record["origin"]["district"].casefold(): continue
        if crop and crop.casefold() not in str(record.get("crop", "")).casefold(): continue
        if resource_type and resource_type != record["resource_type"]: continue
        if date_from and created_date < date_from: continue
        if date_to and created_date > date_to: continue
        filtered.append(record)
    filtered.sort(key=lambda item: item["created_at"], reverse=True)
    total = len(filtered)
    start = (page - 1) * page_size
    return {"items": filtered[start:start + page_size], "page": page, "page_size": page_size,
            "total": total, "pages": (total + page_size - 1) // page_size}


@router.get("/records/{record_id}")
def get_record(record_id: str) -> dict[str, Any]:
    """Return one synthetic resource detail by source or exchange record identifier."""
    try:
        with _STORE_LOCK:
            records = _records_with_exchanges(_read_store())
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(503, "The demo resource catalogue is unavailable.") from exc
    record = next((item for item in records if record_id in (item["record_id"], item.get("source_record_id"))), None)
    if record is None:
        raise HTTPException(404, "Resource not found in the demo catalogue.")
    return record


@router.post("/validate", response_model=ValidationResponse)
def validate_exchange(request: ExchangeRequest) -> dict[str, Any]:
    """Validate a source record against destination support and append an audit event."""
    result = _validate_exchange(request)
    try:
        with _STORE_LOCK:
            store = _read_store()
            _activity(store, "validation", "valid" if result["accepted"] else "rejected",
                      f"{request.record_id}: validation {'passed' if result['accepted'] else 'found issues'}",
                      {"record_id": request.record_id, "source": request.source_participant_id,
                       "destination": request.destination_participant_id, "issues": result["issues"]})
            _write_store(store)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(503, "Validation ran, but its audit event could not be recorded.") from exc
    return result


@router.post("/exchanges", response_model=ExchangeResponse)
def run_exchange(request: ExchangeRequest) -> dict[str, Any]:
    """Validate then record a synthetic cross-state exchange with source provenance intact."""
    result = _validate_exchange(request)
    try:
        with _STORE_LOCK:
            store = _read_store()
            exchange_id = f"demo-xchg-{uuid.uuid4().hex[:12]}"
            if result["accepted"]:
                destination_record = copy.deepcopy(result["record"])
                exchange = {
                    "exchange_id": exchange_id, "exchange_record_id": f"{exchange_id}-record",
                    "accepted": True, "status": "accepted", "created_at": _utc_now(),
                    "source": result["source"], "destination": result["destination"],
                    "source_record_id": request.record_id, "record": destination_record,
                    "schema_version": result["schema_version"], "warnings": result["warnings"],
                    "provenance_preserved": result["provenance_preserved"],
                }
                store["exchanges"].append(exchange)
                _activity(store, "exchange", "accepted",
                          f"{result['source']['name']} → {result['destination']['name']}: {request.record_id} accepted",
                          {"exchange_id": exchange_id, "record_id": request.record_id,
                           "source": result["source"]["id"], "destination": result["destination"]["id"]})
            else:
                exchange = {
                    "exchange_id": exchange_id, "accepted": False, "status": "rejected",
                    "created_at": _utc_now(), "source": result["source"],
                    "destination": result["destination"], "source_record_id": request.record_id,
                    "schema_version": result["schema_version"], "issues": result["issues"],
                    "provenance_preserved": False,
                }
                store["exchanges"].append(exchange)
                _activity(store, "exchange", "rejected", f"{request.record_id}: exchange rejected by schema validation",
                          {"exchange_id": exchange_id, "record_id": request.record_id,
                           "issues": result["issues"]})
            store["exchanges"] = store["exchanges"][-200:]
            _write_store(store)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(503, "The exchange result could not be recorded. No successful exchange is reported.") from exc
    return {**exchange, "mapping": result["mapping"], "warnings": result["warnings"],
            "issues": result["issues"]}


@router.get("/practices", response_model=PracticesResponse)
def list_practices() -> dict[str, Any]:
    """Return reusable demo practices with evidence notes and destination-validation limits."""
    practices = []
    for record in DEMO_RECORDS:
        if record["resource_type"] == "practice":
            practices.append({**copy.deepcopy(record["payload"]), "record_id": record["record_id"],
                              "schema_version": record["schema_version"], "origin": record["origin"],
                              "source": record["provenance"][0]["source"], "demo": True})
    return {"items": practices, "note": "Compatibility enables discovery only; destination-region agronomic validation is still required."}


@router.post("/reset", response_model=ResetResponse)
def reset_demo(request: ResetRequest) -> dict[str, Any]:
    """Clear demo exchanges and activity so the presentation can be repeated deterministically."""
    if request.confirmation != "RESET DEMO":
        raise HTTPException(400, "Type RESET DEMO to clear the synthetic exchange ledger.")
    try:
        with _STORE_LOCK:
            _write_store({"exchanges": [], "activity": []})
    except OSError as exc:
        raise HTTPException(503, "The demo ledger could not be reset.") from exc
    return {"reset": True, "exchange_count": 0, "message": "Synthetic exchange history cleared."}
