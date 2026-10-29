"""
AgriNet India — Digital Public Good Prototype API.
Interoperable agricultural network with field intelligence, health scoring,
and evidence-grounded Gemini AI advisory.
"""
import asyncio
import logging
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
import json
import typing
import os

class UJSONResponse(JSONResponse):
    media_type = "application/json; charset=utf-8"
    
    def render(self, content: typing.Any) -> bytes:
        return json.dumps(
            content,
            ensure_ascii=False,
            allow_nan=False,
            indent=None,
            separators=(",", ":"),
        ).encode("utf-8")

from dotenv import load_dotenv

# Local `uvicorn app.main:app` runs do not read .env on their own; without this, EE_PROJECT and
# GEMINI_API_KEY are unset and every live location falls back to "unknown". Real env vars take precedence.
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=False)

from . import geo, data_sources as ds, ai, field_state as fs, field_health as fh, scenarios, conversation, evidence_quality, interoperability

log = logging.getLogger("agrinet")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Warm up Earth Engine in the background so the first live analysis is not slowed by its init."""
    threading.Thread(target=geo.warm_up, name="ee-warmup", daemon=True).start()
    yield


app = FastAPI(title="AgriNet India", version="0.1", description="Interoperable agro-advisory API (digital public good prototype)", default_response_class=UJSONResponse, lifespan=lifespan)
app.include_router(interoperability.router)
STATIC = Path(__file__).resolve().parent.parent / "static"

#
# ─── V1 DATA MODELS ──────────────────────────────────────────
#
class AnalyzeRequest(BaseModel):
    lat: float
    lon: float
    lang: str = "en"
    crop: str = ""
    is_demo: bool = False
    scenario_key: str = ""

class AdvisoryRequestV1(BaseModel):
    field_state: dict
    evidence: list
    lang: str = "en"

class ConversationRequest(BaseModel):
    session_id: str = Field(min_length=16, max_length=80)
    lang: str = "en"
    answer: str = Field(default="", max_length=500)
    location: dict | None = None

class ConversationControlRequest(BaseModel):
    session_id: str = Field(min_length=16, max_length=80)
    lang: str = "en"
    action: typing.Literal["repeat", "back", "edit_location", "edit_crop", "edit_symptoms", "edit_irrigation", "start_over", "analyze_now"]

@app.post("/api/v1/conversation")
async def conversation_v1(r: ConversationRequest):
    """Advance a short-lived agricultural conversation without sharing state across sessions."""
    return conversation.advance(r.session_id, r.lang, r.answer, r.location)

@app.post("/api/v1/conversation/control")
async def conversation_control_v1(r: ConversationControlRequest):
    """Control or revisit the current guided step while preserving this farmer's context."""
    return conversation.control(r.session_id, r.lang, r.action)

class EvidenceQualityRequest(BaseModel):
    field_state: dict

@app.post("/api/v1/evidence-quality")
async def evidence_quality_v1(r: EvidenceQualityRequest):
    """Return freshness and limitations for currently available field observations."""
    return evidence_quality.assess(r.field_state)

class FollowUpRequest(BaseModel):
    field_state: dict
    evidence: list
    question: str = Field(min_length=1, max_length=500)
    lang: str = "en"

@app.post("/api/v1/follow-up")
async def follow_up_v1(r: FollowUpRequest):
    """Answer a short follow-up grounded in the latest analyzed field context."""
    if not ai.is_available():
        return {"answer": "AI follow-up is unavailable. Review the displayed field evidence or ask a local agricultural expert."}
    compact = fs.field_state_for_gemini(r.field_state)
    try:
        answer = await asyncio.wait_for(asyncio.to_thread(ai.followup_answer, compact, r.evidence, r.question, r.lang), timeout=25)
        return {"answer": answer}
    except asyncio.TimeoutError:
        return {"answer": "The answer took too long. Please try again or review the displayed field evidence."}
    except Exception as exc:
        log.warning("Gemini follow-up error: %s", type(exc).__name__)
        return {"answer": "The AI service is unavailable. Please review the displayed field evidence or ask a local agricultural expert."}

_voice_token_uses: dict[str, list[float]] = {}

