/**
 * Catalog search helpers — support queries like "Dange 2024" / "Dange (2024)".
 */

const escapeRegex = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Match `term` as a whole token so "dange" does not hit "danger".
 */
const tokenRegex = (term = '') =>
  `(^|[^a-z0-9])${escapeRegex(term)}([^a-z0-9]|$)`;

/**
 * Split a search string into title text + optional year.
 * @returns {{ query: string, year: number|null }}
 */
function parseCatalogSearch(raw = '') {
  let query = String(raw || '').trim();
  let year = null;

  if (!query) return { query: '', year: null };

  const parenMatch = query.match(/\((19\d{2}|20\d{2})\)\s*$/);
  if (parenMatch) {
    year = parseInt(parenMatch[1], 10);
    query = query.replace(/\s*\((19\d{2}|20\d{2})\)\s*$/, '').trim();
  } else {
    const tailYear = query.match(/\s+(19\d{2}|20\d{2})\s*$/);
    if (tailYear) {
      year = parseInt(tailYear[1], 10);
      query = query.replace(/\s+(19\d{2}|20\d{2})\s*$/, '').trim();
    }
  }

  return { query, year };
}

/**
 * Apply text (+ optional embedded year) search onto a Mongo filter.
 * Does not override an existing `filter.year` (explicit year query param wins).
 */
function applyCatalogTextSearch(filter, rawSearch) {
  const { query, year } = parseCatalogSearch(rawSearch);

  if (year != null && filter.year == null) {
    filter.year = year;
  }

  if (!query) return filter;

  const pattern = tokenRegex(query);
  filter.$or = [
    { title: { $regex: pattern, $options: 'i' } },
    { description: { $regex: pattern, $options: 'i' } },
    { genre: { $regex: pattern, $options: 'i' } }
  ];

  return filter;
}

module.exports = {
  escapeRegex,
  parseCatalogSearch,
  applyCatalogTextSearch,
  tokenRegex
};
