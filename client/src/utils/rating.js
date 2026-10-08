/** Poster rating: IMDb/TMDB score first, then site average. 0 / missing = not rated. */
export const getDisplayRating = (item) => {
  for (const value of [item?.imdbRating, item?.averageRating]) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n.toFixed(1);
  }
  return null;
};
