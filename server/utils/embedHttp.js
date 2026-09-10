/**
 * Shared HTTPS client for api.2embed.cc — TLS quirks, long timeouts, IPv4.
 * When Cloudflare blocks a home/office IP (HTTP 403), optionally retry through
 * EMBED_UPSTREAM_URL (EC2 /api/embed/upstream) — same path production uses.
 */
const https = require('https');
const http = require('http');
const fetch = require('node-fetch');

const EMBED_API = 'https://api.2embed.cc';
const DEFAULT_TIMEOUT_MS = 90000;
const MAX_RETRIES = 3;

const embedTlsAgent = new https.Agent({
  keepAlive: true,
  rejectUnauthorized: false,
  family: 4
});

const EMBED_FETCH_HEADERS = {
  Accept: 'application/json,text/plain,*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Referer: 'https://www.2embed.cc/',
  Origin: 'https://www.2embed.cc'
};

const ALLOWED_UPSTREAM =
  /^\/(search|searchtv|trending|trendingtv|movie|tv|season|similar|similartv)(\?|$)/i;

let fetchChain = Promise.resolve();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const enqueueFetch = (task) => {
  const run = fetchChain.then(task, task);
  fetchChain = run.catch(() => {});
  return run;
};

function toEmbedPath(pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const parsed = new URL(pathOrUrl);
    return `${parsed.pathname}${parsed.search}`;
  }
  return pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
}

function getUpstreamBase() {
  return String(process.env.EMBED_UPSTREAM_URL || '').trim().replace(/\/$/, '');
}

async function fetchDirectEmbed(url, timeoutMs) {
  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        agent: embedTlsAgent,
        headers: EMBED_FETCH_HEADERS,
        timeout: timeoutMs
      });

      if (response.status === 403 || response.status === 429) {
        throw Object.assign(new Error(`HTTP ${response.status}`), {
          status: response.status,
          retryAfterMs: 2500 * (attempt + 1)
        });
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentType = String(response.headers.get('content-type') || '');
      if (!/json/i.test(contentType)) {
        const text = await response.text();
        if (/<!DOCTYPE|<html/i.test(text.slice(0, 200))) {
          throw Object.assign(new Error('HTTP 403'), { status: 403 });
        }
        try {
          return JSON.parse(text);
        } catch {
          throw new Error('Invalid JSON from embed API');
        }
      }

      return await response.json();
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        const wait =
          Number(err.retryAfterMs) ||
          800 * (attempt + 1) + Math.floor(Math.random() * 400);
        await sleep(wait);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || new Error('embed fetch failed');
}

async function fetchViaUpstream(pathOrUrl, timeoutMs) {
  const base = getUpstreamBase();
  if (!base) throw new Error('EMBED_UPSTREAM_URL not configured');

  const embedPath = toEmbedPath(pathOrUrl);
  if (!ALLOWED_UPSTREAM.test(embedPath)) {
    throw new Error(`Upstream path not allowed: ${embedPath}`);
  }

  const url = `${base}?u=${encodeURIComponent(embedPath)}`;
  const isHttp = url.startsWith('http://');
  const agent = isHttp
    ? new http.Agent({ keepAlive: true, family: 4 })
    : embedTlsAgent;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      agent,
      headers: {
        Accept: 'application/json',
        'X-NK-Embed-Upstream': '1'
      },
      timeout: timeoutMs
    });
    if (!response.ok) {
      throw new Error(`Upstream HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function isBlockedError(err) {
  const status = Number(err?.status);
  const msg = String(err?.message || '');
  return status === 403 || status === 429 || /HTTP 403|HTTP 429/i.test(msg);
}

/**
 * GET JSON from 2embed API with retries; on Cloudflare 403 use EC2 upstream if set.
 */
async function fetchEmbedJson(
  pathOrUrl,
  { timeoutMs = DEFAULT_TIMEOUT_MS, viaUpstream = false } = {}
) {
  const url = /^https?:\/\//i.test(pathOrUrl)
    ? pathOrUrl
    : `${EMBED_API}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;

  return enqueueFetch(async () => {
    try {
      return await fetchDirectEmbed(url, timeoutMs);
    } catch (err) {
      if (!viaUpstream && isBlockedError(err) && getUpstreamBase()) {
        console.warn(
          `2embed direct blocked (${err.message}) → retry via EMBED_UPSTREAM_URL`
        );
        return fetchViaUpstream(pathOrUrl, timeoutMs);
      }
      throw err;
    }
  });
}

module.exports = {
  EMBED_API,
  fetchEmbedJson,
  embedTlsAgent,
  EMBED_FETCH_HEADERS,
  toEmbedPath,
  ALLOWED_UPSTREAM
};
