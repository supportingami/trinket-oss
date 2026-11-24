# Proposal 0001: Offline-First Static Build & Low-Resource Distribution

- **Status:** Draft
- **Author:** Supporting African Maths Initiatives (SAMI)
- **Repository:** `supportingami/trinket-oss` (detached client-side-only fork)
- **Date:** 2026-11-24

---

## 1. Summary

This proposal defines the architecture for producing a **100% static, offline-capable build** of the client-side coding embeds in `supportingami/trinket-oss` (`python`, `html`, `blocks`, `glowscript`, `glowscript-blocks`, `music`), requiring **no backend server, no database, no user accounts, and no internet connection at runtime**.

The same codebase will support two deployment outputs:

1. **Hosted / LAN Docker deployment (existing):** Continues serving connected UK schools and optional local school servers.
2. **Static offline bundle (`dist/`):** A self-contained folder of HTML, CSS, JS, and vendor assets suitable for offline distribution via **Kolibri** (HTML5 app), **RACHEL** (OER2Go module), **refurbished school PCs** (e.g. The Turing Trust), USB drives, or a browser **PWA** (Service Worker cache).

---

## 2. Motivation

- **Execution is already 100% client-side:** All enabled languages execute entirely in the browser (Skulpt for Python, sandboxed `<iframe>` for HTML/CSS/JS, Blockly → Skulpt, GlowScript WebGL, MIDI.js/VexFlow for Music). The Docker stack (`app`, `mongodb`, `redis`) is only used to render Nunjucks templates and handle optional accounts/cloud-saved trinkets.
- **Low-resource & zero-connectivity schools:** Many partner schools in Sub-Saharan Africa have unreliable or no internet connectivity and run older low-spec hardware. Cloud IDEs (Replit, Colab, hosted Trinket) fail in these environments and carry ongoing per-student compute costs.
- **Privacy & zero IT friction in UK schools:** Zero-account, client-side execution eliminates student PII collection, GDPR/DPIA onboarding overhead, and password-reset maintenance, while integrating cleanly with existing school LMS workflows (Google Classroom, Microsoft Teams, Moodle) via local file export/import or `#code=` embeds.

---

## 3. Current Blockers to Offline Operation

Even when running via Docker on an isolated LAN, the client-side embeds currently fail offline because of external CDN dependencies and runtime template rendering.

### 3.1 External CDN Dependencies Audit

| Template | External URL / Helper | Offline Action |
|---|---|---|
| `lib/views/embed/base.html` | `font-awesome@4.7.0`, `jquery@2.1.1`, `modernizr@2.8.2`, `crypto-js@3.1.2` (`md5`, `sha1`, `aes`), `moment@2.18.1` | Vendor locally into `public/components/` |
| `lib/views/embed/base.html` | `localStorage@2.0.1` Flash SWF polyfill (note: `<script type="text/javacript">` typo) | Remove (obsolete; native `localStorage` is universal) |
| `lib/views/embed/base.html` | `includes/recaptcha.html` | Omit in offline builds |
| `lib/views/embed/base.html` | `component()`: `font-mfizz`, `jszip`, `jszip-utils`, `file-saver.js`, `lodash`, `bluebird` | Vendor locally and resolve via `/components/...` |
| `lib/views/embed/python.html` | `highlight.js@8.0`, `rangeslider.js@2.1.1`, `weather-icons@2.0.9`, `diff_match_patch@20121119`, `dropzone@4.0.1` | Vendor locally (drop `dropzone` if assets disabled) |
| `lib/views/embed/python.html` | `sockjs-client@0.3.4`, `socket.io@1.7.4` | Remove from client-side Python embed (unused) |
| `lib/views/embed/python.html` | `component()`: `ace-builds`, `jquery-ui` | Vendor locally (`ace-builds` modes/workers included) |
| `lib/views/embed/html.html` | `highlight.js@8.0`, `dropzone@4.0.1`, `component('ace-builds')`, `component('jquery-ui')` | Reuse vendored copies |
| `lib/views/embed/blocks.html` | `jquery-ui@1.10.4` CSS (`code.jquery.com`), `highlight.js@8.0`, `component('ace-builds')`, `component('filereader')` | Vendor locally |
| `lib/views/embed/glowscript.html` & `glowscript-blocks.html` | `mathjax@2.3`, `jquery-ui@1.10.4` CSS, `highlight.js@8.0`, `jquery@2.1.1` (iframe), `component('ace-builds')`, `component('jquery-ui')`, `component('filereader')` | Vendor locally (or make MathJax optional to keep bundle small) |
| `lib/views/embed/music.html` | `component('jquery-ui')`, `component('yamljs')` | Vendor locally |

*(Skulpt itself is already served locally from `/components/skulpt/` when `APP_EMBED_SKULPT_LOCAL=true`.)*

### 3.2 Server-Side Template Rendering
Embed HTML pages are currently rendered per request by Node/Hapi using Nunjucks (`lib/views/embed/*.html`), injecting `trinket.config`, `trinketObject`, and asset bundles (`cachify_js`).

### 3.3 Server-Backed UI Actions
In `public/js/embed/embed.js`, several UI controls assume backend API endpoints exist:
- User login / signup links
- Cloud Save / Remix / Share URL creation
- Server-side draft sync & client metrics/error logging (`logClientCodeError`, `logClientMetric`)
- External `urllib.request.urlopen` calls (gracefully fail offline; bundled local files continue to work)

---

## 4. Proposed Architecture

