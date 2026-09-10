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
  Accept: 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  Referer: 'https://www.2embed.skin/',
  Origin: 'https://www.2embed.skin'
};

let fetchChain = Promise.resolve();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const enqueueFetch = (task) => {
  const run = fetchChain.then(task, task);
  fetchChain = run.catch(() => {});
  return run;
};

/**
 * GET JSON from 2embed API with retries (handles slow responses + intermittent 403).
 */
async function fetchEmbedJson(pathOrUrl, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const url = /^https?:\/\//i.test(pathOrUrl)
    ? pathOrUrl
    : `${EMBED_API}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;

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
          throw new Error(`HTTP ${response.status}`);
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (err) {
        lastError = err;
        if (attempt < MAX_RETRIES) {
          await sleep(800 * (attempt + 1) + Math.floor(Math.random() * 400));
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
  EMBED_FETCH_HEADERS
};
