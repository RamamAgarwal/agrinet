"""
Google Gemini AI integration for AgriNet India.
Responsibilities:
  A. Localized agricultural reasoning over structured evidence
  B. Multilingual advisory generation
  C. Multimodal crop disease assessment
  D. Evidence explanation (WHY traceability)

Gemini receives structured evidence and field state — NOT raw coordinates.
The deterministic Field Health Score is computed by the backend, not Gemini.
"""
import os, json, time, hashlib, logging, random, email.utils
from datetime import datetime, timedelta, timezone
import httpx
from google import genai
from google.genai import types, errors

log = logging.getLogger("agrinet.ai")
MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip() or "gemini-3.8-flash"
LANGS = {"en": "English", "hi": "Hindi", "ta": "Tamil", "te": "Telugu", "bn": "Bengali", "mr": "Marathi",
         "pa": "Punjabi", "gu": "Gujarati", "kn": "Kannada", "ml": "Malayalam"}
# Gemini returns DEADLINE_EXCEEDED when a configured request deadline is too short for generation.
# Keep calls bounded, but allow structured field reasoning more than the 10-second minimum.
HTTP_TIMEOUT_MS = 30_000
LIVE_HTTP_TIMEOUT_MS = 10_000
# Retry a transient failure only when the wait and a complete request still fit the endpoint budget.
RETRY_BUDGET_S = 42.0
MAX_GENERATION_ATTEMPTS = 2
_client = None
_live_client = None
def client():
    global _client
    if _client is None:
        key = os.getenv("GEMINI_API_KEY")
        if not key:
            raise RuntimeError("GEMINI_API_KEY not set")
        options = {"timeout": HTTP_TIMEOUT_MS}
        retry_type = getattr(types, "HttpRetryOptions", None)
        if retry_type is not None:
            # Keep retries in _generate so request deadlines and quota classification stay explicit.
            options["retry_options"] = retry_type(attempts=1)
        _client = genai.Client(api_key=key, http_options=types.HttpOptions(**options))
    return _client


def live_client():
    """Return a short-timeout GenAI client for ephemeral Live token provisioning."""
    global _live_client
    if _live_client is None:
        key = os.getenv("GEMINI_API_KEY")
        if not key:
            raise RuntimeError("GEMINI_API_KEY not set")
        options = {"timeout": LIVE_HTTP_TIMEOUT_MS}
        retry_type = getattr(types, "HttpRetryOptions", None)
        if retry_type is not None:
            options["retry_options"] = retry_type(attempts=1)
        _live_client = genai.Client(api_key=key, http_options=types.HttpOptions(**options))
    return _live_client


LIVE_SYSTEM_INSTRUCTION = (
    "You are only AgriNet India's speech renderer. Do not answer questions or give farming advice. "
    "Speak exactly the text sent by the application in its language, then wait for more text."
)


def live_token_config(model: str):
    """Build a single-use Live token config compatible with current and older supported SDK field names."""
    fields = types.CreateAuthTokenConfig.model_fields
    constrained_field = next((name for name in (
        "live_constrained_parameters", "live_connect_constraints", "live_ephemeral_parameters"
    ) if name in fields), None)
    if constrained_field is None:
        raise RuntimeError("Installed GenAI SDK does not support constrained Live tokens")
    parameters_type = (
        getattr(types, "LiveEphemeralParameters", None)
        or getattr(types, "LiveConnectConstraints", None)
        or getattr(types, "CreateAuthTokenParameters", None)
    )
    if parameters_type is None:
        raise RuntimeError("Installed GenAI SDK does not support constrained Live token parameters")
    # Constrain the ephemeral credential to the selected model. Leave optional
    # setup config to the browser's documented BidiGenerateContentSetup payload;
    # SDK LiveConnectConfig aliases differ from the raw WebSocket wire schema.
    parameters = parameters_type(model=model)
    expires = datetime.now(timezone.utc)
    return types.CreateAuthTokenConfig(
        uses=1,
        expire_time=expires.replace(microsecond=0) + timedelta(minutes=5),
        new_session_expire_time=expires.replace(microsecond=0) + timedelta(minutes=1),
        **{constrained_field: parameters},
    )

