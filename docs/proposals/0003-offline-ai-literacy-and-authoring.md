# Proposal 0003: Offline-Capable AI Literacy & AI-Assisted Curriculum Authoring

- **Status:** Draft (Independent / Composable with [Proposal 0001](./0001-offline-static-build.md) & [Proposal 0002](./0002-wasm-python3-and-r.md))
- **Author:** Supporting African Maths Initiatives (SAMI)
- **Repository:** `supportingami/trinket-oss`
- **Date:** 2026-11-24

---

## 1. Summary

This proposal defines a **pragmatic, safeguarding-first role for AI** within SAMI's offline coding platform—explicitly **avoiding runtime cloud LLMs** in the classroom while leveraging two high-impact, low-risk opportunities:

1. **Offline AI & Data Literacy Curriculum (Pedagogy):** Teaching students *the mathematics and mechanics behind AI* using pure offline Python and small bundled datasets.
2. **Upstream AI-Assisted Authoring & Localisation (Content Pipeline):** Using AI tools *during curriculum development* (with human teacher review) to accelerate lesson translation, accessibility, and automated unit-test/hint generation before baking static lessons into the offline bundle.

---

## 2. Why Not an In-IDE AI Tutor?

Embedding a live LLM tutor inside the student coding environment is explicitly a **non-goal**:

- **Breaks offline-first:** Cloud APIs fail in low-connectivity schools and reintroduce recurring per-student token costs.
- **Hardware mismatch for local LLMs:** Even quantized 1B–3B browser models (WebLLM/WebGPU) require 1–2 GB+ downloads and modern GPUs / 8 GB+ RAM—unrealistic for refurbished school labs.
- **Safeguarding, privacy & pedagogy:** Live chatbots raise child-safety, hallucination, and GDPR concerns in schools and frequently short-circuit novice problem-solving.

Instead, the platform leans on **deterministic, zero-cost, hallucination-free feedback** already present in the codebase (`public/js/embed/python/hints.js` and `public/js/embed/python/unittest.js`) to give students instant guidance 100% offline.

---

## 3. Proposed Workstreams

### 3.1 Workstream A: "Maths Behind AI" Offline Curriculum Modules
Leverage SAMI's core mathematics expertise to build `[8–12]` open-licensed, hands-on lessons that demystify AI without requiring internet or GPUs:
- **Bundled Micro-Datasets:** Clean, small CSV/JSON datasets (agriculture, weather, public health, school maths examples) packaged directly inside the static bundle.
- **Core Concepts in Pure Python (Skulpt / optional Pyodide):**
  - Data exploration & visualisation (Pygal / Matplotlib)
  - Linear regression & lines of best fit from scratch
  - Simple classifiers (k-nearest neighbours, decision rules)
  - Evaluating accuracy, overfitting, and **dataset bias / fairness**
- **Built-in Deterministic Checking:** Each lesson includes automated unit tests (`unittest.js`) and rule-based hints (`hints.js`) so students get immediate feedback offline.

### 3.2 Workstream B: Upstream AI-Assisted Authoring & Localisation Pipeline
Build lightweight, human-in-the-loop authoring scripts (used by SAMI/teachers *online*, never shipped to students) to:
- Draft and verify `unittest.js` test suites and `hints.js` error hints for new exercises.
- Translate static lesson instructions and UI strings into priority regional languages (e.g. **Swahili, French, Amharic**) with structured educator review before publishing.
- Generate accessible descriptions and differentiated extension prompts (scaffolded vs. stretch tasks) for mixed-ability classrooms.

---

## 4. Funding & Positioning Fit

Many UK and international STEM funders currently prioritise **"AI literacy"** and **"responsible AI education"** (e.g. UK digital skills initiatives, corporate tech foundations, African Union IEA, international education trusts).

This proposal lets SAMI credibly access AI-education funding **without compromising its offline-first, low-resource, child-safe principles**—offering a grounded alternative to LLM hype by focusing on mathematical foundations, critical data literacy, and deterministic classroom feedback.

---

## 5. Architecture Boundary & Composability

- **Separation of Concerns:** The AI/data literacy lessons, micro-datasets, and authoring/translation scripts live in a **separate curriculum repository** that embeds Trinket via `<iframe>` + `#code=` / `postMessage` (passing starter code, dataset files, and `unittest.js` test suites from the host page). `trinket-oss` itself stays content-agnostic.
- **Independent of Funding Order:** Can run immediately on the existing hosted fork with Skulpt, or be deployed offline via [Proposal 0001](./0001-offline-static-build.md), and can optionally target Pyodide ([Proposal 0002](./0002-wasm-python3-and-r.md)) for richer data-science modules where available.