@app.post("/api/v1/voice-session")
async def voice_session_v1(request: Request):
    """Provision a single-use, short-lived Gemini Live token without exposing the API key."""
    model = os.getenv("GEMINI_LIVE_MODEL", "").strip()
    if not ai.is_available() or not model:
        raise HTTPException(503, "Gemini Live is not configured; use browser speech or text instead.")
    now = time.time()
    ip = request.client.host if request.client else "unknown"
    if len(_voice_token_uses) > 1024:
        _voice_token_uses.clear()
    recent = [stamp for stamp in _voice_token_uses.get(ip, []) if now - stamp < 60]
    if len(recent) >= 6:
        raise HTTPException(429, "Too many voice sessions. Please wait one minute and try again.")
    recent.append(now)
    _voice_token_uses[ip] = recent
    try:
        token = await asyncio.wait_for(asyncio.to_thread(
            ai.live_client().auth_tokens.create,
            config=ai.live_token_config(model.removeprefix("models/")),
        ), timeout=12)
        name = getattr(token, "name", None)
        if not name:
            raise RuntimeError("Token response did not include a token name")
        return {"token": name, "model": model, "expires_in_seconds": 300}
    except asyncio.TimeoutError as exc:
        raise HTTPException(503, "Voice credential service timed out. Browser speech and text remain available.") from exc
    except Exception as exc:
        log.warning("Gemini Live token provisioning failed: %s", type(exc).__name__)
        raise HTTPException(503, "Gemini Live is unavailable. Browser speech and text remain available.") from exc

@app.get("/api/v1/locations")
async def locations_v1(q: str = Query(min_length=2, max_length=120)):
    """Search real geocoding results for a manually entered Indian village or place."""
    result = await ds.geocode_location(q.strip())
    if not result["available"]:
        raise HTTPException(503, "Place search is temporarily unavailable. Choose the field directly on the map or enter coordinates.")
    return result


QUOTA_MESSAGE = "The Gemini API quota for this key is used up. Please try again later or configure a key with a higher quota."


async def _land_with_deadline(lat: float, lon: float) -> dict:
    """Return EO results promptly when a remote Earth Engine request stalls."""
    try:
        # geo bounds its Earth Engine query itself (and keeps Planet results); this is a final safety net.
        return await asyncio.wait_for(asyncio.to_thread(geo.analyze_land, lat, lon), timeout=geo.EE_TIMEOUT_S + 6)
    except asyncio.TimeoutError:
        return {"source": "none", "land_cover": "unknown", "note": "Earth observation query timed out."}

#
# ─── MIDDLEWARE FOR FALLBACK HANDLING ────────────────────────
#
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = time.perf_counter() - start
    response.headers["X-Process-Time"] = f"{elapsed:.3f}"
    if request.url.path.startswith("/api/"):
        log.info("%s %s -> %s in %.2fs", request.method, request.url.path, response.status_code, elapsed)
    return response

#
# ─── NEW V1 API ENDPOINTS ─────────────────────────────────────
#
@app.post("/api/v1/analyze")
async def analyze_v1(p: AnalyzeRequest):
    """
    V1 Analyze: Returns the complete Field State and Evidence Bundle.
    This is the core interoperable contract.
    """
    if p.scenario_key:
        scen = scenarios.get_scenario(p.scenario_key)
        if scen:
            # Reconstruct field state from scenario
            fs_data = fs.assemble_field_state(
                scen["lat"], scen["lon"], scen["land"],
                scen["weather"], scen["soil"],
                crop=scen["crop"], is_demo=True,
                scenario_key=p.scenario_key
            )
            return {
                "field_state": fs_data,
                "evidence": fs_data.get("evidence", []),
                "provenance": fs_data.get("provenance", {}),
                "is_demo": True
            }
        raise HTTPException(404, "Scenario not found")

    if not (6 <= p.lat <= 38 and 67 <= p.lon <= 98):
        raise HTTPException(400, "Location is outside India")

    # Fetch data concurrently; catch failures gracefully inside ds modules
    land, wx, soil = await asyncio.gather(
        _land_with_deadline(p.lat, p.lon),
        ds.weather(p.lat, p.lon),
        ds.soil(p.lat, p.lon)
    )

    # Assemble and return the complete field state contract
    fs_data = fs.assemble_field_state(
        p.lat, p.lon, land, wx, soil, crop=p.crop, is_demo=p.is_demo
    )
    return {
        "field_state": fs_data,
        "evidence": fs_data.get("evidence", []),
        "provenance": fs_data.get("provenance", {}),
        "is_demo": p.is_demo
    }