def _json(resp):
    t = resp.text.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
    return json.loads(t)

def _thinking_options(model: str) -> list[types.ThinkingConfig | None]:
    """Thinking configs to try, cheapest first. Thinking tokens count against max_output_tokens, so
    unbounded thinking both slows responses and truncates the JSON (a common parse failure)."""
    m = model.lower()
    if m.startswith("gemini-3"):
        # Current stable Gemini 3.8 Flash supports low/medium/high; minimal is invalid.
        if not hasattr(types, "ThinkingLevel"):
            return [None]  # Older SDK: omit optional controls rather than failing the request.
        return [types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW)]
    if "2.5" in m:
        return [types.ThinkingConfig(thinking_budget=128 if "pro" in m else 0), None]
    if not hasattr(types, "ThinkingLevel"):
        return [None]
    low = [types.ThinkingConfig(thinking_level=types.ThinkingLevel.LOW), None]
    return low if "pro" in m else [types.ThinkingConfig(thinking_level=types.ThinkingLevel.MINIMAL)] + low

_thinking_choice = 0  # index into _thinking_options(MODEL); advanced when the model rejects an option

def _error_code(exc: Exception) -> int | None:
    """Return an HTTP status without logging or exposing the provider response."""
    value = getattr(exc, "code", None) or getattr(exc, "status_code", None)
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _error_description(exc: Exception) -> str:
    """Build a local-only error classifier string; never emit it to logs or clients."""
    pieces = [str(exc), str(getattr(exc, "message", "")), str(getattr(exc, "details", ""))]
    response = getattr(exc, "response", None)
    body = getattr(response, "body", None)
    if body:
        pieces.append(str(body))
    return " ".join(pieces).lower().replace("_", " ")


def is_quota_error(e: Exception) -> bool:
    """Identify quota/billing exhaustion that should fall back immediately instead of retrying."""
    code = _error_code(e)
    if code not in (402, 403, 429):
        return False
    text = _error_description(e)
    return any(marker in text for marker in (
        "perday", "per day", "daily quota", "quota exceeded", "quota has been exceeded",
        "billing", "payment required", "spend limit", "billing account", "insufficient quota",
        "quota exceeded", "quota metric",
    ))


def _retry_after_seconds(exc: Exception) -> float | None:
    """Read Retry-After from the SDK's HTTP response when the provider supplies it."""
    response = getattr(exc, "response", None)
    headers = getattr(response, "headers", None)
    raw = headers.get("Retry-After") if headers is not None else None
    if not raw:
        return None
    try:
        return max(0.0, float(raw))
    except (TypeError, ValueError):
        try:
            target = email.utils.parsedate_to_datetime(raw)
            if target.tzinfo is None:
                target = target.replace(tzinfo=timezone.utc)
            return max(0.0, (target - datetime.now(timezone.utc)).total_seconds())
        except (TypeError, ValueError, OverflowError):
            return None


def _is_transient_error(exc: Exception) -> bool:
    """Return true only for bounded-retry HTTP or transport failures."""
    code = _error_code(exc)
    if code == 429:
        return not is_quota_error(exc)
    if code is not None:
        return 500 <= code <= 599
    return isinstance(exc, (httpx.TimeoutException, httpx.NetworkError))

