# CHANGELOG.md – Summary of Significant Changes

## [Unreleased]
- **Voice**: removed the "Two-way voice (Gemini Live)" button and its browser-side WebSocket/audio code. The guided
  conversation uses browser speech and typed replies only. `/api/v1/voice-session` is kept unchanged for API compatibility.
- **Localisation**: Tamil, Telugu, Marathi, Bengali, Gujarati, Kannada, Punjabi and Malayalam had ~120 UI strings still in
  English; all are now translated, and leftover Hindi `(hi)` placeholders were fixed. The voice card, advisory labels
  (Benefit, Timing, Conditions, Check), crop suitability, diagnosis confidence, land-cover classes, crop names, scenario
  dates and coordinate placeholders now follow the selected language.
- **UI**: health gauge shows a score-proportional arc, chat-style voice transcript, refreshed voice card, status pill,
  scenario-card hover, collapsible advisory sections with indicators, smaller sticky header logo, reduced-motion support,
  and working drag-and-drop on the Crop Doctor upload area.
- **Field Intelligence** now opens at the Field Health score: views always scroll to the top when switched.
- **Earth Engine**: Dynamic World, Sentinel-2 NDVI/NDWI (cloud-masked) and the MODIS land/water mask are fetched in one
  `getInfo()` round trip; results are cached per geohash-7 cell, a slow query no longer discards Planet results, and a
  failed EE init is retried after 5 minutes instead of being disabled until restart. EE is warmed up at startup.
- **Water bodies**: open sea/coast points (no Dynamic World scene) are classified via the MODIS water mask or a spectral
  NDWI/NDVI test; they report "No land detected" and AI advisory is disabled for them (UI and API).
- Fixed PlanetScope NDWI band indices (Green B4 / NIR B8).
- **Gemini latency/reliability**: minimal thinking level (with automatic fallback if a model rejects it), 28 s HTTP
  timeout, one retry on 5xx/rate-limit errors (not on exhausted daily quota), concise output limits, larger output token
  budget (fixes truncated-JSON failures), compact evidence in prompts, and an advisory cache per input + language.
- **Crop Doctor**: photos are downscaled to 1280 px JPEG before upload; HEIC/HEIF and files with a missing MIME type are
  identified from their bytes instead of being rejected; diagnosis fields are normalised.
- **Language switching**: advisory/diagnosis stay visible while a translation loads, results are cached per language,
  rapid switches are debounced, and modal `alert()`s were replaced by non-blocking notices. Audio has a Stop toggle,
  waits for voices to load, reads only readable text in the advisory's language, and warns when no voice is installed.
- Request timing is logged by the HTTP middleware; `print` calls replaced with `logging`.
- Initial project scaffolding (FastAPI server, layered architecture).
- Implemented deterministic field‑intelligence pipeline (`field_state`, `geo`, `data_sources`).
- Defined immutable **Evidence Bundle** JSON schema.
- Integrated Google Gemini for structured advisory (`advisory_v2`) and multimodal crop diagnosis.
- Added multilingual support for 10 Indian languages.
- Exposed versioned API under `/api/v1/` with endpoints:
  - `POST /api/v1/analyze`
  - `POST /api/v1/advisory`
  - `POST /api/v1/diagnose`
  - `GET /api/v1/manifest`
- Preserved legacy `/api/*` routes for backward compatibility.
- Containerised the application with `Dockerfile` (Python 3.12‑slim). 
- Added documentation files: `README.md`, `AGENTS.md`, `PROJECT_CONTEXT.md`, `HANDOFF.md`, `SETUP.md`.
- Added helper scripts for model training and data preparation.

## [0.1.0] – 2026‑10‑20
- Public release of the prototype as a Digital Public Good (DPG).
- First commit of source code and documentation.
- Initial CI configuration (placeholder, test suite pending).

---
*All future changes should be recorded here following semantic versioning.*
