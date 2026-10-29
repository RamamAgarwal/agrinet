"""Source-specific freshness and quality assessment for field evidence."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any


def assess(field_state: dict[str, Any]) -> dict[str, Any]:
    """Summarize data availability and freshness without turning missing data into values."""
    today = date.today()
    land = field_state.get("land_cover") or {}
    vegetation = field_state.get("vegetation") or {}
    weather = field_state.get("weather") or {}
    soil = field_state.get("soil") or {}

    sat_date = None
    series = vegetation.get("ndvi_series") or []
    candidates = [point.get("date") for point in series if isinstance(point, dict) and point.get("date")]
    observed = land.get("observed")
    if candidates:
        sat_date = max(candidates)
    elif observed:
        sat_date = str(observed)[:10]
    sat_age = None
    try:
        sat_age = (today - date.fromisoformat(sat_date)).days if sat_date else None
    except (TypeError, ValueError):
        pass
    sat_available = bool(land.get("source") not in (None, "none") and (series or observed))
    ndvi_available = bool(series or vegetation.get("ndvi") is not None)
    weather_available = weather.get("status") == "available"
    weather_retrieved = weather.get("retrieved_at")
    weather_fresh = False
    try:
        stamp = datetime.fromisoformat(weather_retrieved.replace("Z", "+00:00"))
        age_seconds = (datetime.now(timezone.utc) - stamp.astimezone(timezone.utc)).total_seconds()
        weather_fresh = weather_available and 0 <= age_seconds <= 24 * 3600
    except (AttributeError, TypeError, ValueError):
        pass
    soil_available = soil.get("status") == "available"
    latest_cloud = next((point.get("cloud_percent") for point in reversed(series)
                         if isinstance(point, dict) and point.get("cloud_percent") is not None), None)

    return {
        "satellite": {
            "available": sat_available,
            "observation_date": sat_date,
            "age_days": sat_age,
            "fresh": sat_age is not None and 0 <= sat_age <= 60,
            "cloud_percent": latest_cloud,
            "quality": "Sentinel-2 scenes with cloud percentage below 60% and SCL cloud/shadow masking are used. Cloud percentage is scene-wide, not a field-specific cloud estimate.",
            "limitation": "NDVI describes vegetation greenness and cannot identify a specific disease or nutrient deficiency.",
        },
        "vegetation_index": {
            "available": ndvi_available,
            "observation_date": sat_date,
            "fresh": ndvi_available and sat_age is not None and 0 <= sat_age <= 60,
            "latest_scene_cloud_percent": latest_cloud,
            "scene_cloud_filter_percent": land.get("scene_cloud_filter_percent"),
            "cloud_shadow_masking": land.get("scl_cloud_shadow_masking"),
            "limitation": "No clear-pixel NDVI result is available. Cloud masking, image coverage, or provider limitations may explain the gap; check the field directly.",
        },
        "weather": {
            "available": weather_available,
            "retrieved_at": weather_retrieved,
            "fresh": weather_fresh,
            "limitation": "Gridded weather and forecasts are not proof of conditions inside this field.",
        },
        "soil": {
            "available": soil_available,
            "retrieved_at": soil.get("retrieved_at"),
            "fresh": bool(soil_available),
            "limitation": "SoilGrids is gridded 0-5 cm information, not a laboratory test from this field.",
        },
        "field_specific_advice_supported": ndvi_available and sat_age is not None and 0 <= sat_age <= 60,
    }