def _generate(contents, config: types.GenerateContentConfig | None = None):
    """Call the configured model with bounded exponential retries for transient provider errors.

    If the model rejects a thinking config (HTTP 400), the next, less restrictive option is used
    for this and all later calls.
    """
    global _thinking_choice
    user_thinking = config is not None and config.thinking_config is not None
    options = _thinking_options(MODEL) if config is not None and not user_thinking else [None]
    started = time.monotonic()
    attempts = 0
    last_error = None
    while True:
        cfg = config
        if config is not None and not user_thinking:
            cfg = config.model_copy(update={"thinking_config": options[min(_thinking_choice, len(options) - 1)]})
        try:
            return client().models.generate_content(model=MODEL, contents=contents, config=cfg)
        except errors.ClientError as e:
            if (e.code == 400 and cfg is not None and cfg.thinking_config is not None and not user_thinking
                    and "think" in str(e).lower() and _thinking_choice < len(options) - 1):
                _thinking_choice += 1
                log.warning("Gemini model %s rejected its thinking setting; retrying with a simpler setting", MODEL)
                continue
            last_error = e
        except (errors.ServerError, httpx.TimeoutException, httpx.NetworkError) as e:
            last_error = e

        attempts += 1
        elapsed = time.monotonic() - started
        if attempts >= MAX_GENERATION_ATTEMPTS or not _is_transient_error(last_error):
            raise last_error
        remaining = RETRY_BUDGET_S - elapsed
        if remaining <= 0:
            raise last_error
        exponential_cap = min(2.0, 0.5 * (2 ** (attempts - 1)))
        retry_after = _retry_after_seconds(last_error)
        delay = retry_after if retry_after is not None else random.uniform(0.1, exponential_cap)
        # Skip a retry that cannot fit both Retry-After/backoff and a full bounded request.
        if delay + HTTP_TIMEOUT_MS / 1000 >= remaining:
            log.warning("Gemini %s retry skipped: Retry-After/backoff and one request exceed the remaining retry budget", MODEL)
            raise last_error
        log.warning("Gemini %s returned a transient HTTP/transport error; retrying attempt %d", MODEL, attempts + 1)
        time.sleep(delay)

# ──────────────────────────────────────────────
# ENHANCED ADVISORY SCHEMA (structured reasoning)
# ──────────────────────────────────────────────

ADVISORY_SCHEMA_V2 = """Return ONLY valid JSON matching this exact schema:
{
  "summary": "str (2-3 sentences, plain language overview of field condition)",
  "field_status": {
    "status": "str (good|monitor|critical)",
    "explanation": "str"
  },
  "what_the_data_shows": [
    {
      "observation": "str (what we see)",
      "evidence_id": "str (MUST be from supplied list)",
      "importance": "str"
    }
  ],
  "priority_risks": [
    {
      "risk": "str",
      "severity": "low|medium|high",
      "evidence": "str",
      "evidence_ids": ["str"],
      "why_it_matters": "str"
    }
  ],
  "immediate_actions": [
    {
      "action": "str",
      "timing": "str",
      "reason": "str",
      "priority": "now|this_week|monitor"
    }
  ],
  "soil_management": [
    {
      "action": "str",
      "reason": "str",
      "timing": "str"
    }
  ],
  "water_management": [
    {
      "action": "str",
      "reason": "str",
      "timing": "str"
    }
  ],
  "weather_response": [
    {
      "condition": "str",
      "action": "str",
      "timing": "str"
    }
  ],
  "crop_management": [
    {
      "action": "str",
      "reason": "str"
    }
  ],
  "regenerative_actions": [
    {
      "practice": "str",
      "how_to_apply": "str",
      "benefit": "str",
      "timing": "str"
    }
  ],
  "crop_options": [
    {
      "crop": "str",
      "suitability": "high|moderate|conditional",
      "reason": "str",
      "conditions": "str"
    }
  ],
  "monitoring_plan": [
    {
      "indicator": "str",
      "what_to_watch": "str",
      "when_to_check": "str",
      "action_if_condition_occurs": "str"
    }
  ],
  "why_this_advice": [
    {
      "recommendation": "str",
      "evidence_ids": ["str"],
      "reasoning": "str"
    }
  ],
  "when_to_seek_expert_help": "str",
  "confidence_note": "str"
}

If any section has no relevant evidence, return an empty list [] for it. Do NOT fabricate missing measurements.
Be concise: at most 3 items per list, and keep each text value to one or two short sentences.
"""

