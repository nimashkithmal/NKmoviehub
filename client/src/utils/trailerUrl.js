/** Normalize trailer URLs for iframe embed (YouTube watch → embed). */
export const toTrailerEmbedUrl = (url, { autoplay = true } = {}) => {
  const raw = String(url || '').trim();
  if (!raw) return '';

  const id =
    raw.match(/youtube\.com\/watch\?[^#]*v=([A-Za-z0-9_-]{6,})/i)?.[1] ||
    raw.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i)?.[1] ||
    raw.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/i)?.[1] ||
    null;

  if (id) {
    const params = new URLSearchParams({ rel: '0', modestbranding: '1' });
    if (autoplay) params.set('autoplay', '1');
    return `https://www.youtube.com/embed/${id}?${params}`;
  }

  if (!autoplay) return raw;
  const sep = raw.includes('?') ? '&' : '?';
  return `${raw}${sep}autoplay=1`;
};
