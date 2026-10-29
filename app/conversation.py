"""Short-lived, backend-controlled farmer conversation workflow.

Conversation data is held in process memory for at most two hours. It contains no
uploaded image bytes and callers must supply an unguessable session identifier.
"""
from __future__ import annotations

import re
import threading
import time
from typing import Any

TTL_SECONDS = 2 * 60 * 60
_sessions: dict[str, dict[str, Any]] = {}
_lock = threading.Lock()
_INDIA_LAT = (6.0, 38.0)
_INDIA_LON = (67.0, 98.0)

PROMPTS = {
    "en": {
        "welcome": "Hello. I can help you understand your field. Shall we use your current location, or choose the field on the map?",
        "location": "Please confirm the field location on the map. Your phone location may not be your field.",
        "crop": "What crop are you growing in this field? You can say skip if you are unsure.",
        "symptoms": "How is the crop looking? Tell me about any yellow leaves, spots, wilting, pests, or say healthy or skip.",
        "irrigation": "When was this field last irrigated? You can say skip or I do not know.",
        "ready": "Thank you. I have enough to check the available field evidence.",
    },
    "hi": {
        "welcome": "नमस्ते। मैं आपके खेत की स्थिति समझने में मदद करूँगा। क्या हम आपकी मौजूदा जगह का उपयोग करें या नक्शे पर खेत चुनें?",
        "location": "कृपया नक्शे पर खेत की जगह की पुष्टि करें। फोन की जगह आपका खेत होना ज़रूरी नहीं है।",
        "crop": "इस खेत में कौन सी फसल उगा रहे हैं? पता न हो तो छोड़ें कह सकते हैं।",
        "symptoms": "फसल कैसी दिख रही है? पीले पत्ते, धब्बे, मुरझाना या कीट दिखें तो बताएं, या स्वस्थ/छोड़ें कहें।",
        "irrigation": "इस खेत में आखिरी बार पानी कब दिया था? पता न हो तो छोड़ें कहें।",
        "ready": "धन्यवाद। अब मैं उपलब्ध खेत के प्रमाण जाँचूँगा।",
    },
}


def _prune(now: float) -> None:
    for key in [key for key, value in _sessions.items() if now - value["updated"] > TTL_SECONDS]:
        _sessions.pop(key, None)
    while len(_sessions) > 2048:
        oldest = min(_sessions, key=lambda key: _sessions[key]["updated"])
        _sessions.pop(oldest, None)


def _valid_location(location: Any) -> dict[str, float] | None:
    if not isinstance(location, dict):
        return None
    try:
        lat, lon = float(location["lat"]), float(location["lon"])
    except (KeyError, TypeError, ValueError):
        return None
    if not (_INDIA_LAT[0] <= lat <= _INDIA_LAT[1] and _INDIA_LON[0] <= lon <= _INDIA_LON[1]):
        return None
    return {"lat": lat, "lon": lon}


def advance(session_id: str, lang: str, answer: str = "", location: Any = None) -> dict[str, Any]:
    """Advance one explicit workflow stage and return the next prompt and state."""
    language = lang if lang in PROMPTS else "en"
    now = time.time()
    with _lock:
        _prune(now)
        item = _sessions.get(session_id)
        if item is None:
            if len(_sessions) >= 2048:
                oldest = min(_sessions, key=lambda key: _sessions[key]["updated"])
                _sessions.pop(oldest, None)
            item = {"stage": "welcome", "lang": language, "field": {}, "updated": now}
            _sessions[session_id] = item
        item["lang"] = language
        stage = item["stage"]
        text = answer.strip()
        skip = bool(re.search(r"\b(skip|unknown|don't know|do not know)\b|छोड़|नहीं पता", text, re.I))
        if stage == "welcome":
            item["stage"] = "location"
            item["updated"] = now
            return {"stage": "location", "prompt": PROMPTS[language]["welcome"], "field": dict(item["field"]),
                    "needs_location": True, "field_ready": False, "language": language,
                    "language_fallback": lang not in PROMPTS}
        if stage == "location":
            selected = _valid_location(location)
            if selected is None:
                return {"stage": stage, "prompt": PROMPTS[language]["location"], "needs_location": True,
                        "error": "Choose a point in India on the map or provide valid field coordinates.",
                        "language": language, "language_fallback": lang not in PROMPTS}
            item["field"].update(selected)
            item["field"]["location_confirmed"] = True
            item["stage"] = "crop"
        elif stage == "crop":
            if text and not skip:
                item["field"]["crop"] = text[:80]
            item["stage"] = "symptoms"
        elif stage == "symptoms":
            if text and not skip:
                item["field"]["symptoms"] = text[:500]
            needs_water_context = bool(re.search(r"yellow|wilting|wilt|dry|water|irrig|पीला|मुरझा|सूख|पानी", text, re.I))
            item["stage"] = "irrigation" if needs_water_context else "ready"
        elif stage == "irrigation":
            if text and not skip:
                item["field"]["last_irrigation"] = text[:120]
            item["stage"] = "ready"
        elif stage == "ready":
            if text:
                item["field"]["follow_up"] = text[:500]
        item["updated"] = now
        current = item["stage"]
        return {"stage": current, "prompt": PROMPTS[language][current], "field": dict(item["field"]),
                "needs_location": current == "location", "field_ready": current == "ready",
                "language": language, "language_fallback": lang not in PROMPTS}


def get_field(session_id: str) -> dict[str, Any] | None:
    """Return a copy of a live session's farmer-provided field context."""
    with _lock:
        _prune(time.time())
        item = _sessions.get(session_id)
        return dict(item["field"]) if item else None


def control(session_id: str, lang: str, action: str) -> dict[str, Any]:
    """Repeat, revisit, edit, or finish a conversation step without discarding session context."""
    language = lang if lang in PROMPTS else "en"
    now = time.time()
    with _lock:
        _prune(now)
        item = _sessions.get(session_id)
        if item is None:
            return {"error": "Conversation expired. Start a new voice conversation.", "stage": "welcome"}
        item["lang"] = language
        field = item["field"]
        if action == "repeat":
            pass
        elif action == "back":
            previous = {"crop": "location", "symptoms": "crop", "irrigation": "symptoms", "ready": "irrigation" if field.get("last_irrigation") else "symptoms"}
            item["stage"] = previous.get(item["stage"], "location")
        elif action == "edit_location":
            item["stage"] = "location"
            for key in ("lat", "lon", "location_confirmed", "crop", "symptoms", "last_irrigation"):
                field.pop(key, None)
        elif action == "edit_crop":
            item["stage"] = "crop"
            field.pop("crop", None)
            field.pop("symptoms", None)
            field.pop("last_irrigation", None)
        elif action == "edit_symptoms":
            item["stage"] = "symptoms"
            field.pop("last_irrigation", None)
        elif action == "edit_irrigation":
            item["stage"] = "irrigation"
        elif action == "start_over":
            item["field"] = {}
            field = item["field"]
            item["stage"] = "location"
        elif action == "analyze_now":
            if not _valid_location(field):
                return {"stage": item["stage"], "prompt": PROMPTS[language]["location"], "needs_location": True,
                        "field_ready": False, "error": "Choose and confirm your field location first.", "language": language}
            item["stage"] = "ready"
        else:
            return {"stage": item["stage"], "error": "That conversation action is not supported."}
        item["updated"] = now
        stage = item["stage"]
        return {"stage": stage, "prompt": PROMPTS[language][stage], "field": dict(field),
                "needs_location": stage == "location", "field_ready": action == "analyze_now",
                "language": language, "language_fallback": lang not in PROMPTS}