ADVISORY_CONFIG = {"response_mime_type": "application/json", "max_output_tokens": 2048}
if not MODEL.lower().startswith("gemini-3"):
    ADVISORY_CONFIG["temperature"] = 0.3
_advisory_cache: dict = {}
_followup_cache: dict[str, str] = {}

def advisory(ctx: dict, lang: str):
    """Legacy advisory endpoint — works with raw context dict."""
    L = LANGS.get(lang, "English")
    prompt = f"""You are an agronomy advisor for small and marginal farmers in India. Use ONLY the data below; if data is missing or
uncertain, say so and do not invent numbers. Recommend regenerative, low-cost, locally practical options. If the land is not cropland,
say so and advise accordingly. Write every text value only in {L}, preferably in its native script. Do not include English alongside the translation. Keep JSON keys in English.
DATA: {json.dumps(ctx, ensure_ascii=False)}
{ADVISORY_SCHEMA_V2}"""
    r = _generate(contents=prompt,
        config=types.GenerateContentConfig(**ADVISORY_CONFIG))
    return _safe_parse(r)


def advisory_v2(field_state_compact: dict, evidence: list, lang: str):
    """Enhanced advisory: structured evidence-grounded reasoning.

    Args:
        field_state_compact: compact field state from field_state.field_state_for_gemini()
        evidence: list of evidence items
        lang: language code
    """
    L = LANGS.get(lang, "English")
    # Only the fields Gemini reasons over; translation keys and badges just add prompt tokens.
    prompt_evidence = [{k: e.get(k) for k in ("id", "indicator", "value", "unit", "source", "date", "interpretation")}
                       for e in evidence if isinstance(e, dict)]
    evidence_text = json.dumps(prompt_evidence, ensure_ascii=False, default=str)
    field_text = json.dumps(field_state_compact, ensure_ascii=False, default=str)
    cache_key = hashlib.sha256(f"{MODEL}|{lang}|{field_text}|{evidence_text}".encode()).hexdigest()
    if cache_key in _advisory_cache:
        return json.loads(_advisory_cache[cache_key])
    valid_evidence_ids_str = ", ".join([e.get("id", "") for e in evidence if "id" in e])

    prompt = f"""You are an agronomy advisor for small and marginal farmers in India.

TASK: Analyze the FIELD STATE and EVIDENCE BUNDLE below. Produce a structured advisory.

RULES:
1. Use ONLY the data provided. Do NOT invent measurements or statistics.
2. Reference evidence IDs from the bundle when explaining risks and recommendations.
3. Use only evidence IDs from the supplied evidence list [{valid_evidence_ids_str}]. Never invent, modify, or fabricate an evidence ID.
4. If data is missing or uncertain, acknowledge it. Do NOT fabricate missing measurements.
5. Recommend regenerative, low-cost, locally practical options.
6. If the land is not cropland, say so and advise accordingly.
7. Write every text value only in {L} (simple words, no jargon), preferably in its native script. Do not include English alongside the translation.
8. Keep all JSON keys in English.
9. The Field Health Score is deterministic (computed by the system). You may explain it but do NOT recalculate it.
10. Each recommendation must have a clear WHY linked to specific evidence.
11. Give specific timing: now, next 24-48 hours, next 3-7 days, monitor over the coming weeks. Only use timing when justified by the supplied evidence.
12. Never create fake precision (do not invent fertilizer quantities, irrigation quantities, yield predictions).
13. Treat farmer_reported_observations as farmer reports, not confirmed measurements or diagnoses.
14. Respect evidence_quality availability, dates, freshness, cloud quality, and limitations. Do not make a confident field-specific diagnosis from stale or missing satellite evidence alone.
15. NDVI indicates vegetation greenness only; it cannot establish a disease, pest, or nutrient deficiency.
16. Do not recommend pesticide products or chemical dosages without adequate crop, pest, location, and product-specific evidence. Recommend local agricultural expert guidance when needed.

FIELD STATE:
{field_text}

EVIDENCE BUNDLE:
{evidence_text}

{ADVISORY_SCHEMA_V2}"""

    r = _generate(contents=prompt,
        config=types.GenerateContentConfig(**ADVISORY_CONFIG))
    
    parsed = _safe_parse(r)
    
    # Enforce evidence safety validation in Python post-processing
    valid_ids = set([e.get("id") for e in evidence if "id" in e])
    
    def validate_ids(obj):
        if isinstance(obj, dict):
            for k in list(obj.keys()):
                if k == "evidence_ids" and isinstance(obj[k], list):
                    obj[k] = [eid for eid in obj[k] if eid in valid_ids]
                elif k == "evidence_id" and isinstance(obj[k], str):
                    if obj[k] not in valid_ids:
                        obj[k] = ""
                else:
                    validate_ids(obj[k])
        elif isinstance(obj, list):
            for item in obj:
                validate_ids(item)

    validate_ids(parsed)
    # Cache only real advisories; parser fallbacks should be retried.
    if isinstance(parsed, dict) and "_raw" not in parsed:
        _advisory_cache[cache_key] = json.dumps(parsed, ensure_ascii=False)
        if len(_advisory_cache) > 128:
            _advisory_cache.pop(next(iter(_advisory_cache)))
    return parsed


