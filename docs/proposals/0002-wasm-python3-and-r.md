# Proposal 0002: Client-Side Python 3 & R via WebAssembly

- **Status:** Draft (Independent / Composable with [Proposal 0001](./0001-offline-static-build.md) & [Proposal 0003](./0003-offline-ai-literacy-and-authoring.md))
- **Author:** Supporting African Maths Initiatives (SAMI)
- **Repository:** `supportingami/trinket-oss`
- **Date:** 2026-11-24

---

## 1. Summary

This proposal explores adding **optional, 100% client-side WebAssembly (Wasm) execution engines**—running inside browser **Web Workers**—to support full **Python 3** (via [Pyodide](https://pyodide.org/) or [MicroPython Wasm](https://pyscript.net/)) and **R** (via [webR](https://docs.r-wasm.org/webr/latest/)) without reintroducing Docker language runners or server-side WebSockets.

This workstream is **independent and composable**: it can be deployed on the existing hosted Trinket fork immediately (eliminating server-side runner costs) or combined with the static offline build in [Proposal 0001](./0001-offline-static-build.md) depending on funding and partner priorities.

---

## 2. Motivation

- **Bridging the Skulpt syntax & library gap:** Skulpt is fast and tiny (~1–2 MB), making it ideal for introductory coding, Turtle graphics, and older 2 GB hardware. However, Skulpt implements a Python 2/3 hybrid subset and lacks full standard library and modern scientific Python packages (`numpy`, `scipy`, `pandas`, `sympy`, full `matplotlib`) required for **UK GCSE / A-Level Computer Science** and **senior secondary / university mathematics**.
- **Unlocking offline statistics & data science with R:** Many African university mathematics and statistics initiatives (including SAMI's broader network) use **R** for data analysis and applied statistics. Replacing Trinket's server-side R Docker runner with **webR** enables zero-server, offline-capable R exercises with base plots and `ggplot2`/`dplyr`.
- **Zero-server sustainability:** Running Python 3 and R in Wasm Web Workers eliminates the security sandboxing, scaling, and hosting costs of server-side Docker code runners.

---

## 3. Candidate Runtimes & Trade-Offs

| Language | Runtime | Capabilities | Offline Footprint & RAM | Best Fit |
|---|---|---|---|---|
| **Python 3 (Full / Scientific)** | **Pyodide** (CPython in Wasm) | Full Python 3.12+, `numpy`, `matplotlib`, `scipy`, `sympy`, `pandas` | ~10–15 MB base (+10–30 MB scientific pkgs); 2–5s cold start; ~150–250 MB RAM | UK GCSE/A-Level CS, secondary/university maths & data science (4 GB+ RAM devices) |
| **Python 3 (Minimal)** | **MicroPython Wasm** | Modern Python 3 syntax, near-instant start, tiny memory | ~300 KB; <0.5s start; minimal RAM | Intro Python 3 syntax on very low-spec hardware (no `numpy`/`turtle`) |
| **R (Statistics)** | **webR** (Posit) | Full R 4.x, base graphics, `ggplot2`, `dplyr` | ~30–60 MB with core packages; 3–6s cold start; ~200 MB+ RAM | Senior secondary & university statistics / data literacy workshops |

*(Java and Pygame in Wasm are explicitly excluded due to licensing, bundle size, and reliability constraints.)*

---

## 4. Architecture Sketch

1. **Web Worker Isolation:** Run Pyodide / webR inside dedicated Web Workers so infinite loops can be cleanly interrupted (via `Worker.terminate()` or `SharedArrayBuffer` / interrupt buffer) without freezing the editor UI.
2. **Unified `TrinketAPI` Driver:** Implement new client-side drivers (`public/js/embed/python3-wasm.js`, `public/js/embed/r-wasm.js`) adhering to the same `TrinketAPI` interface as `python.js`, reusing Ace Editor, jq-console output, plot canvas rendering, and offline local file save/open.
3. **Optional Modular Bundles:** Keep Wasm runtimes **opt-in** during `npm run build:static` (e.g. `--langs=python,python3-wasm,r-wasm`) so low-storage deployments (e.g. basic Raspberry Pi / RACHEL packs) can stay lightweight with Skulpt while higher-spec labs include Pyodide and/or webR.
4. **Offline Package Caching:** Pre-bundle required Python wheels (`.whl`) and R Wasm packages locally inside `dist/wasm/` so `micropip` / `webr::install()` never requires internet access at runtime.

---

## 5. Funding & Partnership Fit

- **R Consortium ISC Grants** (`r-consortium.org` — two cycles/year: April–May and September–October; no published hard cap, focused milestone-based grants paid 50% on signing / 50% on completion): Explicitly funds R ecosystem infrastructure and scalable educational technology. An embeddable, offline-capable `webR` runtime widget—particularly in partnership with **IDEMS International** (creators of **R-Instat**, with close ties to SAMI) so external R-Instat / statistics learning materials can embed live, zero-server R exercises—is a strong fit.
- **NLnet Foundation (NGI / Open Internet Stack):** Strong technical R&D fit (€5k–€50k) for open-source WebAssembly / Web Worker educational runtimes running fully offline and privacy-preserving in standard browsers.
- **Python Ecosystem Note:** The PSF Grants Program is currently focused on regional events/workshops rather than software tooling, and NumFOCUS Small Development Grants (up to ~$10k) require affiliation with a NumFOCUS project (e.g. partnering upstream with Pyodide). Python 3 / exam-prep tooling is therefore better funded via **NLnet** (for the runtime layer) or **UK education / STEM trusts & subject associations** (for the external exam-focused learning materials layer that embeds Trinket).
- **Separation of Concerns:** As in [Proposal 0001](./0001-offline-static-build.md), `trinket-oss` provides only the embeddable Wasm runtime; R-Instat tutorials, statistics courses, and UK GCSE/A-Level exam resources live in separate repositories/platforms that embed it.

---

## 6. Relationship to Other Proposals & Hardware Notes

- **Standalone or Composable:** Works equally well on the existing hosted fork (zero server-side code-runner containers) or packaged inside a static offline build ([Proposal 0001](./0001-offline-static-build.md)). Neither proposal blocks the other.
- **Hardware Benchmarking:** Needs benchmarking on representative target devices (e.g. 4 GB refurbished Turing Trust Linux PCs and school Chromebooks) to confirm acceptable startup time and memory headroom.
