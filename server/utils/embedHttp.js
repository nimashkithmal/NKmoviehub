/**
 * Shared HTTPS client for api.2embed.cc — TLS quirks, long timeouts, IPv4.
 */
const https = require('https');
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

let fetchChain = Promise.resolve();
/** After Cloudflare 403/429, skip api.2embed.cc for a while. */
let apiBlockedUntil = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const enqueueFetch = (task) => {
  const run = fetchChain.then(task, task);
  fetchChain = run.catch(() => {});
  return run;
};

function isEmbedApiBlocked() {
  return Date.now() < apiBlockedUntil;
}

function markEmbedApiBlocked(ms = 15 * 60 * 1000) {
  apiBlockedUntil = Date.now() + ms;
}

/**
 * GET JSON from 2embed API with retries (handles slow responses + intermittent 403).
 */
async function fetchEmbedJson(pathOrUrl, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = /^https?:\/\//i.test(pathOrUrl)
    ? pathOrUrl
    : `${EMBED_API}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;

  if (isEmbedApiBlocked() && /api\.2embed\.cc/i.test(url)) {
    throw new Error('HTTP 403 (circuit open)');
  }

  return enqueueFetch(async () => {
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
          markEmbedApiBlocked();
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
            markEmbedApiBlocked();
            throw new Error('HTTP 403');
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
        if (attempt < MAX_RETRIES && !isEmbedApiBlocked()) {
          const wait =
            Number(err.retryAfterMs) ||
            800 * (attempt + 1) + Math.floor(Math.random() * 400);
          await sleep(wait);
        } else if (isEmbedApiBlocked()) {
          break;
        }
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError || new Error('embed fetch failed');
  });
}

module.exports = {
  EMBED_API,
  fetchEmbedJson,
  embedTlsAgent,
  EMBED_FETCH_HEADERS,
  isEmbedApiBlocked,
  markEmbedApiBlocked
};
