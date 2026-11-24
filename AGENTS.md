# AGENTS.md — trinket-oss (client-side-only usage)

> This fork is used **client-side only**. Do not start, modify, or depend on the backend server, DB, or server-side language runners.

No `AGENTS.md` existed previously. This file is the canonical orientation for AI agents.

## 1. What this repo is

Trinket OSS — browser-based coding education platform. Original upstream supports hybrid execution, but **we only use in-browser execution**:

* Python 2 via Skulpt (Python-to-JS compiler)
* HTML/CSS/JS in sandboxed `<iframe>`
* Blocks (Blockly → Python → Skulpt)
* GlowScript / GlowScript-Blocks (WebGL 3D)
* Music (MIDI.js + VexFlow)
* Console (Skulpt REPL)

Server-side languages (`python3`, `java`, `R`, `pygame` via Docker + WebSockets) are **disabled and out of scope**. See `config/default.yaml:15-18`, `config/local.yaml:117-125`.

Canonical lang list: `config/constants.js:4-16`:
`python, python3, console, music, html, blocks, glowscript, java, glowscript-blocks, R, pygame`

## 2. How we deploy / host

* CI (`.github/workflows/deploy.yml:1-50`) is **build-only**: on push to `main` it builds `app` (from repo root `Dockerfile`) and `python-runner` (from `serverside/python-runner`) and pushes `ghcr.io/supportingami/trinket-oss/{app,python-runner}:latest`. No SSH, webhook, Portainer, or Watchtower deploy step.
* Prod deploy is **manual**: on the host that serves `trinket.samicharity.co.uk`, run `docker-compose -f docker-compose.prod.yml up -d` which pulls those `:latest` images (`docker-compose.prod.yml:6,93`). Reverse proxy maps `/ → trinket:3000`, `/python3/ → python-runner:8080` (see `INTEGRATION_FINDINGS.md:141-150`).
* Production host is injected at container startup via `APP_URL_HOSTNAME` / `APP_URL_PROTOCOL` / `APP_URL_PORT` → `config/local.yaml:app.url` via `scripts/generate-config.js:35-40`.
* Committed defaults are `localhost` (`docker-compose*.yml`) and `trinket.dev` (`config/default.yaml:28-33`). Do not hardcode the prod hostname in code — use relative URLs (`/embed/...`) or `APP_URL_HOSTNAME` in docs.
* No `.env` files are committed. `config/local.yaml` is gitignored (see `.gitignore:24`). Never commit secrets.

## 3. Client-side vs server-side matrix

| Lang | Route | Template `lib/views/embed/` | Driver `public/js/embed/` | Tech | Client-only? |
|---|---|---|---|---|---|
| `python` | `/embed/python` | `python.html` | `python.js` + `analytics/activity-log.js`, `python/hints.js`, `python/unittest.js` | Skulpt + jq-console + turtle/pygal/matplotlib shims | ✅ YES |
| `html` | `/embed/html` | `html.html` | `html.js` | Sandboxed `<iframe id="htmlOutput">` | ✅ YES |
| `blocks` | `/embed/blocks` | `blocks.html` + `blocks-iframe.html` | `blocks.js` + `blocks/shared.js` | Blockly → `Blockly.Python.workspaceToCode` → Skulpt | ✅ YES |
| `glowscript` | `/embed/glowscript` | `glowscript.html` | `glowscript.js` | GlowScript `RScompiler`+`RSrun` in iframe, WebGL | ✅ YES |
| `glowscript-blocks` | `/embed/glowscript-blocks` | `glowscript-blocks.html` + `glowscript-blocks-iframe.html` | `glowscript-blocks.js` | Blockly → GlowScript | ✅ YES |
| `music` | `/embed/music` | `music.html` | `music.js` + `music/parser.js`, `music/notation.js` | MIDI.js + VexFlow + yamljs | ✅ YES |
| `console` | legacy REPL | none (no `console.html`) | `console.js` | Skulpt REPL | ✅ YES |
| `python3`, `java`, `R`, `pygame` | `/embed/python3` etc. | `python3.html`, `java.html`, `R.html`, `pygame.html` | `python3.js`/`java.js`/`R.js`/`pygame.js` + `server.js` + socket.io | Docker runners via `http://localhost:8080/...` | ❌ NO — do not touch |

Details: `COMPONENTS.md:9-46`, `INTEGRATION_FINDINGS.md:34-46`, `config/default.yaml:5-18`.

## 4. Embed integration (what external sites use)

Canonical snippet built in `public/js/embed/embed.js:1562-1565`:
```html
<iframe src="/embed/<type>/<shortCode>" width="100%" height="356" frameborder="0" marginwidth="0" marginheight="0" allowfullscreen></iframe>
```