def followup_answer(field_state_compact: dict, evidence: list, question: str, lang: str) -> str:
    """Answer one farmer follow-up using only the current field state and evidence bundle."""
    language = LANGS.get(lang, LANGS["en"])
    evidence_items = [
        {key: item.get(key) for key in ("id", "indicator", "value", "unit", "source", "date", "interpretation")}
        for item in evidence if isinstance(item, dict)
    ]
    evidence_text = json.dumps(evidence_items, ensure_ascii=False, default=str)
    field_text = json.dumps(field_state_compact, ensure_ascii=False, default=str)
    cache_key = hashlib.sha256(f"{MODEL}|{lang}|{field_text}|{evidence_text}|{question.strip().lower()}".encode()).hexdigest()
    if cache_key in _followup_cache:
        return _followup_cache[cache_key]
    prompt = f"""You are AgriNet India's agricultural helper. Answer this farmer's follow-up briefly and simply in {language}. Keep the spoken answer concise.
Use only the supplied field information and evidence. Treat farmer reports as unverified. Say when data is missing or old. Explain NDVI as vegetation greenness only, never as proof of a disease. Do not invent weather, soil, satellite, pest, or crop facts. Do not prescribe pesticides or chemical dosages. Recommend local expert help when evidence is inadequate.
FIELD: {field_text}
EVIDENCE: {evidence_text}
FARMER QUESTION: {question[:500]}
Return plain text only."""
    config = {"max_output_tokens": 256}
    if not MODEL.lower().startswith("gemini-3"):
        config["temperature"] = 0.3
    response = _generate(contents=prompt, config=types.GenerateContentConfig(**config))
    text = (getattr(response, "text", None) or "").strip()
    answer = text[:1200] or "I could not prepare an answer from the available field information. Please try again or ask a local agricultural expert."
    if text:
        _followup_cache[cache_key] = answer
        if len(_followup_cache) > 128:
            _followup_cache.pop(next(iter(_followup_cache)))
    return answer

# ──────────────────────────────────────────────

