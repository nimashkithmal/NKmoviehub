/**
 * Normalize playable URLs before storing (avoid google.com / watch pages in iframes).
 */

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function unwrapGoogleRedirect(url = '') {
  const raw = String(url || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    if (!/(^|\.)google\.[a-z.]+$/i.test(parsed.hostname)) return raw;
    const target =
      parsed.searchParams.get('q') ||
      parsed.searchParams.get('url') ||
      parsed.searchParams.get('u') ||
      '';
    if (target && /^https?:\/\//i.test(target)) return target;
  } catch {
    /* ignore */
  }
  return raw;
}

function extractYouTubeId(url = '') {
  const raw = unwrapGoogleRedirect(url);
  if (!raw) return null;

  const patterns = [
    /(?:youtube\.com|youtube-nocookie\.com)\/embed\/([A-Za-z0-9_-]{11})/i,
    /(?:youtube\.com|youtube-nocookie\.com)\/shorts\/([A-Za-z0-9_-]{11})/i,
    /(?:youtube\.com|youtube-nocookie\.com)\/live\/([A-Za-z0-9_-]{11})/i,
    /(?:youtube\.com|m\.youtube\.com|music\.youtube\.com)\/watch\?(?:[^#]*&)?v=([A-Za-z0-9_-]{11})/i,
    /youtu\.be\/([A-Za-z0-9_-]{11})/i,
    /youtube\.com\/v\/([A-Za-z0-9_-]{11})/i
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1] && YT_ID_RE.test(match[1])) return match[1];
  }

  try {
    const parsed = new URL(raw);
    const v = parsed.searchParams.get('v');
    if (v && YT_ID_RE.test(v)) return v;
  } catch {
    /* ignore */
  }

  return null;
}

/** Store a clean YouTube embed URL when possible; otherwise trimmed raw. */
function normalizePlayableUrl(value, { preferNocookie = true } = {}) {
  const raw = unwrapGoogleRedirect(String(value || '').trim()).slice(0, 500);
  if (!raw) return '';

  const id = extractYouTubeId(raw);
  if (id) {
    const host = preferNocookie ? 'www.youtube-nocookie.com' : 'www.youtube.com';
    return `https://${host}/embed/${id}`;
  }

  // Reject bare google.com pages — they cannot be framed (X-Frame-Options).
  try {
    const { hostname } = new URL(raw);
    const host = hostname.toLowerCase();
    if (host === 'google.com' || (host.endsWith('.google.com') && host !== 'drive.google.com')) {
      return '';
    }
  } catch {
    return '';
  }

  return raw;
}

module.exports = {
  unwrapGoogleRedirect,
  extractYouTubeId,
  normalizePlayableUrl
};