Routes (`config/routes.js:386-443`):
* `GET /embed/{lang}/{trinketId}` → `embed/{lang}.html`
* `GET /embed/{lang}` (default trinket via `getDefaultTrinket`)
* `GET /embed/blocks-iframe`, `GET /embed/glowscript-blocks-iframe`
* `GET /tools/{version}/jekyll/embed/{lang}`
* `GET /assignment-embed[/-feedback/-viewonly]/{lang}/{trinketId}` (courseware — ignore unless asked)

Query params honored client-side (`public/js/embed/embed.js:158-172`, controller guards in `lib/controllers/trinket.js:634-730`):
`outputOnly`, `toggleCode`, `runMode` (`run`/`console`/`autorun`/`calculator`), `runOption`, `start` (`code`/`result`/`instructions`), `showInstructions`/`hideInstructions`/`hideGeneratedCode`, `snapshot`, `shareType`, `inLibrary`, `listen`, `externalInit`, `noStorage`/`autoRestore`/`clearStorage`, `font`, `no-assets`, `category`

`#code` hash override (`public/js/embed/embed.js:46-104`):
`#code=<encodeURIComponent(code)>`. Multi-file: split on `\n----{name}----\n` → JSON `[{name,content}]`. Interactive sessions (`console` or `python+runMode=console`): only `>>>`/`...` lines.

postMessage (`window.parent.postMessage(..., "*")`):
* `"initialised"` (python only, `python.js:1082-1084`), `"TrinketApp ready"`, `"started"` / `"complete"` around runs, `"autorestored"`, `"reset"`, `"trinket.code.autosave"`, serialized trinket on change when `assignment|listen`
* GlowScript iframe↔parent: `"glowscript.snapshot"`, `{glowscript.error}`, `{snapshot:dataURL}`, `{glowscript.print}` in calculator mode
* Blocks: `window.blocklyLoaded(Blockly)` polled, `{Blockly.warn|error}`
* `window.readyForSnapshot=true` set on run completion for snapshot automation.

## 5. Frontend code map — edit here

* `public/js/embed/embed.js` — base `TrinketApp` (query/hash/storage/session-restore, share/embed modals, draft/autosave, download, analytics). All langs extend `TrinketAPI`.
* `public/js/embed/python.js` — Skulpt eval/console/check, `inputfun`, turtle focus, `urllib` shim, Highcharts pygal.
* `public/js/embed/html.js` (392 lines) — writes docs into sandboxed iframe, `sandbox="allow-scripts allow-forms allow-modals allow-popups"` (no `allow-same-origin`), perms from `config/default.yaml:437-439`.
* `public/js/embed/blocks.js`, `glowscript.js`, `glowscript-blocks.js`, `music.js`, `console.js`
* Shared: `public/js/plugins/code-editor.js` (Ace wrapper), `public/js/plugins/asset-browser.js`, `public/js/skulpt/wrapper.js` + `signal.js`, `public/js/util/{cache,template,guid}.js`, `public/js/{trinket,trinket-config,trinket-share,trinket-roles}.js`
* Templates: `lib/views/embed/base.html` (bundle in `base.html:518-529`, hidden inputs `base.html:71-89`), per-lang templates above.
* Styles: `static/scss/embed/embed.scss` → `public/css/embed.css` via Vite. Partials: `python`, `console`, `music`, `html`, `blocks`, `glowscript`, `testoutput`, etc.
* Vendor: `public/components/` is gitignored (`.bowerrc`). Only `highcharts/` checked in. Resolved via `lib/util/component.js` → CDN or `/components/...` fallback. See `COMPONENTS.md`.

Skulpt specifics:
* Loader: `python.html:155-161` — `/components/skulpt/skulpt[.min].js` + `skulpt-stdlib.js` locally if `embed.skulpt.local=true`, else CDN `AWS_CDN_HOST`. Shims: `js/skulpt/signal.js`, `js/skulpt/wrapper.js` (`default.yaml:321-324`).
* Single-graphics-library enforcement: `^(turtle|processing|matplotlib\.pyplot|image|pygal)$` in `wrapper.js:38`.
* `urllib.request.urlopen` (`python.js:195-253`): tries `{proxy}?url=<target>` first if `app.embed.proxy` set, else direct fetch. Empty default = zero-server friendly (works for `Access-Control-Allow-Origin: *` e.g. OMDB). Optional Cloudflare Worker in `serverside/cors-proxy/`.
* `pygal` renders via Highcharts (`public/js/skulpt/pygal/__init__.js`), `turtle` via canvas overlay, `matplotlib` via D3.
* Stop: `Sk_interrupt=true` + `Sk_signal(0)` (`python.js:631-643`).