DIAGNOSIS_SCHEMA = """Return ONLY valid JSON:
{
  "crop": "str (identified crop)",
  "healthy": "bool",
  "likely_issue": "str (most likely disease/issue or 'healthy')",
  "diagnosis": "str (brief image-based assessment, not a confirmed diagnosis)",
  "confidence": "low|medium|high",
  "observed_symptoms": ["str"],
  "recommended_action": ["str (immediate actions)"],
  "treatment_organic": ["str"],
  "treatment_chemical": ["str (do not provide pesticide dosages; recommend a local expert if needed)"],
  "prevention": ["str"],
  "expert_escalation": "str (when to seek expert help)",
  "disclaimer": "AI-assisted crop disease assessment — not laboratory confirmation. Verify with agricultural extension officer."
}
Describe visible signs separately from possible causes. Treat image findings as tentative, not a confirmed diagnosis. Never invent observations or prescribe pesticide products/dosages without adequate crop, pest, location, and product evidence.
If the image is not a plant or is too unclear, set healthy=false, likely_issue="cannot determine" and ask for a clearer photo or field inspection.
"healthy" must be a JSON boolean (true/false). Be concise: at most 3 items per list, one short sentence each."""

_diagnosis_cache = {}

def diagnose(image: bytes, mime: str, lang: str, crop: str = "", field_context: dict = None):
    """Multimodal crop disease assessment with optional field context."""
    L = LANGS.get(lang, "English")
    hint = f" (crop: {crop})" if crop else ""

    context_section = ""
    if field_context:
        cover = field_context.get("land_cover", {}) if isinstance(field_context, dict) else {}
        vegetation = field_context.get("vegetation", {}) if isinstance(field_context, dict) else {}
        compact_context = {
            "land_cover": cover.get("class") if isinstance(cover, dict) else cover,
            "is_cropland": cover.get("is_cropland") if isinstance(cover, dict) else None,
            "satellite_source": cover.get("source") if isinstance(cover, dict) else None,
            "satellite_observation_date": cover.get("observed") if isinstance(cover, dict) else None,
            "ndvi": vegetation.get("ndvi") if isinstance(vegetation, dict) else None,
            "ndwi": vegetation.get("ndwi") if isinstance(vegetation, dict) else None,
            "ndvi_observation_date": ((vegetation.get("ndvi_series") or [{}])[-1].get("date")
                                      if isinstance(vegetation, dict) and vegetation.get("ndvi_series") else None),
        }
        if field_context.get("evidence_quality"):
            quality = field_context["evidence_quality"]
            compact_context["evidence_quality"] = {
                "satellite": quality.get("satellite"),
                "vegetation_index": quality.get("vegetation_index"),
                "weather": quality.get("weather"),
                "soil": quality.get("soil"),
            }
        farmer_report = field_context.get("farmer_report")
        if farmer_report:
            compact_context["farmer_reported_symptoms"] = farmer_report.get("symptoms")
        context_section = f"""
FIELD CONTEXT (use to provide more specific advice):
{json.dumps(compact_context, ensure_ascii=False, default=str)}
"""
    else:
        compact_context = {}

    prompt = f"""You are an agricultural image-assessment assistant helping an Indian farmer. Examine this crop photo{hint}.
{context_section}
{DIAGNOSIS_SCHEMA}
Write every user-facing text value only in {L}, preferably using its native script. Do not include English alongside the translation; keep JSON keys and standard crop/scientific abbreviations in English. Field reports and satellite indicators are context only and do not confirm what is visible in the photo."""

    cache_context = json.dumps(compact_context, sort_keys=True, ensure_ascii=False, default=str)
    cache_key = hashlib.sha256(image + lang.encode() + crop.encode() + cache_context.encode()).hexdigest()
    if cache_key in _diagnosis_cache:
        return dict(_diagnosis_cache[cache_key])
    diagnosis_config = {"response_mime_type": "application/json", "max_output_tokens": 2048}
    if not MODEL.lower().startswith("gemini-3"):
        diagnosis_config["temperature"] = 0
    r = _generate(
        contents=[types.Part.from_bytes(data=image, mime_type=mime), prompt],
        config=types.GenerateContentConfig(**diagnosis_config))
    result = _safe_parse(r)
    cacheable = isinstance(result, dict) and bool(result.get("diagnosis")) and "_raw" not in result
    if not isinstance(result, dict):
        result = {}
    if "_raw" in result:
        result = {
            "healthy": False,
            "likely_issue": "Could not determine",
            "diagnosis": "The image response could not be read. Please retry with a clear, well-lit crop photo.",
            "confidence": "low",
            "observed_symptoms": [],
            "recommended_action": [],
            "expert_escalation": "Please consult a local agricultural expert if the issue persists.",
            "_raw": result.get("_raw", ""),
        }
    # Ensure backward compatibility
    if "likely_issue" not in result:
        result["likely_issue"] = result.get("diagnosis", "unknown")
    if not result.get("diagnosis"):
        result["diagnosis"] = result.get("summary", "The image could not be assessed clearly. Please try another photo.")
    if isinstance(result.get("healthy"), str):
        result["healthy"] = result["healthy"].strip().lower() in ("true", "yes", "1")
    elif not isinstance(result.get("healthy"), bool):
        result["healthy"] = False
    if isinstance(result.get("confidence"), str):
        result["confidence"] = result["confidence"].strip().lower()
    if result.get("confidence") not in ("low", "medium", "high"):
        result["confidence"] = "low"
    if "recommended_action" not in result:
        result["recommended_action"] = result.get("treatment_organic", [])
    if not isinstance(result["recommended_action"], list):
        result["recommended_action"] = [str(result["recommended_action"])] if result["recommended_action"] else []
    if "expert_escalation" not in result:
        result["expert_escalation"] = result.get("when_to_seek_expert", "")
    if "observed_symptoms" not in result:
        result["observed_symptoms"] = result.get("symptoms_seen", [])
    if not isinstance(result["observed_symptoms"], list):
        result["observed_symptoms"] = [str(result["observed_symptoms"])] if result["observed_symptoms"] else []
    # The UI joins these lists as text, so flatten any object items the model returns.
    for k in ("observed_symptoms", "recommended_action"):
        result[k] = [x if isinstance(x, str) else " ".join(str(v) for v in x.values()) if isinstance(x, dict) else str(x)
                     for x in result[k] if x]
    result.setdefault("expert_escalation", result.get("when_to_seek_expert", "Consult a local agricultural expert if symptoms continue."))
    # Do not cache provider/parser fallback text; later attempts may succeed.
    if cacheable:
        _diagnosis_cache[cache_key] = dict(result)
        if len(_diagnosis_cache) > 64:
            _diagnosis_cache.pop(next(iter(_diagnosis_cache)))
    return result


# ──────────────────────────────────────────────
# SAFE JSON PARSING
# ──────────────────────────────────────────────

def _safe_parse(resp):
    """Parse Gemini response JSON with fallback handling."""
    try:
        return _json(resp)
    except (json.JSONDecodeError, AttributeError):
        # Try to extract JSON from response text
        text = resp.text.strip() if resp and resp.text else ""
        # Try finding JSON block
        start = text.find("{")
        end = text.rfind("}") + 1
        if start >= 0 and end > start:
            try:
                return json.loads(text[start:end])
            except json.JSONDecodeError:
                pass
        # Return raw text as summary fallback
        return {
            "summary": text[:500] if text else "AI response could not be parsed.",
            "field_condition": "Unable to generate structured advisory.",
            "risks": [],
            "recommendations": [],
            "regenerative_actions": [],
            "crop_options": [],
            "weather_actions": [],
            "soil_actions": [],
            "confidence_note": "Response parsing failed — showing raw AI output.",
            "_raw": text[:1000],
        }


def is_available() -> bool:
    """Check if Gemini API is configured."""
    return bool(os.getenv("GEMINI_API_KEY"))