### 4.1 Phase 1: Complete Local Asset Vendoring (Benefits Both Docker LAN & Static Builds)
- Extend `npm run setup-vendor` (or add a dedicated vendoring script) to fetch pinned versions of all CDN libraries listed in Section 3.1 into `public/components/`.
- Update `lib/util/component.js` and `config/default.yaml` to support a single `localVendor: true` toggle (default `true` for offline builds and optional for Docker LAN deployments).
- Strip `recaptcha.html`, the broken Flash `localStorage` polyfill, and unused `socket.io`/`sockjs` tags from client-side embeds.
- Verify zero external network requests in browser DevTools with network set to **Offline**.

### 4.2 Phase 2: Static Build Pipeline (`npm run build:static`)
Add a Node build script (e.g. `scripts/build-static.js`) that:
1. Compiles CSS via `npm run build:css` (Vite).
2. Uses Nunjucks directly (no Hapi/Mongo/Redis required) to pre-render each enabled language template into static HTML with relative paths:
   - `dist/embed/python/index.html`
   - `dist/embed/html/index.html`
   - `dist/embed/blocks/index.html` (+ `blocks-iframe.html`)
   - `dist/embed/glowscript/index.html`
   - `dist/embed/glowscript-blocks/index.html` (+ `glowscript-blocks-iframe.html`)
   - `dist/embed/music/index.html`
3. Sets static config flags:
   - `offlineMode: true`
   - `logClientCodeError: false`
   - `logClientMetric: false`
   - `assetsEnabled: false` (unless local bundled assets are present)
4. Copies required static assets (`public/css`, `public/js`, `public/img`, `public/components`) into `dist/`, with optional language filtering (e.g. `--langs=python,blocks` for a minimal ~10–15 MB maths/coding bundle).

### 4.3 Phase 3: Offline Mode UX & Account-Free Persistence
When `trinket.config.offlineMode === true`:
- **Hide server-only UI:** Login, Sign Up, Cloud Save/Remix, Share URL modal, and email forms.
- **Keep & enhance local persistence:**
  - Existing `localStorage` auto-restore for in-progress code.
  - Existing **Download ZIP** (`JSZip` + `FileSaver`).
  - Add **Open Local File** (`.py`, `.html`, `.zip`) so students can save work to a school network drive, Linux home directory, or USB stick and reopen it in a later lesson.
  - Optional lightweight **local project switcher** (`IndexedDB`) for shared lab PCs where multiple students share one OS login.
- **Strict Separation of Runtime vs. Content (Embed-First Design):**
  - `supportingami/trinket-oss` remains **content-agnostic runtime infrastructure**—it does **not** bundle curriculum or exam materials inside the repo.
  - External learning sites, Kolibri/RACHEL content packs, UK exam-prep portals, or partner tools (e.g. IDEMS / R-Instat tutorials) **embed** the static Trinket build via `<iframe>` and pass starter code, data files, instructions, and unit tests in via `#code=` URL hashes or `postMessage` (`externalInit` / `listen` APIs already present in `embed.js`).

### 4.4 Phase 4: Distribution Packaging
From the single `dist/` output, generate target-specific packages:

| Target | Packaging | Account / Progress Model |
|---|---|---|
| **Kolibri (Learning Equality)** | HTML5 ZIP app channel via Kolibri Studio / Ricecooker | Handled natively by Kolibri (offline student accounts, classes, coach dashboards) |
| **RACHEL (World Possible)** | Static OER2Go / RACHEL module folder | Zero accounts; local file save/open |
| **Refurbished School PCs (e.g. Turing Trust)** | Static bundle + lightweight local HTTP launcher (avoids `file://` origin restrictions on `localStorage` & Ace workers) | OS user folders or local `.py`/`.zip` save/open |
| **Intermittent-Connectivity Schools (UK / Global)** | Static hosting + `manifest.json` + Service Worker (PWA) | Zero accounts; students submit exported files to Google Classroom / Teams / Moodle |

---

## 5. Non-Goals & Related Proposals

- **No server-side languages (`python3`, `java`, `R`, `pygame`):** Out of scope here. See [Proposal 0002](./0002-wasm-python3-and-r.md) for optional client-side WebAssembly runtimes (`Pyodide` and `webR`).
- **No runtime cloud AI / LLMs:** Out of scope here. See [Proposal 0003](./0003-offline-ai-literacy-and-authoring.md) for offline AI literacy pedagogy and upstream AI-assisted authoring.
- **No custom cloud account system or LMS:** Connected schools that want cloud accounts can use the existing Docker stack or their own LMS; offline schools use local files or Kolibri's built-in accounts.
- **No upstream merge required:** This fork is maintained independently for educational/charitable deployment.

---

## 6. Phased Milestones & Verification

1. **Milestone 1 — Offline Python POC (~1–2 days):** Vendor CDN assets for `base.html` + `python.html`, build `scripts/build-static.js` for `python`, verify Python + Turtle + Pygal + Matplotlib run with DevTools set to Offline and zero failed network requests. Measure bundle size (MB).
2. **Milestone 2 — Offline UX & Embed Host API (~3–4 days):** Add `offlineMode` flag in `embed.js`, hide broken cloud actions, add local `.py`/`.zip` open button, and verify/document the `postMessage` + `#code=` host-embed contract so external learning platforms can inject starter files, instructions, and tests cleanly.
3. **Milestone 3 — Multi-Language & Distribution Packaging (~1 week):** Extend static build to `html`, `blocks`, `glowscript`, `music`; produce sample Kolibri HTML5 zip, RACHEL module, and PWA Service Worker.

---

## 7. Open Questions

1. **MathJax bundle size:** MathJax 2.3 is large if vendored in full; evaluate whether KaTeX or a minimal MathJax subset is better for offline maths instructions and GlowScript.
2. **Curriculum format:** Align the static `?lesson=` JSON/Markdown format with SAMI's existing maths camp / school materials so teachers can author lessons without touching code.
