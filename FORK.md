# Fork notes — `supportingami/trinket-oss` vs `trinketapp/trinket-oss`

Treat this repo as **detached** for all intents and purposes: no upstream remote, no upstream PRs, no upstream issues — everything targets `origin`. (Technically a GitHub fork, but no agent workflow may reference `trinketapp/trinket-oss` as a target — see `AGENTS.md §9`.)

* `origin` = `https://github.com/supportingami/trinket-oss.git` (fetch+push). No `upstream` remote locally (removed to prevent accidental PRs to `trinketapp/trinket-oss` — see `AGENTS.md §9`).
* `32` commits ahead of `upstream/main` as of 2026-11-24 (measured before remote removal via `git rev-list --count upstream/main..main`). No behind-divergence fetched.
* PRs must target `supportingami/trinket-oss:main`, never upstream.

## Deployment (ours)

* **Where:** Portainer stack hosted by c2dev.
* **URL:** `https://trinket.samicharity.co.uk` — low risk to record here, already committed as example host in `INTEGRATION_FINDINGS.md:105,113,143` and `serverside/cors-proxy/`. No secrets, IPs, or credentials in this file.
* **How:** CI is build-only (`.github/workflows/deploy.yml` — `main` → `ghcr.io/supportingami/trinket-oss/{app,python-runner}:latest`). Prod is manual `docker-compose -f docker-compose.prod.yml up -d` on the Portainer host pulling those `:latest` images. Reverse proxy: `/ → trinket:3000`, `/python3/ → python-runner:8080` (see `INTEGRATION_FINDINGS.md:141-150`).
* Host config via `APP_URL_HOSTNAME` / `APP_URL_PROTOCOL` / `APP_URL_PORT` → `scripts/generate-config.js` → `config/local.yaml` (gitignored). No `.env` committed.

We only use **client-side** langs in prod (`python/html/blocks/glowscript/glowscript-blocks/console/music` — `config/default.yaml:5-13`, `python3/java/R/pygame: false`).

## What differs from upstream (grouped)

* **Infra/CI:** multi-stage `Dockerfile` + PM2, `docker-compose.prod.yml` (prebuilt GHCR images), `scripts/generate-config.js` env→YAML, `deploy.yml` build+push, `.dockerignore`, `INTEGRATION_FINDINGS.md`, `TODO.md`.
* **Backend (out of agent scope):** consolidated `serverside/python-runner/` single container (manager+shell, `manager.js`/`server.js`/`ecosystem.config.cjs`), Resend mail (`RESEND_API_KEY`/`MAIL_*`), custom Redis DB, `lib/util/{queues,store,routeParser,helpers}` fixes, `app.js` session/cache hardening.
* **Frontend (in scope):** in-browser Pygal via Highcharts (`public/js/skulpt/pygal/__init__.js`, `public/js/vendor/highcharts/`), `public/js/embed/{python,embed,glowscript}.js` + `public/js/skulpt/wrapper.js` tweaks, `config/default.yaml` client flags.
* **Client urllib/CORS (in scope):** `public/js/embed/python.js` `urlopen` shim tries `{proxy}?url=<target>` first (when `app.embed.proxy` set) then falls back to direct client-side fetch; `config/default.yaml` proxy default is `''` (zero-server, works for `Access-Control-Allow-Origin: *` APIs); `APP_EMBED_PROXY` plumbed through `scripts/generate-config.js`, `docker-compose.yml`, `docker-compose.prod.yml`, `README.md`, `config/local.example.yaml`; new serverless proxy `serverside/cors-proxy/` (Cloudflare Worker: `ALLOWED_HOSTS` default `*` with bare-domain matching, `TRINKET_ORIGINS` caller lock, `https`-only, metadata-host block, 10MB cap) + docs in `GETTING_STARTED.md`.
* **Removed:** `lib/controllers/imports.js` (-733), `lib/views/users/includes/import.html` (-257) — legacy import UI.
* **Docs:** `README.md`/`GETTING_STARTED.md` rewritten for Docker + env vars, `serverside/README.md` runner notes.

Full file diff (requires temporary upstream): `git remote add upstream https://github.com/trinketapp/trinket-oss.git --no-tags; git fetch upstream; git diff --stat upstream/main..main` (was 54 files, +2872/-1277 on 2026-11-24), then `git remote remove upstream`.

## PRs merged (all in `supportingami/trinket-oss`)

| PR | Title | Branch | Merged |
|---|---|---|---|
| [#1](https://github.com/supportingami/trinket-oss/pull/1) | feat: config generator | `feat/config-generator` | 2026-06-16 |
| [#2](https://github.com/supportingami/trinket-oss/pull/2) | feat: pygal js integration | `feat/pygal-js` | 2026-08-31 |
| [#3](https://github.com/supportingami/trinket-oss/pull/3) | feat: unified backend server | `feat/unified-backend-server` | 2026-08-31 |
| [#4](https://github.com/supportingami/trinket-oss/pull/4) | feat: zero-server urllib with optional Cloudflare CORS proxy | `feat/urllib-cors-proxy` | open |

PR bodies were minimal (`#1` empty, `#2` “Integrate pygal JS into docker image”, `#3` “add single container image for running backend server”).

## Full commit list (`upstream/main..main`, oldest→newest)

```
770af53 2026-06-16 feat: container build action
b95c1f0 2026-06-16 chore: update action versions
71294b1 2026-06-16 feat: update docker-compose for pre-built image and updates
ee1f71c 2026-06-16 fix: typo
ed825e1 2026-06-16 chore: update readme
35bcb94 2026-06-16 chore: update tags
497a01a 2026-06-16 refactor: docker-compose prod image
fec6d00 2026-06-16 feat: config generator
3746ef8 2026-06-16 Merge pull request #1 from supportingami/feat/config-generator
a8ff74f 2026-06-16 fix: dockerfile styles
e7c804c 2026-06-16 chore: tidying
022aa59 2026-06-16 fix: prod compose
80b13de 2026-06-16 refactor: config gen
b3dba52 2026-06-16 chore: tidying
fd05353 2026-06-16 chore: tidying
7da2bb7 2026-06-16 feat: custom redis db
61fa2a0 2026-06-16 chore: tidying
3c33be1 2026-06-16 fix: cdn
d981490 2026-06-16 chore: update readme and todos
df1a9e0 2026-06-16 feat: resend mail integration
2b610d7 2026-06-16 fix: mail config
f6e8209 2026-06-16 fix: yaml
db41c21 2026-06-16 feat: deploy action concurrency
5f01c31 2026-06-16 fix: mail config
609215f 2026-06-16 feat: docker multi-stage builds
2aa7a7f 2026-08-31 feat: pygal js integration
69b15de 2026-08-31 feat: server backend
20b6237 2026-08-31 feat: pygal js integration
3cc7ac4 2026-08-31 Merge pull request #2 from supportingami/feat/pygal-js
05b64f2 2026-08-31 Merge remote-tracking branch 'origin/main' into feat/unified-backend-server
f1fdc72 2026-08-31 Merge pull request #3 from supportingami/feat/unified-backend-server
1302f8b 2026-08-31 chore: update prod compose
```

Regenerate with temporary upstream: `git remote add upstream https://github.com/trinketapp/trinket-oss.git --no-tags; git fetch upstream; git log --reverse --format='%h %ad %s' --date=short upstream/main..main` and `gh pr list --repo supportingami/trinket-oss --state all --json number,title,state,mergedAt,headRefName,url`; then `git remote remove upstream`.
