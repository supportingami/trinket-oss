/**
 * Trinket CORS proxy (Cloudflare Worker, serverless).
 *
 * Used by Skulpt `urllib.request.urlopen` shim in `public/js/embed/python.js`:
 *   GET {proxy}?url=<encoded-target>  (API calls)
 *   GET {proxy}/<target-url>          (image assets via addProxy)
 *
 * When `app.embed.proxy` is empty, the client tries a direct client-side
 * request instead (zero-server, works for APIs sending
 * `Access-Control-Allow-Origin: *` like OMDB). Set `app.embed.proxy` to this
 * Worker's URL to also support non-CORS APIs.
 *
 * Env vars (see wrangler.toml [vars]):
 *   ALLOWED_HOSTS   Optional. Comma-separated allowed upstream domains/prefixes,
 *                   or "*" (default) for all. Use bare domains: "omdbapi.com"
 *                   matches "omdbapi.com", "www.omdbapi.com", and subdomains.
 *                   Examples: "omdbapi.com,api.nasa.gov"
 *                             "https://api.example.com/v1/"
 *                   Leave unset (or "*") to allow all https upstreams.
 *   TRINKET_ORIGINS Comma-separated allowed calling origins (your prod site).
 *                   Example: "https://trinket.samicharity.co.uk"
 *                   Requests without a matching Origin/Referer are rejected (403).
 *                   Leave unset for local dev only.
 *
 * No `npm install` needed to deploy: `npx wrangler deploy`.
 */

const MAX_BYTES = 10 * 1024 * 1024; // 10MB response cap

// Bare-domain comparison: "omdbapi.com" matches "omdbapi.com",
// "www.omdbapi.com", and any subdomain. Leading "www." is ignored.
function normHost(h) {
  return String(h || '').toLowerCase().replace(/^www\./, '');
}

function splitList(raw) {
  return String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function targetAllowed(target, env) {
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return false;
  }

  const raw = env && env.ALLOWED_HOSTS;
  // Default is open ("*"): any https upstream allowed (origin check still applies).
  // Set ALLOWED_HOSTS to a comma-separated list to restrict, e.g. "omdbapi.com,api.nasa.gov".
  if (raw === undefined || raw === null || String(raw).trim() === '' || String(raw).trim() === '*') {
    return true;
  }

  const entries = splitList(raw);
  if (entries.length === 0) {
    return true; // e.g. ALLOWED_HOSTS="," -> treat as open.
  }

  const host = normHost(parsed.hostname);
  return entries.some((entry) => {
    if (entry === '*') return true;
    // Full URL prefix form: "https://api.example.com/v1/"
    if (/^https?:\/\//i.test(entry)) {
      const prefix = entry.replace(/\/+$/, '');
      return target.startsWith(prefix);
    }
    // Bare-domain form: "omdbapi.com" matches "omdbapi.com",
    // "www.omdbapi.com", and any subdomain.
    const h = normHost(entry.replace(/\/+$/, ''));
    return host === h || host.endsWith('.' + h);
  });
}

function originOf(request) {
  const origin = request.headers.get('Origin');
  if (origin) return origin.toLowerCase().replace(/\/+$/, '');
  const referer = request.headers.get('Referer');
  if (referer) {
    try {
      return new URL(referer).origin.toLowerCase();
    } catch {
      return null;
    }
  }
  return null;
}

function originAllowed(request, env) {
  const raw =
    (env && (env.TRINKET_ORIGINS || env.TRINKET_ORIGIN || env.ALLOWED_ORIGINS)) || '';
  const allowed = splitList(raw).map((s) => s.toLowerCase().replace(/\/+$/, ''));
  if (allowed.length === 0) {
    return true; // dev mode: set TRINKET_ORIGINS in prod (see wrangler.toml).
  }
  const origin = originOf(request);
  if (!origin) return false;
  return allowed.includes(origin);
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': '*',
    'access-control-max-age': '86400',
  };
}

function deny(request, message, status) {
  const headers = corsHeaders();
  // Echo back a specific origin when we know it (browsers ignore ACAO:* + credentials,
  // but an explicit echo is friendlier for debugging allowed origins).
  const origin = request.headers.get('Origin');
  if (origin) headers['access-control-allow-origin'] = origin;
  return new Response(message, { status, headers });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method !== 'GET') {
      return deny(request, 'method not allowed', 405);
    }

    // Only serve traffic from our own site(s).
    if (!originAllowed(request, env)) {
      return deny(request, 'forbidden origin', 403);
    }

    const u = new URL(request.url);

    // Support both ?url=<encoded> (urllib) and /<url> (image assets) forms.
    let target = u.searchParams.get('url');
    if (!target && u.pathname.length > 1) {
      try {
        target = decodeURIComponent(u.pathname.slice(1));
      } catch {
        return deny(request, 'bad url encoding', 400);
      }
    }

    if (!target) {
      return deny(request, 'missing ?url=', 400);
    }

    if (!/^https:\/\//.test(target)) {
      // Refuse http:// to avoid mixed-content and credential downgrade issues.
      return deny(request, 'https only', 400);
    }

    // Block cloud metadata endpoints even when ALLOWED_HOSTS="*".
    try {
      const host = new URL(target).hostname.toLowerCase();
      if (
        host === '169.254.169.254' ||
        host === 'metadata.google.internal' ||
        host === 'metadata.google.com'
      ) {
        return deny(request, 'blocked', 403);
      }
    } catch {
      return deny(request, 'bad url', 400);
    }

    if (!targetAllowed(target, env)) {
      return deny(request, 'blocked', 403);
    }

    let upstream;
    try {
      upstream = await fetch(target, { redirect: 'follow' });
    } catch (e) {
      return deny(request, 'upstream fetch failed', 502);
    }

    // Propagate upstream status so the client shim (status >= 400 -> try direct) works.
    const body = await upstream.arrayBuffer();
    if (body.byteLength > MAX_BYTES) {
      return deny(request, 'upstream response too large', 413);
    }
    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders(),
        'content-type': upstream.headers.get('content-type') || 'application/octet-stream',
        'cache-control': 'public, max-age=3600',
      },
    });
  },
};
