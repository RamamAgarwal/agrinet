<img width="1983" height="793" alt="ChatGPT Image Sep 30, 2026, 09_06_25 PM" src="https://github.com/user-attachments/assets/a3679515-2ade-466b-bc1b-af4e20e0a8fb" />
<h1 align="center">AgriNet India</h1>

<h2 align="center">Evidence-Grounded Agricultural Intelligence for India</h2>
<p align="center">

**[Live Demo](https://agrinet-india.onrender.com/)** •
**[Demo Video](https://drive.google.com/file/d/1tP0wDaA7tx-t_Kc-mj3GMVSgHyNF8ete/view?usp=sharing)** •
**[Pitch Deck](https://drive.google.com/file/d/1BrLKiSz-xMS5rk_GwVjBfLVZQKPoG2-b/view?usp=sharing)** •
**[AI Model](#spear-planetscope-intelligence)** •
**[Field Intelligence](#layer-3--deterministic-field-intelligence)** •
**[Architecture](#system-architecture)** •
**[AI Advisory](#agricultural-advisory)** •
**[Crop Doc](#crop-doctor)** •
**[Interoperable State Network API](#designed-for-india-scale-expansion)**
</p>


**AgriNet India** is an interoperable agricultural intelligence platform that combines satellite observations, soil information, weather signals, deterministic field intelligence, and Google Gemini reasoning to turn fragmented agricultural data into localized, evidence-grounded action.

Instead of sending raw agricultural data directly to an LLM, AgriNet first constructs a structured **evidence bundle** from multiple sources. Deterministic field indicators such as NDVI, NDWI, land-cover signals, weather indicators, soil indicators, and field-health components are computed first. Google Gemini then reasons over this grounded evidence to generate localized agricultural recommendations.

The platform also includes a multimodal **Crop Doctor** for crop-disease assessment and a common API architecture designed to support configurable state-specific agricultural data and model adapters.

> **Satellite + Soil + Weather → Field Intelligence → Evidence → Gemini Reasoning → Localized Agricultural Action**

---
<img width="1497" height="674" alt="image" src="https://github.com/user-attachments/assets/70b81240-0987-40e9-8df1-b42ad840d0bb" />


##  Live Web Application

**https://agrinet-india.onrender.com/**

The current prototype is deployed as a containerized FastAPI application on Render.

The same deployment provides:

- farmer-facing web interface;
- field analysis;
- agricultural advisory generation;
- multilingual interaction;
- Crop Doctor;
- interoperability/API endpoints.

---

# How AgriNet Addresses the Challenge

AgriNet is designed directly around the five evaluation dimensions of the **Build with AI: Code for Communities** challenge.

| Evaluation Area | AgriNet Approach |
|---|---|
| **Problem-Solution Fit — 20%** | Combines fragmented satellite, soil, and weather information into field-level intelligence and converts it into localized agricultural recommendations. |
| **AI / Technical Execution — 25%** | Google Gemini performs evidence-grounded agricultural reasoning and multimodal crop-disease assessment, while deterministic processing computes the underlying field indicators. |
| **Depth & Reach Across India — 20%** | Uses a common API and evidence architecture that can be extended across states, crops, datasets, agricultural models, and Indian languages through configurable adapters. |
| **Impact Potential — 15%** | Creates a reusable agricultural intelligence layer that can support farmers, agricultural extension workflows, and state-level agricultural platforms rather than a single location or crop. |
| **Deployability & Scalability — 20%** | The prototype is already containerized and deployed. Its API-first architecture separates data providers, intelligence, AI reasoning, and state adapters so components can be extended independently. |

---

# Challenge → AgriNet Solution

The agricultural challenge contains several connected problems.

## 1. Fragmented Agricultural Data

Useful agricultural information is distributed across different sources:

```text
Satellite
   +
Soil
   +
Weather
   +
Land Cover
   +
Agricultural Models
````

AgriNet brings these signals into a common field-level intelligence pipeline.

```text
Multiple Data Sources
        ↓
Data Normalization
        ↓
Field Intelligence
        ↓
Evidence Bundle
```

---

## 2. Raw Data Does Not Automatically Become Agricultural Advice

A satellite measurement, soil value, or weather forecast is not itself a recommendation.

AgriNet introduces an intermediate intelligence layer:

```text
Observation
     ↓
Indicator
     ↓
Interpretation
     ↓
Risk
     ↓
Recommended Action
```

This allows the AI system to reason about the agricultural meaning of measured evidence rather than simply generating generic farming advice.

---

## 3. Lack of Interoperable Infrastructure

AgriNet is not designed around one city, one crop, or one state.

The architecture separates the common intelligence layer from state-specific data and models:

```text
             Common AgriNet API
                    │
       ┌────────────┼────────────┐
       │            │            │
    State A      State B      State C
    Adapter      Adapter      Adapter
       │            │            │
   Local Data    Local Data   Local Data
   Local Models  Local Models Local Models
```

The common evidence and reasoning architecture can therefore remain reusable while individual states provide their own agricultural information.

---

# End-to-End Working Flow

The complete AgriNet workflow is:

```text
1. Select / enter a field
              ↓
2. Determine available Earth-observation data
              ↓
3. Retrieve satellite + soil + weather information
              ↓
4. Calculate deterministic field indicators
              ↓
5. Construct structured Evidence Bundle
              ↓
6. Send grounded evidence to Google Gemini
              ↓
7. Generate structured agricultural advisory
              ↓
8. Localize advisory into selected Indian language
              ↓
9. Present / read advisory to farmer
```

A separate image-based workflow is available through Crop Doctor:

```text
Crop / Leaf Image
        ↓
Gemini Multimodal
        ↓
Structured Disease Assessment
        ↓
Treatment / Prevention / Expert Escalation
```

---

# System Architecture

AgriNet is designed as a **layered agricultural intelligence system**, rather than as a single AI model.

The architecture separates:

1. data acquisition;
2. Earth-observation processing;
3. deterministic field intelligence;
4. evidence construction;
5. AI reasoning;
6. farmer-facing delivery;
7. state-specific interoperability.

This separation allows individual data sources, models, and integrations to evolve without redesigning the complete platform.

---

## High-Level Architecture

<img width="1224" height="1285" alt="ChatGPT Image Oct 1, 2026, 12_27_16 AM" src="https://github.com/user-attachments/assets/8ce5780c-1933-4f43-8416-383adf28133a" />


---

# Architectural Layers

## Layer 1 — Data Acquisition

AgriNet integrates multiple independent agricultural information sources.

### Earth Observation

* PlanetScope
* SPEAR PlanetScope spectral representation
* Sentinel-2
* Dynamic World
* Google Earth Engine

### Soil

* SoilGrids / ISRIC

### Weather

* Open-Meteo

Each provider is kept conceptually separate from the AI reasoning layer.

This means an individual provider can be replaced, extended, or supplemented without requiring the entire application to be redesigned.

---

# Layer 2 — Earth Observation Routing

AgriNet uses two primary Earth-observation routes.

```text
                       Selected Field
                             │
                             ▼
                 PlanetScope availability?
                       /             \
                     YES              NO
                      │                │
                      ▼                ▼
               PlanetScope        Earth Engine
                  Route               Route
                      │                │
              ┌───────┼──────┐     ┌───┴────────┐
              │       │      │     │            │
           Planet   SPEAR  Dynamic Dynamic    Sentinel-2
            NDVI           World   World        NDVI
              │       │      │       │            │
              └───────┴──────┘       └─────┬──────┘
                                           │
                                           ▼
                                   Field Evidence
```

When an eligible nearby PlanetScope observation is available, AgriNet can use the PlanetScope route.

Otherwise, the architecture can fall back to Earth Engine-based analysis.

The configured PlanetScope lookup radius is **300 metres by default**.

This routing prevents the entire application from depending on a single satellite source.

---

# SPEAR PlanetScope Intelligence

AgriNet incorporates the **PlanetScope SpectralMAE representation from SPEAR** to extract fine-grained spectral information from PlanetScope multispectral observations.

SPEAR is a multi-modal self-supervised Earth-observation framework whose architecture includes modality-specific representation learning across Earth-observation data. The PlanetScope component uses a SpectralMAE representation for PlanetScope multispectral information.

For AgriNet, we built the **downstream PlanetScope intelligence/classification layer around the PlanetScope representation during the hackathon period**.

The important distinction is:

```text
Underlying SPEAR representation
                ↓
      AgriNet integration
                ↓
AgriNet downstream PlanetScope head
                ↓
Land-cover intelligence
                ↓
Evidence Bundle
```

The AgriNet downstream pipeline uses the PlanetScope representation to produce:

* predicted land-cover class;
* class probabilities;
* confidence;
* top alternative classes;
* agreement with the available reference land-cover label.

The PlanetScope result is treated as a **contextual second opinion**, not as ground truth.

---

## SPEAR Representation Quality

The supplied SPEAR results report the following mean validation reconstruction performance:

| Modality                    | Mean Validation R² |
| --------------------------- | -----------------: |
| Sentinel-2 SpectralMAE      |         **~0.977** |
| PlanetScope SpectralMAE     |         **~0.958** |
| Sentinel-1 BYOL + Denoising |         **~0.991** |
| Climate MAE                 |         **~0.888** |

The PlanetScope SpectralMAE's reported mean validation R² of approximately **0.958** is particularly relevant to AgriNet because its PlanetScope representation forms the feature basis for the downstream high-resolution intelligence component.

### AgriNet PlanetScope Pipeline

```text
PlanetScope Multispectral Observation
                ↓
       PlanetScope SpectralMAE
                ↓
         Spectral Embedding
                ↓
      AgriNet Downstream Head
                ↓
 ┌────────────────────────────────┐
 │ Land-cover prediction          │
 │ Class probabilities            │
 │ Confidence                     │
 │ Top alternatives               │
 │ Reference agreement            │
 └────────────────────────────────┘
                ↓
          Evidence Bundle
```

The supplied SPEAR architecture and results are the basis for this representation description.  

---

# Layer 3 — Deterministic Field Intelligence

This layer converts raw observations into structured field-level signals.

## Vegetation

AgriNet calculates indicators such as:

* NDVI;
* NDWI;
* vegetation-related signals.

## Land Cover

Land-cover information can come from:

* Dynamic World;
* PlanetScope/SPEAR downstream intelligence where available.

## Weather

The weather layer provides:

* recent rainfall;
* forecast rainfall;
* maximum temperature;
* minimum temperature;
* weather-derived indicators.

## Soil

The soil layer provides information including:

* pH;
* soil organic carbon;
* nitrogen;
* clay;
* sand.

## Field Health

Multiple field components are assembled into a structured field-health representation.

The important architectural property is that these measurements and indicators are computed **before Gemini reasoning**.

---

# Layer 4 — Evidence Bundle

The evidence layer is the bridge between raw agricultural observations and AI reasoning.

Each important observation can be represented using a structured evidence record.

Example:

```json
{
  "id": "SAT-NDVI-001",
  "type": "satellite",
  "indicator": "NDVI",
  "value": 0.62,
  "unit": "index (0–1)",
  "source": "PlanetScope",
  "date": "2024-02-15",
  "interpretation": "Vegetation signal for the selected field.",
  "confidence": 0.72
}
```

The evidence structure is designed to preserve:

* measurement;
* source;
* observation date;
* interpretation;
* confidence;
* provenance;
* evidence identifier.

This creates a traceable chain:

```text
Observation
     ↓
Evidence ID
     ↓
Interpretation
     ↓
Risk
     ↓
Recommendation
```

---

# 🔐 Evidence-Grounded AI
<img width="1197" height="409" alt="image" src="https://github.com/user-attachments/assets/6bfa518a-6f8b-44f2-9c52-4803a98042f4" />


AgriNet does not simply pass raw data into an LLM and accept arbitrary output.

The advisory pipeline provides Gemini with a structured evidence set and valid evidence identifiers.

The model is instructed to use only the supplied evidence.

The backend validates evidence IDs returned by the model against the evidence supplied to it.

Unsupported evidence IDs are removed rather than being accepted as valid references.

This provides an additional layer of control over evidence grounding.

---

# Layer 5 — Google Gemini Reasoning

Google Gemini performs meaningful reasoning work after the deterministic evidence layer.

Gemini is responsible for:

* interpreting field evidence;
* identifying priority risks;
* explaining observations;
* generating agricultural actions;
* generating regenerative options;
* incorporating weather and soil context;
* producing localized advisory content.

The architecture can therefore be summarized as:

```text
Deterministic Layer
        ↓
Measures and structures evidence
        ↓
Evidence Bundle
        ↓
Google Gemini
        ↓
Reasons and communicates
```

Gemini is not expected to invent:

* NDVI values;
* soil measurements;
* rainfall observations;
* satellite dates;
* evidence identifiers.

---

# Agricultural Advisory
<img width="1501" height="680" alt="image" src="https://github.com/user-attachments/assets/4608da69-1e96-4bfa-915d-108a498facd6" />
<img width="1518" height="671" alt="image" src="https://github.com/user-attachments/assets/d13d3bb7-2e59-49c3-b9a2-d441bc7a6a62" />
<img width="1516" height="686" alt="image" src="https://github.com/user-attachments/assets/99fb2c0c-4081-4096-8d47-332f9bbd2fc7" />
<img width="1520" height="685" alt="image" src="https://github.com/user-attachments/assets/13ba3132-beaf-4eb1-a719-80a7322cfa9a" />
<img width="1481" height="670" alt="image" src="https://github.com/user-attachments/assets/1d709b0d-cb8d-4c03-9adc-e32cf8136252" />


The advisory is structured rather than being a single generic paragraph.

It can include sections such as:

* Field Status
* What the Data Shows
* Priority Risks
* What To Do Now
* Why This Advice?
* Regenerative Actions
* Crop Options
* Weather Actions
* Soil Actions
* Monitoring Plan
* Confidence

The advisory can be regenerated in the selected language without changing the underlying numerical evidence.

---

# Regenerative Agriculture

The advisory layer is designed to surface regenerative and lower-input options when they are supported by the available evidence.

Potential categories include:

* soil organic matter improvement;
* moisture management;
* crop rotation;
* nitrogen-fixing crops;
* organic amendments;
* reduction of unnecessary chemical inputs;
* weather-aware irrigation;
* monitoring and early intervention.

The recommendations remain advisory and should be validated against local agronomic conditions and agricultural extension guidance.

---

# Crop Doctor
<img width="1533" height="679" alt="image" src="https://github.com/user-attachments/assets/3d57d3c2-d5cd-4d4e-a231-a33023c2c1cf" />


AgriNet also provides a separate multimodal crop-disease workflow.

```text
Crop / Leaf Image
       ↓
Gemini Multimodal
       ↓
Structured Assessment
       ↓
┌──────────────────────────────┐
│ Crop                         │
│ Healthy / Unhealthy          │
│ Possible Diagnosis           │
│ Confidence                   │
│ Symptoms                     │
│ Treatment Considerations     │
│ Prevention                   │
│ Expert Escalation            │
└──────────────────────────────┘
```

The Crop Doctor is designed to return uncertainty where the image does not contain enough information for a reliable assessment.

It can provide:

* possible diagnosis;
* confidence;
* symptoms;
* treatment considerations;
* prevention;
* guidance on when expert verification is appropriate.

It should not be treated as a replacement for field inspection or agricultural expertise.

---

# Designed for India-Scale Expansion
<img width="1533" height="690" alt="image" src="https://github.com/user-attachments/assets/b9733e89-1a2c-47f0-a6e6-d62dfb6f557a" />

AgriNet is intentionally not designed around one city, one crop, or one state.

The architecture separates a reusable common intelligence layer from state-specific data and models.

```text
                    COMMON AGRINET LAYER
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
Satellite Intelligence  Evidence          Gemini AI
       │                 Contract             │
       └───────────────────┼───────────────────┘
                           │
                    Common API Contract
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
 Uttar Pradesh          Punjab            Maharashtra
 Adapter                Adapter             Adapter
       │                   │                   │
 Local Data             Local Data          Local Data
 Local Models           Local Models        Local Models
```

This creates a path from a single prototype to multiple state deployments.

---

# Geographic and Crop Flexibility

The prototype contains demonstration scenarios spanning different Indian regions, including:

* Uttar Pradesh;
* Punjab;
* Maharashtra;
* Andhra Pradesh;
* Tamil Nadu;
* Odisha.

The architecture is not hard-coded to one crop.

The same evidence pipeline can combine field observations, soil, weather, and Earth-observation signals for different agricultural contexts.

---

# Multilingual Farmer Interface
<img width="1497" height="670" alt="image" src="https://github.com/user-attachments/assets/2b3f2997-58e5-4791-9690-3be590fdf234" />

AgriNet supports 10 languages:

1. English
2. Hindi
3. Tamil
4. Telugu
5. Bengali
6. Marathi
7. Punjabi
8. Gujarati
9. Kannada
10. Malayalam

Localization covers:

* navigation;
* field information;
* advisory headings;
* evidence descriptions;
* advisory content;
* location labels;
* voice-readout locales.

The underlying numerical values and machine-readable API contract remain stable.

Therefore:

```text
Same Evidence
     ↓
Same Numerical Data
     ↓
Different Language
     ↓
Different Farmer
```

---

# Voice Interaction

The frontend supports browser speech synthesis for advisory read-out.

Indian language locales include mappings such as:

```text
English    → en-IN
Hindi      → hi-IN
Tamil      → ta-IN
Telugu     → te-IN
Bengali    → bn-IN
Marathi    → mr-IN
Punjabi    → pa-IN
Gujarati   → gu-IN
Kannada    → kn-IN
Malayalam  → ml-IN
```

This allows the same evidence-grounded advisory to be communicated through text and voice.

---

# Interoperability Architecture

AgriNet is designed around a common API contract rather than one fixed state implementation.

```text
                         AgriNet API
                             │
               ┌─────────────┼─────────────┐
               │             │             │
               ▼             ▼             ▼
          State Adapter  State Adapter  State Adapter
               │             │             │
          Local Data     Local Data     Local Data
          Local Models   Local Models   Local Models
               │             │             │
               └─────────────┼─────────────┘
                             ▼
                      Common Evidence
                             │
                             ▼
                     Common AI Layer
```

A state adapter can potentially provide:

* state-specific agricultural datasets;
* crop models;
* soil datasets;
* local weather products;
* institutional workflows.

The common evidence and AI architecture can remain reusable.

### Important distinction

The current project demonstrates the **interoperability architecture and API contract**.

It does **not** claim that AgriNet is already connected to live agricultural government systems across all of these states.

The architecture is designed to make such integrations possible without requiring the core platform to be rebuilt for every state.

## Interoperability Network demonstration

The Network / API page is a working **synthetic demo exchange**, not a real state registry. It reuses the existing state scenario metadata and the evidence bundle's observation fields (`id`, `type`, `indicator`, `value`, `unit`, `source`, `date`, `interpretation`, `confidence`). The versioned exchange envelope adds participant origin, district, crop, creation time, schema version, provenance, and a synthetic-data sharing classification. It does not duplicate or change the existing `/api/v1/manifest` or evidence schema.

The demo has Punjab, Uttar Pradesh, Maharashtra, Andhra Pradesh, Tamil Nadu, and Uttarakhand participant cards. Every one is labeled **Demo participant / Not connected**; the dashboard reports zero verified integrations. The records and example practices are fixed synthetic fixtures, contain no farmer identity or exact field coordinates, and are not current agricultural observations. The intentionally incomplete Punjab record exists to show field-level validation errors. Practice exchange preserves source attribution and explicitly warns that destination-region agronomic fit has not been validated.

### Presentation walkthrough and reset

1. Open **Network / API**. The participant, schema, record, and activity totals are populated from the backend; the health pill reports the application API and separately shows that external participants are not connected.
2. In **Run cross-state exchange**, choose Punjab → Uttarakhand and the default residue-cover practice. Select **Preview & validate**, inspect the source payload/provenance and preserved field mapping, then choose **Start exchange**. The response includes the backend-generated exchange identifier, destination, acceptance result, and preserved source record. The explorer then lists the destination copy.
3. To show rejection, select Punjab's `obs-pb-draft-002` intentionally incomplete record. Validation identifies missing evidence fields. **Record rejected attempt** records the rejection in the backend activity log; it does not create a destination resource.
4. **Reset demo** clears persisted exchange attempts and activity, restoring the original fixtures so the exchange can be repeated.
5. Use **Data explorer** to search/filter and open provenance/JSON detail; use **Shared practices** to inspect applicability and limitations; use **Developer & API** to inspect the live-generated OpenAPI excerpt or open `/docs` and `/openapi.json`.

The API routes are `GET /api/v1/interoperability/dashboard`, `GET /records`, `GET /records/{record_id}`, `GET /practices`, `POST /validate`, `POST /exchanges`, and `POST /reset` under the `/api/v1/interoperability` prefix. Request/response schemas are included in the existing FastAPI OpenAPI document. The demo store is an atomically written JSON ledger at `data/interoperability-demo-state.json`; it is not a second database service. The file is local/instance storage: it is ignored by Git, may be lost on ephemeral Render restarts, and is not shared between service instances. Demo reset is intended for the presentation environment. **These unauthenticated routes are for synthetic data only** and must not be used for farmer or partner data without authentication, authorization, purpose limitation, consent where required, data classification, and deployment-grade shared storage.

### Interoperability research and limits

The cited initiatives informed design principles only. The Ministry's published UFSP background describes a planned interoperability platform and standards/API repository; a 2022 PIB release describes AgriStack as federated with state ownership and government access controls. Bharat VISTAAR publicly describes an agriculture DPI with a federated network layer and open protocols. ADeX's published project description describes Telangana's standardized, consent-based exchange. These are contextual references: AgriNet has no verified connection, endorsement, partner onboarding, or compliance determination with UFSP, AgriStack, Bharat VISTAAR, or ADeX.

This demo adopts machine-readable versioned APIs, source attribution, validation, visible synthetic-data classification, and backward-compatible additive design. The Government Open API policy describes machine-readable interfaces, stability, documentation, lifecycle/version considerations, and publisher-defined access/authentication. OGC API Features and STAC are relevant future choices for geospatial feature and imagery catalogues; this demo does not claim to implement them or publish private field geometry.

References: [UFSP background (PIB)](https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=1697526&lang=2&reg=48), [AgriStack federation (PIB)](https://www.pib.gov.in/PressReleasePage.aspx?PRID=1883173&lang=2&reg=48), [Bharat VISTAAR](https://vistaar.da.gov.in/), [Telangana ADeX](https://dataforpublicgood.org.in/projects/adex/), [India Open API Policy](https://docs.apisetu.gov.in/document-central/api-policy/Policy%20Statement.html), [API Setu](https://docs.apisetu.gov.in/document-central/explore-apisetu/Introduction.html), [OGC/STAC API guidance](https://docs.geospatial.org.in/docs/consumer/consumer_data_access_apis/).

---

# API Architecture
<img width="1510" height="649" alt="image" src="https://github.com/user-attachments/assets/e58e241d-3cea-4a03-8201-68dbc7c18f71" />


AgriNet exposes a versioned API under:

```text
/api/v1/
```

The API is intended to separate the frontend from the underlying agricultural intelligence system.

---

## Health

```http
GET /api/health
```

Example:

```json
{
  "ok": true,
  "ai_configured": true
}
```

---

## Field Analysis

```http
POST /api/v1/analyze
```

Inputs can include:

* latitude;
* longitude;
* language.

The response contains structured field intelligence and supporting evidence.

---

## Agricultural Advisory

```http
POST /api/v1/advisory
```

The endpoint accepts field context/evidence and generates a structured localized advisory.

---

## Crop Diagnosis

```http
POST /api/v1/diagnose
```

Accepts an image and uses Gemini multimodal reasoning to produce a structured crop-disease assessment.

---

## Digital Public Good Manifest

```http
GET /api/v1/dpg/manifest
```

Provides the interoperability/API contract information.

---

# API as a Digital Public Good Interface

The architecture is designed around a machine-readable interface rather than only a web application.

```text
State / Institution
        ↓
Common API Contract
        ↓
AgriNet Evidence Layer
        ↓
AI Reasoning
        ↓
Advisory / Agricultural Application
```

This makes the intelligence layer reusable by:

* web applications;
* mobile applications;
* state agricultural portals;
* extension systems;
* future institutional clients.

The current implementation is a prototype of this model.

---

# Impact Potential

AgriNet is designed as agricultural infrastructure rather than only as a single farmer-facing feature.

## Farmers

Farmers can receive localized information derived from multiple agricultural data sources instead of having to interpret satellite, soil, and weather information independently.

## Agricultural Extension

The evidence bundle can provide a structured representation of:

* field condition;
* detected risks;
* supporting observations;
* confidence;
* recommended actions.

This can support human extension workflows and expert escalation.

## State Agricultural Systems

State-specific datasets and models can be connected through adapters while retaining a common evidence and API structure.

## National-Scale Reuse

The reusable part of the system includes:

* field intelligence;
* evidence representation;
* AI reasoning;
* multilingual delivery;
* API contract;
* provenance mechanisms.

This means states do not necessarily need to independently rebuild the entire agricultural intelligence stack.

---

# Deployability & Scalability

AgriNet is already deployed as a containerized FastAPI service.

## Current Deployment

```text
Internet
   ↓
Render
   ↓
Dockerized FastAPI
   ├── Web Application
   ├── Field Analysis API
   ├── Advisory API
   ├── Crop Doctor API
   └── DPG API
```

Live deployment:

**[https://agrinet-india.onrender.com/](https://agrinet-india.onrender.com/)**

---

## Why the Architecture Is Pilot-Friendly

### 1. Containerized

The application is packaged as a Docker container.

This keeps the runtime independent from the local development environment.

### 2. API-First

Core capabilities are exposed through APIs rather than being tied exclusively to the frontend.

### 3. Provider Separation

Satellite, soil, weather, and AI providers are separated conceptually and in the backend architecture.

### 4. State Adapters

State-specific data and models can be introduced through adapters.

### 5. Evidence Contract

Different upstream sources can be normalized into a common evidence representation.

### 6. Independent AI Layer

Gemini operates over structured evidence instead of being tightly coupled to individual raw-data providers.

### 7. Modular Extension

Individual components can be replaced or extended without redesigning the complete application.

---

# Example State Pilot Architecture

A potential pilot can follow:

```text
Existing State Agricultural Data
              ↓
       State Adapter
              ↓
       AgriNet API Contract
              ↓
       Evidence Bundle
              ↓
       Gemini Reasoning
              ↓
       State / Farmer Interface
```

This allows deployment to begin with a particular state, crop programme, district workflow, or agricultural use case and expand incrementally.

The current prototype demonstrates the technical architecture for this approach; institutional deployment would still require appropriate integration, validation, governance, and data-access arrangements.

---

# Provenance and Demo Data

AgriNet explicitly distinguishes different evidence states:

```text
LIVE
MODEL
PRECOMPUTED
DEMO
```

The interface exposes provenance so that demonstration data is not silently presented as live information.

For example, the Agra Wheat demonstration scenario uses a historical snapshot dated:

```text
15 February 2024
```

The scenario date is kept separate from the response-generation timestamp.

The UI therefore identifies the scenario as historical/demo data rather than presenting it as a current observation.

---

# Demonstration Scenarios

The application includes demonstration scenarios across multiple Indian regions.

| State          | Location   | Crop      |
| -------------- | ---------- | --------- |
| Uttar Pradesh  | Agra       | Wheat     |
| Punjab         | Ludhiana   | Rice      |
| Maharashtra    | Nashik     | Cotton    |
| Andhra Pradesh | Guntur     | Rice      |
| Tamil Nadu     | Villupuram | Groundnut |
| Odisha         | Sambalpur  | Sorghum   |

These scenarios demonstrate how the same platform architecture can be applied across different geographic and crop contexts.

---

# Why the Evidence Layer Matters

A generic agricultural chatbot might answer:

> "What should this farmer do?"

AgriNet instead follows:

```text
What was observed?
        ↓
Where did it come from?
        ↓
When was it observed?
        ↓
What indicator does it produce?
        ↓
What does that indicator suggest?
        ↓
What risk may be relevant?
        ↓
What action can be considered?
```

The design objective is therefore:

> **Measurement → Interpretation → Risk → Recommendation**

rather than:

> **Prompt → Generic Answer**

---

# Where Google AI Is Used

Google AI is a meaningful part of the system rather than an incidental integration.

## Google Gemini — Agricultural Reasoning

Gemini performs:

* evidence-grounded reasoning;
* agricultural risk interpretation;
* recommendation generation;
* regenerative action generation;
* multilingual advisory generation.

## Google Gemini Multimodal — Crop Doctor

Gemini processes crop/leaf images and produces a structured disease assessment.

## AI + Deterministic Hybrid Architecture

The complete system is:

```text
                    Agricultural Data
                           │
                           ▼
                 Deterministic Processing
                           │
                           ▼
                    Evidence Bundle
                           │
                           ▼
                     Google Gemini
                           │
                           ▼
                   Agricultural Advice
```

This hybrid architecture allows AI reasoning to remain grounded in measurable evidence.

---

# Technology Stack

## Backend

* Python
* FastAPI
* Uvicorn
* NumPy
* SciPy
* pandas
* scikit-learn
* joblib

## AI

* Google Gemini API
* `google-genai`
* Gemini multimodal reasoning

## Earth Observation

* Google Earth Engine
* Sentinel-2
* Dynamic World
* PlanetScope
* SPEAR PlanetScope SpectralMAE representation

## Agricultural Data

* SoilGrids / ISRIC
* Open-Meteo

## Frontend

* HTML
* CSS
* JavaScript
* Leaflet
* Browser Speech Synthesis API

## Deployment

* Docker
* Render

---

# Repository Structure

```text
agrinet-india/
│
├── app/
│   ├── main.py
│   ├── ai.py
│   ├── geo.py
│   ├── data_sources.py
│   ├── evidence.py
│   └── spear_encoder.py
│
├── static/
│   ├── index.html
│   ├── lang.js
│   └── frontend assets
│
├── data/
│   └── lookup.parquet
│
├── models/
│   ├── planet_mae_ckpt_32.pt
│   └── planet_scaler_32.joblib
│
├── scripts/
│   └── generate_lang.py
│
├── tests/
│   ├── __init__.py
│   ├── test_advisory_hindi.py
│   ├── test_ai.py
│   ├── test_api_encoding.py
│   └── test_api_provenance.py
│
├── Dockerfile
├── deploy.sh
├── requirements.txt
├── .env.example
├── .gitignore
└── README.md
```

---

# Local Development

## 1. Clone the Repository

```bash
git clone https://github.com/harshbansal120-cell/agrinet-india.git
cd agrinet-india
```

---

## 2. Create a Virtual Environment

### Windows

```powershell
python -m venv .venv
.venv\Scripts\activate
```

### Linux / macOS

```bash
python -m venv .venv
source .venv/bin/activate
```

---

## 3. Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 4. Configure Environment Variables

Copy:

```text
.env.example
```

to:

```text
.env
```

Configure the Gemini key:

```text
GEMINI_API_KEY=your_key_here
```

Do not commit `.env`.

---

# Run Locally

Start the FastAPI server:

```bash
python -m uvicorn app.main:app --reload
```

Open:

```text
http://127.0.0.1:8000
```

Health endpoint:

```text
http://127.0.0.1:8000/api/health
```

---

# 🛰️ Earth Engine Configuration

Earth Engine is an optional component of the field-analysis pipeline.

When configured, AgriNet can use the Earth Engine route for locations where an eligible nearby stored PlanetScope observation is unavailable.

The application is designed to handle the absence of Earth Engine configuration gracefully so that demonstration scenarios can remain usable.

For Earth Engine-enabled development, configure the appropriate Earth Engine project and authentication for the environment.

---

# Testing

Run the test suite:

```bash
python -m pytest -q
```

Compile-check the backend:

```bash
python -m compileall app
```

The repository contains tests covering areas including:

* AI advisory behavior;
* multilingual advisory output;
* API encoding;
* API provenance.

---

# Docker

Build the application:

```bash
docker build -t agrinet-india .
```

Run locally:

```bash
docker run --rm -p 8000:8000 \
  -e GEMINI_API_KEY=your_key_here \
  agrinet-india
```

The Docker configuration uses the platform-provided `PORT` variable when deployed.

---

# Render Deployment

The current live application is deployed on Render.

```text
https://agrinet-india.onrender.com/
```

The deployment uses the repository's Docker configuration.

Architecture:

```text
GitHub
   ↓
Render Build
   ↓
Docker Image
   ↓
FastAPI Service
   ↓
AgriNet Web + API
```

The Gemini API key is stored as a server-side environment variable.

No API credentials are committed to the repository.

## Voice-guided farmer workflow

The dashboard includes a guided English/Hindi assessment. **Start voice conversation** uses browser speech recognition and speech synthesis in conversational turns: the farmer speaks, AgriNet processes the answer, speaks its reply, and listens again. Browser recognition needs a supported browser, microphone permission, HTTPS (or localhost), and a working network speech service. It uses the same evidence-grounded advisory workflow as the rest of the app. At any point the farmer can say **help**, **repeat**, **go back**, **change location/crop**, **take a photo**, **analyze now**, or **start over**; spoken commands can also open any visible button by its label, open the field, advisory, dashboard, or network view, or switch English/Hindi. The farmer can type replies as well. Device location is requested only after the farmer asks to use it, and the app asks by voice whether that device pin is actually the field. A spoken confirmation continues the flow without requiring a map or Analyze button click. The pin can still be moved manually. Browser speech features vary by browser and device; typed replies and map controls remain available when voice is unsupported or permission is denied. A spoken photo request opens Crop Doctor and attempts to open the browser's camera/photo picker; after a photo is selected, the existing diagnosis endpoint runs automatically. Some browsers require a tap to open the protected system photo picker.

The backend conversation uses `/api/v1/conversation` for answers and `/api/v1/conversation/control` for repeat, back, edit, restart, and analyze-now actions. Control requests contain `{ "session_id": "<random client UUID>", "lang": "en|hi", "action": "repeat|back|edit_location|edit_crop|edit_symptoms|edit_irrigation|start_over|analyze_now" }`. Session state is process-local and expires after two hours; it is not durable across Render restarts or multiple independent service instances. Do not use it as a persistent record.

When the field check completes, the frontend invokes the existing `/api/v1/analyze` and `/api/v1/advisory` routes. `/api/v1/evidence-quality` reports data availability, freshness, cloud filtering, and limitations. `/api/v1/follow-up` accepts `{ "field_state": {}, "evidence": [], "question": "...", "lang": "en" }` and returns a grounded short answer. `/api/v1/locations?q=<place>` uses Open-Meteo's geocoding provider and returns matching Indian locations. Existing `/api/v1/diagnose` handles crop photos; the voice card links to that existing Crop Doctor flow. Uploads are limited to 8 MB and supported image types.

### Data freshness and interpretation

Sentinel-2 imagery keeps its observation date, uses scenes with scene-wide cloud percentage below 60%, and applies SCL cloud/shadow masking. Per-field residual cloud quality is unavailable. NDVI is vegetation greenness, not a diagnosis. NDVI is considered fresh for this workflow for up to 60 days; missing, masked, or older observations are surfaced as insufficient for a current satellite-based diagnosis. Weather uses Open-Meteo and is marked fresh only when the retrieval timestamp is under 24 hours old; forecasts are not evidence of actual field conditions. SoilGrids is gridded 0–5 cm context, not a field soil test. Missing providers remain explicitly unavailable.

### Gemini models, usage, and optional Live voice

Routine advisory, grounded follow-up, and Crop Doctor image interpretation use the server-side `GEMINI_API_KEY` and the `GEMINI_MODEL` setting. The default is `gemini-3.8-flash`, a current stable Flash model with text and image input support. Change the model only to an ID available to the configured Google AI project. Gemini access, supported features, quotas, and model availability are project- and region-dependent; a paid account does not guarantee access to every model or remove rate limits. The Python SDK is pinned to `google-genai==2.33.0`.

Gemini Live is no longer exposed in the web UI; the `/api/v1/voice-session` endpoint below is retained for API compatibility. Set `GEMINI_LIVE_MODEL=gemini-3.8-live` only after confirming access and quota in Google AI Studio. The browser connects by WebSocket after the farmer explicitly starts Live and grants microphone permission. The backend uses the same server-side API key to issue a one-use ephemeral credential, configured to expire after five minutes and to allow starting a session for one minute. The long-lived key is never sent to browser code. Live sessions stream audio to Google; AgriNet does not retain audio. If provisioning, model access, quota, connection, or browser support fails, the browser-native speech and text paths remain available. Live has separate usage and quota implications from text and image calls.

Gemini calls have bounded retries for transient HTTP 429 and 5xx errors, honor `Retry-After` when a retry fits the request deadline, and do not retry recognized quota/billing exhaustion. Advisory and diagnosis endpoints return explicit unavailable/timeout responses rather than invented generated content. Repeated identical analysis inputs can use a bounded in-process cache; cache state is not shared across Render instances.

Monitor per-model usage, latency, errors, and rate-limit/quota metrics in Google AI Studio and your Google Cloud billing controls. Set project budgets/alerts where available and verify current prices before enabling Live or increasing usage; paid access remains subject to model-specific rate limits. Pricing and model IDs change over time. Refer to [Gemini models](https://ai.google.dev/gemini-api/docs/models), [Gemini Live](https://ai.google.dev/gemini-api/docs/live-api), [ephemeral tokens](https://ai.google.dev/gemini-api/docs/live-api/ephemeral-tokens), [Live WebSocket setup](https://ai.google.dev/gemini-api/docs/live-api/get-started-websocket), [pricing](https://ai.google.dev/gemini-api/docs/pricing), and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

### Local development

Use Python 3.12, copy `.env.example` to `.env`, and configure `GEMINI_API_KEY` for Gemini advisory, follow-up, and diagnosis. Keep the key in the server environment only; never add it to frontend settings, source control, or logs. `GEMINI_MODEL` defaults to `gemini-3.8-flash`; leave `GEMINI_LIVE_MODEL` blank for browser-native speech, or configure `gemini-3.8-live` after checking project model access, quota, and billing. Earth Engine requires `EE_PROJECT` or `EE_PROJECT_ID` and, where applicable, `EE_SERVICE_ACCOUNT_JSON`. Install dependencies and start the existing FastAPI app:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
uvicorn app.main:app --reload
```

The app is available at `http://127.0.0.1:8000`. Browser microphone and geolocation APIs require HTTPS or localhost, and require explicit user permission.

### Render deployment

1. Push the project to the connected GitHub repository and create or select its existing Render **Web Service**.
2. Select **Docker** as the runtime, use the repository root as the build context, and deploy the existing `Dockerfile` (it listens on Render's `PORT`).
3. In Render **Environment**, set `GEMINI_API_KEY`, `GEMINI_MODEL`, `EE_PROJECT` or `EE_PROJECT_ID`, and `EE_SERVICE_ACCOUNT_JSON` if using an Earth Engine service account. Set `PLANET_RADIUS_M` only if changing the current default. Add `GEMINI_LIVE_MODEL` only when the Google AI account has access to that Live model.
4. Save and deploy. Check `/api/health` and `/health/earth-engine`, then try the dashboard with browser speech/text. Test Live voice only after configuring its model and confirming Google AI quota/billing.

No developer workstation process is required at runtime. The process-local conversation session store is not shared between multiple Render instances and is cleared on restart; the conversation should be completed on the same running instance.

---

# Security and Secrets

Never commit:

```text
.env
```

or API credentials.

Use:

```text
.env.example
```

as the configuration template.

The application expects sensitive provider credentials to be supplied through environment variables.

---

# Limitations

AgriNet is a hackathon prototype and intentionally exposes its limitations.

## PlanetScope Availability

The included PlanetScope lookup data is limited.

The PlanetScope route requires an eligible stored observation within the configured search radius.

The system can therefore fall back to Earth Engine-based analysis where appropriate.

## SPEAR / PlanetScope Downstream Model

The SPEAR PlanetScope representation is used as a feature representation for the AgriNet downstream intelligence layer.

The downstream classifier is treated as a contextual signal and second opinion rather than ground truth.

## Soil Data

SoilGrids provides gridded soil information rather than laboratory measurements collected directly from the farmer's exact field.

High-stakes nutrient decisions should therefore consider local soil testing.

## Weather Data

Weather information is subject to the spatial and temporal resolution of the underlying weather provider.

## AI-Generated Advice

Gemini-generated agricultural recommendations are advisory outputs.

They should not replace:

* agronomists;
* local agricultural extension officers;
* KVK guidance;
* laboratory soil testing;
* field inspection.

## Crop Disease Diagnosis

Image-based disease assessment can be uncertain because of:

* image quality;
* lighting;
* leaf orientation;
* incomplete symptoms;
* visually similar diseases;
* insufficient visual evidence.

Uncertain cases should be escalated to agricultural experts.

---

# Design Principles

## 1. Evidence Before Generation

AI receives structured agricultural evidence instead of inventing field measurements.

## 2. Deterministic Computation Before LLM Reasoning

Numerical field indicators are computed outside the LLM.

## 3. Traceable Evidence

Measurements can be associated with source, date, interpretation, confidence, and evidence identifiers.

## 4. Provenance Is Visible

The interface distinguishes live, model-derived, precomputed, and demonstration evidence.

## 5. Uncertainty Is Exposed

Confidence and limitations are surfaced rather than hidden.

## 6. Interoperability Over Lock-In

The API contract is designed so different state-specific data sources and models can be connected through configurable adapters.

## 7. Multilingual by Design

The same underlying evidence can be communicated across multiple Indian languages.

## 8. Human Verification for High-Stakes Decisions

AI-generated agricultural recommendations support rather than replace agricultural expertise.

---

# Current Implementation vs Extension Points

## Implemented

The current prototype demonstrates:

* field-level satellite intelligence;
* PlanetScope/SPEAR contextual analysis;
* Earth Engine fallback;
* Sentinel-2 analysis;
* Dynamic World land-cover analysis;
* SoilGrids integration;
* Open-Meteo weather integration;
* deterministic field-health indicators;
* evidence bundles;
* evidence-ID validation;
* Gemini-grounded agricultural advisory;
* multilingual interface;
* voice read-out;
* multimodal Crop Doctor;
* common interoperability API;
* containerized deployment;
* live Render deployment.

## Extension Points

The architecture can be extended with:

* additional satellite providers;
* additional state agricultural datasets;
* state-specific agricultural models;
* laboratory soil-test integrations;
* additional crop-disease datasets;
* more Indian languages;
* state-specific advisory logic;
* larger evaluation datasets;
* institutional data adapters;
* additional weather products;
* larger-scale cloud infrastructure.

These are extension points rather than claims of existing live integrations.

---

# Architecture Against the Evaluation Criteria

## Problem-Solution Fit — 20%

The architecture directly addresses fragmented agricultural information by bringing satellite, soil, weather, and land-cover signals into a common field-level evidence pipeline.

---

## AI / Technical Execution — 25%

Google Gemini performs meaningful agricultural reasoning and multimodal crop analysis.

The deterministic intelligence layer provides measured field evidence that Gemini reasons over.

This separates:

```text
Measurement
    ↓
Evidence
    ↓
AI Reasoning
```

rather than using an LLM as a generic agricultural chatbot.

---

## Depth & Reach Across India — 20%

The common API + evidence architecture allows the same system to be adapted to:

* different states;
* different crops;
* different agricultural datasets;
* different agricultural models;
* different languages.

State-specific adapters provide a mechanism for connecting local agricultural systems without rebuilding the core platform.

---

## Impact Potential — 15%

AgriNet is designed as reusable agricultural intelligence infrastructure.

The same platform can support:

* farmers;
* agricultural extension workflows;
* state agricultural platforms;
* future institutional applications.

Its potential impact comes from reuse of a common intelligence and evidence layer rather than building isolated applications for each location.

---

## Deployability & Scalability — 20%

The prototype is already:

* containerized;
* API-driven;
* deployed;
* modular;
* provider-separated;
* designed around configurable state adapters.

This provides a technical foundation for incremental pilots and future state-level expansion.

Institutional deployment would additionally require appropriate data access, governance, validation, security, and operational integration.

---

# Why This Architecture Matters

AgriNet is not simply:

```text
Gemini + Satellite Data
```

It is a layered agricultural intelligence architecture:

```text
Heterogeneous Agricultural Data
             ↓
      Data Integration
             ↓
  Deterministic Field Intelligence
             ↓
       Evidence Bundle
             ↓
     Google Gemini Reasoning
             ↓
     Localized Advisory
             ↓
      Farmer / Institution
```

The same architecture can then be extended through:

```text
                 Common AgriNet Layer
                         │
        ┌────────────────┼────────────────┐
        │                │                │
      State A          State B          State C
      Adapter          Adapter          Adapter
        │                │                │
    Local Data       Local Data       Local Data
    Local Models     Local Models     Local Models
```

This is the architectural foundation for scaling the prototype from a demonstration into a reusable agricultural intelligence platform.

---

# Contributing

Potential contribution areas include:

* state-specific adapters;
* additional agricultural data sources;
* additional Indian languages;
* crop-specific intelligence;
* improved evidence schemas;
* agricultural evaluation datasets;
* disease-diagnosis evaluation;
* interoperability tooling;
* additional satellite integrations.

Contributions should preserve the project's core principles of:

**evidence, provenance, modularity, interoperability, and human verification.**

---

# AgriNet India

## From fragmented agricultural data to localized action.

```text
Satellite + Soil + Weather
            ↓
    Field Intelligence
            ↓
      Evidence Bundle
            ↓
     Gemini Reasoning
            ↓
   Multilingual Advisory
            ↓
      Farmer Action
```

**Live:** [https://agrinet-india.onrender.com/](https://agrinet-india.onrender.com/)