@app.post("/api/v1/advisory")
async def advisory_v1(r: AdvisoryRequestV1):
    """
    V1 Advisory: Gemini reasoning over the structured Field State and Evidence.
    """
    land_cover = r.field_state.get("land_cover") or {}
    health = r.field_state.get("health") or {}
    cover_class = land_cover.get("class") if isinstance(land_cover, dict) else land_cover
    if fh.is_water_cover(cover_class) or health.get("status") == "no_land_detected":
        return {"summary": "No land detected at this location.", "field_condition": "AI advisory is unavailable for water bodies.", "risks": [], "recommendations": [], "regenerative_actions": [], "crop_options": [], "confidence_note": "No land detected."}

    if not ai.is_available():
        # Fallback if Gemini key is missing
        return {
            "summary": "AI reasoning is currently unavailable. Displaying deterministic field evidence.",
            "field_condition": "Offline mode active.",
            "risks": [], "recommendations": [],
            "regenerative_actions": [], "crop_options": [],
            "confidence_note": "API Key missing or service offline."
        }
    
    compact_fs = fs.field_state_for_gemini(r.field_state)
    compact_fs["evidence_quality"] = evidence_quality.assess(r.field_state)
    # Evidence is passed separately below; omitting its duplicate from field state
    # keeps the Gemini request smaller and reduces advisory latency.
    compact_fs.pop("evidence", None)
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(ai.advisory_v2, compact_fs, r.evidence, r.lang),
            timeout=45,
        )
    except asyncio.TimeoutError:
        return {
            "summary": "AI advisory is taking longer than expected. Please try again.",
            "field_condition": "Analysis timed out.",
            "risks": [], "recommendations": [],
            "regenerative_actions": [], "crop_options": [],
            "confidence_note": "The AI provider did not respond before the request deadline."
        }
    except Exception as e:
        # Don't crash; return a graceful fallback advisory
        log.warning("Gemini advisory failed (%s, status=%s)", type(e).__name__, ai._error_code(e))
        quota = ai.is_quota_error(e)
        return {
            "summary": QUOTA_MESSAGE if quota else "AI reasoning temporarily unavailable.",
            "field_condition": "Service error occurred.",
            "risks": [{"risk": "Service Connectivity", "reason": "AI provider quota exhausted." if quota else "Could not reach AI provider.", "evidence_ids": []}],
            "recommendations": [], "regenerative_actions": [], "crop_options": [],
            "confidence_note": "Fallback state activated due to generation error."
        }

SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"}


def _image_mime(data: bytes, declared: str | None) -> str | None:
    """Return the image MIME type from its magic bytes, falling back to the declared type.

    Phones often upload HEIC photos or send an empty/octet-stream content type; sniffing the
    bytes keeps those working instead of rejecting them. Returns None for unsupported files.
    """
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if data[4:8] == b"ftyp":
        brand = data[8:12]
        if brand in (b"heic", b"heix", b"hevc", b"heim", b"heis"):
            return "image/heic"
        if brand in (b"mif1", b"msf1", b"heif"):
            return "image/heif"
    declared = (declared or "").lower()
    return declared if declared in SUPPORTED_IMAGE_TYPES else None


@app.post("/api/v1/diagnose")
async def diagnose_v1(
    image: UploadFile = File(...),
    lang: str = Form("en"),
    crop: str = Form(""),
    field_context_json: str = Form("")
):
    """
    V1 Diagnose: Multimodal crop disease assessment with optional field context.
    """
    data = await image.read()
    if len(data) > 8_000_000:
        raise HTTPException(413, "Image too large (max 8 MB)")
    if not data:
        raise HTTPException(400, "Image is empty")
    mime = _image_mime(data, image.content_type)
    if mime is None:
        raise HTTPException(415, "Unsupported image format")

    context = None
    if field_context_json:
        import json
        try:
            context = json.loads(field_context_json)
        except:
            pass # Ignore invalid JSON
            
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(ai.diagnose, data, mime, lang, crop, context),
            timeout=35,
        )
    except asyncio.TimeoutError:
        return {
            "healthy": False,
            "likely_issue": "Diagnosis timed out",
            "diagnosis": "Image analysis took too long. Please try again with a smaller, clearer image.",
            "confidence": "low",
            "observed_symptoms": [], "recommended_action": [],
            "expert_escalation": "Please consult a local agricultural expert if the issue persists."
        }
    except Exception as e:
        log.warning("Gemini diagnosis failed (%s, status=%s)", type(e).__name__, ai._error_code(e))
        return {
            "healthy": False,
            "likely_issue": "AI Diagnosis Unavailable",
            "diagnosis": QUOTA_MESSAGE if ai.is_quota_error(e) else "Could not complete diagnosis due to service error.",
            "confidence": "low",
            "observed_symptoms": [], "recommended_action": [],
            "expert_escalation": "Please consult a local expert."
        }

