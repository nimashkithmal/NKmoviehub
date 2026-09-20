/** Shared YouTube / trailer embed helpers for in-site iframes. */

const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/**
 * Unwrap Google redirect wrappers like:
 * https://www.google.com/url?q=https://youtube.com/watch%3Fv%3D...
 */
export const unwrapGoogleRedirect = (url = '') => {
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
};

/** Extract an 11-char YouTube video id from common URL shapes. */
export const extractYouTubeId = (url = '') => {
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
};

/**
 * Build a frameable YouTube embed URL.
 * Uses youtube-nocookie to reduce google.com consent / login redirects in production.
 */
export const toYoutubeEmbedUrl = (url, { autoplay = true } = {}) => {
  const id = extractYouTubeId(url);
  if (!id) return '';

  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1'
  });
  if (autoplay) params.set('autoplay', '1');

  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
};

/**
 * True when this URL must never be put in an iframe as-is
 * (Google homepage / accounts / watch pages set X-Frame-Options).
 */
export const isNonFrameableHostUrl = (url = '') => {
  const raw = String(url || '').trim();
  if (!raw) return true;
  try {
    const { hostname, pathname } = new URL(raw);
    const host = hostname.toLowerCase();

    if (host === 'google.com' || host.endsWith('.google.com')) {
      // drive.google.com/file/.../preview can work; plain google.com never does
      if (host === 'drive.google.com' && /\/file\/d\/[^/]+\/preview/i.test(pathname)) {
        return false;
      }
      return true;
    }

    if (
      (host.includes('youtube.com') || host === 'youtu.be') &&
      !/\/embed\//i.test(pathname)
    ) {
      return true;
    }

    return false;
  } catch {
    return true;
  }
};

/** Normalize trailer URLs for iframe embed (YouTube watch → embed). */
export const toTrailerEmbedUrl = (url, { autoplay = true } = {}) => {
  const raw = unwrapGoogleRedirect(String(url || '').trim());
  if (!raw) return '';

  const youtube = toYoutubeEmbedUrl(raw, { autoplay });
  if (youtube) return youtube;

  if (!autoplay) return raw;
  const sep = raw.includes('?') ? '&' : '?';
  return `${raw}${sep}autoplay=1`;
};