## 6. Config that matters (client-side)

`config/default.yaml`:
* `features.trinkets.{python,html,blocks,glowscript,glowscript-blocks,console,music}: true` — keep on. `python3/java/pygame/R: false` — keep off.
* `features.assets: false` (needs S3), `features.courses: true`, `features.accessibilityToggle: false`
* `app.embed.proxy: ''`, `app.embed.skulpt.local/min: false` (local dev forces `true/true` in `local.yaml:23-26`), `app.embed.common.skulpt_js`, `app.embed.{logClientCodeError,logClientMetric,draftDebounce:1000,autosaveDebounce:1000,enableLogin,enableCopyRemix}` (`default.yaml:310-330`)
* UX lists: `app.autorun`, `app.outputOnly`, `app.toggleCode`, `app.downloadable`, `app.uploadable:[blocks,glowscript-blocks]`, `app.configurable`, `app.nodraft:[console]`, `app.notShareable:[pygame]`, `app.hideGeneratedCode`, `app.runOption.{python,python3,R}`, `app.glowscript.{defaultVersion:3.2,blocksVersion:2.7}` (`default.yaml:239-309`)
* `sandbox.mode: local`, `sandbox.local.permissions` (never add `allow-same-origin`)

Env → YAML: `scripts/generate-config.js` maps `ENABLE_PYTHON|HTML|BLOCKS|GLOWSCRIPT|... !=='false'` (default on), `ENABLE_PYTHON3|JAVA|R|PYGAME ==='true'` (default off), `APP_EMBED_SKULPT_LOCAL/MIN`, `AWS_CDN_HOST`.

## 7. Build / dev (no backend needed)

* `npm install` (Node 18+, `Dockerfile:7-17`)
* `npm run build` = `npm run build:css` = `vite build` — SCSS only (`vite.config.mjs:1-34`, inputs `static/scss/base.scss` + `static/scss/embed/embed.scss` → `public/css/`). `npm run watch:css` for watch.
* `npm test` = `mocha` — backend-focused, usually not needed for embed-only changes.
* Do NOT run: `node app.js`, `docker-compose up`, `docker-compose -f docker-compose.prod.yml up`, `cd serverside && docker compose --profile ... up`. No Mongo/Redis needed for pure frontend work.
* To preview embeds you need the running deployment (or `node app.js` + Mongo locally if you explicitly want backend — ask first).

## 8. Conventions

* From `CONTRIBUTING.md:22-76`: 2-space indent, single quotes, semicolons, <120 char, `npm test` before PR.
* AngularJS 1.x + Foundation 5 + Ace + jq-console — legacy stack, keep changes minimal and compatible.
* CDN libs (cdnjs, googleapis) are pinned in templates — don't upgrade without checking `COMPONENTS.md`.

## 9. Pull Requests — always our fork

* Only `origin` (`supportingami/trinket-oss`) should exist locally — `git remote -v` must show only origin. Do not add `trinketapp/trinket-oss` as a remote.
* Create branches from `main` and open PRs as `supportingami/trinket-oss:main <- <branch>`, e.g. `gh pr create --repo supportingami/trinket-oss --base main --head <branch>`.
* Never use `--repo trinketapp/trinket-oss`, never add/push to upstream.
* GitHub cannot block cross-fork PRs server-side (we don't control upstream), so this file is the enforcement. If you need to compare with upstream, add it temporarily read-only and remove it after (`git remote add upstream https://github.com/trinketapp/trinket-oss.git --no-tags; git fetch upstream; ...; git remote remove upstream`).

## 10. Do / Don't for agents

DO:
* Edit `public/js/embed/*`, `lib/views/embed/{python,html,blocks,glowscript,glowscript-blocks,music,base}.html`, `static/scss/embed/*`, `public/js/skulpt/*`, `config/default.yaml:features.trinkets` client flags.
* Use relative `/embed/...` URLs in examples.
* Keep `outputOnly` / `snapshot` paths working (used for static rendering).

DON'T:
* Touch `app.js`, `lib/controllers/`, `lib/models/`, `lib/auth/`, `lib/util/{helpers,routeParser,store*,queues,mailer}`, `lib/workers/`, `config/{routes,api_routes,db,redis}.js`, `serverside/**`, `lib/views/embed/{python3,java,R,pygame}.html`, `app.js:307-350` generated-file proxy, or `features.trinkets.{python3,java,R,pygame}`.
* Enable server-side runners, add `socket.io` to client langs, or add `allow-same-origin` to sandbox.
* Commit `config/local.yaml`, `.env`, `public/components/`, or hardcode production hostnames/secrets.
