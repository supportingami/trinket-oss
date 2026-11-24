# CORS proxy (Cloudflare Worker, serverless)

Stateless proxy for Skulpt `urllib.request.urlopen` in `public/js/embed/python.js`:

- `GET {proxy}?url=<encoded-target>` — API calls
- `GET {proxy}/<target-url>` — image assets (`addProxy`)

No server to run or pay for. Free tier is ~100k requests/day.

## When do you need this?

| Target API sends `Access-Control-Allow-Origin: *` (e.g. OMDB) | No proxy needed. Leave `app.embed.proxy` empty (`''`). Direct client-side request works. |
| Target API has no CORS headers | Proxy required. Deploy this Worker and set `app.embed.proxy`. |

The client shim tries the proxy first (if configured), then falls back to direct.

## Deploy

```bash
cd serverside/cors-proxy
npx wrangler deploy
# -> https://trinket-proxy.<you>.workers.dev
```

## Configuration (env vars)

Set in `wrangler.toml` `[vars]` or `wrangler secret` / dashboard:

```toml
[vars]
# Optional: restrict upstream APIs. Default "*" allows all https upstreams.
# Use bare domains — "omdbapi.com" covers "www.omdbapi.com" and subdomains.
ALLOWED_HOSTS = "*"

# Only these sites may USE the proxy (your prod site). Browser sends Origin;
# anything else gets 403. Leave unset for local dev only.
TRINKET_ORIGINS = "https://trinket.samicharity.co.uk"
```

| Want | Set |
|---|---|
| Schools / unknown APIs (default) | `ALLOWED_HOSTS = "*"` **plus** `TRINKET_ORIGINS = "https://your-prod-site"` and a Cloudflare rate limit on the route |
| Known classroom APIs only | `ALLOWED_HOSTS = "omdbapi.com,api.nasa.gov"` |
| Local dev | Leave `TRINKET_ORIGINS` unset |

Notes:

- `https://` upstreams only. Use `https://` target URLs in trinkets (`http://` is blocked as mixed-content on `https` pages).
- Cloud metadata hosts (`169.254.169.254`, `metadata.google.internal`) are always blocked, even with `"*"`.
- Responses over ~10MB are rejected (`413`).
- Upstream HTTP status is propagated so the client can fall back to direct on `4xx`/`5xx`.
- If all students share one API key (e.g. OMDB), prefer storing it as a Worker secret and injecting `?apikey=` server-side instead of shipping it in trinket code.

## Configure Trinket

In `config/local.yaml` (no trailing slash):

```yaml
app:
  embed:
    proxy: 'https://trinket-proxy.<you>.workers.dev'
```

or `APP_EMBED_PROXY=https://trinket-proxy.<you>.workers.dev` in your `.env`/compose. In `config/default.yaml` the default is `''` (direct, zero-server).

## Test

```bash
# Must send Origin once TRINKET_ORIGINS is set:
curl -H "Origin: https://trinket.samicharity.co.uk" \
  "https://trinket-proxy.<you>.workers.dev?url=https%3A%2F%2Fwww.omdbapi.com%2F%3Fapikey%3Db175e3c3%26t%3DJaws"
```

Expect the Jaws JSON with `access-control-allow-origin: *`.

```bash
# No/wrong Origin -> 403:
curl "https://trinket-proxy.<you>.workers.dev?url=https%3A%2F%2Fwww.omdbapi.com%2F" -o /dev/null -w "%{http_code}\n"
curl -H "Origin: https://evil.example.com" \
  "https://trinket-proxy.<you>.workers.dev?url=https%3A%2F%2Fwww.omdbapi.com%2F" -o /dev/null -w "%{http_code}\n"
```