@app.get("/api/v1/manifest")
def manifest_v1():
    """V1 DPG Manifest: Expanded interoperability contract."""
    return {
        "network_id": "agrinet-india",
        "schema_version": "1.0",
        "type": "Digital Public Good Prototype",
        "license": "CC-BY-4.0 (data) / Apache-2.0 (code)",
        "capabilities": [
            "Satellite Intelligence (PlanetScope, Sentinel-2)",
            "Soil Health (SoilGrids)",
            "Weather Risk (Open-Meteo)",
            "Deterministic Field Health Scoring",
            "Contextual SPEAR Earth Observation",
            "AI Advisory (Google Gemini)",
            "Multimodal Crop Doctor"
        ],
        "endpoints": {
            "analyze": "/api/v1/analyze (Field State Generation)",
            "advisory": "/api/v1/advisory (Evidence-grounded Reasoning)"
        },
        "supported_languages": list(ai.LANGS.keys()),
        "data_abstractions": [
            "State Data Adapter Plugin Model",
            "Common Field State Schema",
            "Evidence Bundle Standard"
        ]
    }

@app.get("/api/scenarios")
def api_scenarios():
    """List available demo scenarios."""
    return {"scenarios": scenarios.list_scenarios()}

@app.get("/api/network")
def api_network():
    """List network nodes/states."""
    return {"states": scenarios.NETWORK_STATES}


#
# ─── LEGACY ENDPOINTS (PRESERVED FOR BACKWARD COMPATIBILITY) ─
#
class Plot(BaseModel):
    lat: float
    lon: float
    lang: str = "en"

@app.get("/api/health")
def health(): return {"ok": True, "ai_configured": ai.is_available()}

@app.get("/health/earth-engine", tags=["health"])
def ee_health():
    """Lightweight Earth Engine health endpoint.

    Returns both static SDK/configuration information and a live connectivity
    check via ``geo.ee_health()``. No credential values or exception traces are
    exposed.
    """
    return geo.ee_health()


@app.post("/api/analyze")
async def analyze(p: Plot):
    if not (6 <= p.lat <= 38 and 67 <= p.lon <= 98): raise HTTPException(400, "Location is outside India")
    land, wx, soil = await asyncio.gather(_land_with_deadline(p.lat, p.lon), ds.weather(p.lat, p.lon), ds.soil(p.lat, p.lon))
    return {"location": {"lat": p.lat, "lon": p.lon}, "land": land, "weather": wx, "soil": soil}

class AdvisoryReq(BaseModel):
    context: dict
    lang: str = "en"

@app.post("/api/advisory")
async def advisory(r: AdvisoryReq):
    ctx = dict(r.context)
    if "land" in ctx:
        land = {k: v for k, v in ctx["land"].items() if k != "ndvi_series" and k != "ndwi_series"}
        land["ndvi_last_5"] = ctx["land"].get("ndvi_series", [])[-5:]
        ctx["land"] = land
    if "weather" in ctx: ctx["weather"] = {k: v for k, v in ctx["weather"].items() if k in ("past7_rain_mm", "next7_rain_mm", "error")} | {"tmax_next7": ctx["weather"].get("tmax", [])[7:], "rain_next7": ctx["weather"].get("rain_mm", [])[7:]}
    try: return await asyncio.to_thread(ai.advisory, ctx, r.lang)
    except Exception as e:
        log.warning("Legacy Gemini advisory failed (%s, status=%s)", type(e).__name__, ai._error_code(e))
        raise HTTPException(502, "Gemini advisory is temporarily unavailable.") from e

@app.post("/api/diagnose")
async def diagnose(image: UploadFile = File(...), lang: str = Form("en"), crop: str = Form("")):
    data = await image.read()
    if len(data) > 8_000_000: raise HTTPException(413, "Image too large (max 8 MB)")
    try: return await asyncio.to_thread(ai.diagnose, data, image.content_type or "image/jpeg", lang, crop)
    except Exception as e:
        log.warning("Legacy Gemini diagnosis failed (%s, status=%s)", type(e).__name__, ai._error_code(e))
        raise HTTPException(502, "Gemini diagnosis is temporarily unavailable.") from e

@app.get("/api/dpg/manifest")
def manifest():
    return manifest_v1() # Point to new manifest


#
# ─── FRONTEND MOUNT ──────────────────────────────────────────
#
app.mount("/static", StaticFiles(directory=STATIC), name="static")

@app.get("/")
def index(): return FileResponse(STATIC / "index.html")
