/**
 * Fetch every page from a paginated NKMovieHUB list endpoint.
 * Used so browse/admin aren't capped at the old 1000-item limit.
 */
export async function fetchAllPaged(urlBuilder, {
  listKey,
  limit = 500,
  signal
} = {}) {
  if (!listKey) throw new Error('listKey is required');

  const all = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = urlBuilder({ page, limit });
    const response = await fetch(url, signal ? { signal } : undefined);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to fetch catalog');
    }

    const chunk = result.data?.[listKey] || [];
    all.push(...chunk);

    const pagination = result.data?.pagination || {};
    totalPages = Math.max(1, Number(pagination.totalPages) || 1);
    page += 1;

    // Safety: avoid infinite loops if API misbehaves
    if (page > 1000) break;
  }

  return all;
}

export function buildMoviesUrl({
  page = 1,
  limit = 20,
  search = '',
  genre = '',
  year = '',
  sort = 'latest',
  status = ''
} = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (genre) params.set('genre', genre);
  if (year) params.set('year', String(year));
  if (sort && sort !== 'latest') params.set('sort', sort);
  if (status === 'coming_soon') params.set('status', 'coming_soon');
  return `/api/movies?${params.toString()}`;
}

export function buildTVShowsUrl({
  page = 1,
  limit = 20,
  search = '',
  genre = '',
  year = '',
  sort = 'latest',
  status = ''
} = {}) {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('page', String(page));
  if (search) params.set('search', search);
  if (genre) params.set('genre', genre);
  if (year) params.set('year', String(year));
  if (sort && sort !== 'latest') params.set('sort', sort);
  if (status === 'coming_soon') params.set('status', 'coming_soon');
  return `/api/tvshows?${params.toString()}`;
}
