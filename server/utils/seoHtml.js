const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const truncate = (text = '', max = 160) => {
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
};

const buildBaseHead = ({ title, description, canonical, image, type = 'website' }) => `
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="index, follow" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta property="og:type" content="${escapeHtml(type)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:site_name" content="NK Movie Hub" />
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : ''}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : ''}
`;

const pageStyles = `
  body { margin: 0; font-family: Arial, sans-serif; background: #0a0a0a; color: #e8e8e8; line-height: 1.6; }
  main { max-width: 900px; margin: 0 auto; padding: 2rem 1.25rem 3rem; }
  h1 { margin: 0 0 0.5rem; font-size: 2rem; color: #fff; }
  .meta { color: #b3b3b3; margin-bottom: 1rem; }
  .overview { margin: 1rem 0 1.5rem; }
  .facts { display: grid; gap: 0.35rem; margin: 1rem 0 1.5rem; }
  .facts strong { color: #e9d5ff; }
  ul { margin: 0.5rem 0 0; padding-left: 1.2rem; }
  a { color: #c4b5fd; }
  .cta { display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.25rem; background: #7c3aed; color: #fff; text-decoration: none; border-radius: 8px; }
`;

const buildMovieHtml = (movie, siteOrigin) => {
  const canonical = `${siteOrigin}/movie/${movie._id}`;
  const title = `${movie.title}${movie.year ? ` (${movie.year})` : ''} | NK Movie Hub`;
  const description = truncate(movie.description || movie.tagline || `Watch ${movie.title} on NK Movie Hub.`);
  const image = movie.bannerUrl || movie.imageUrl || '';
  const genres = movie.genre ? movie.genre.split(/[,|/]/).map((g) => g.trim()).filter(Boolean) : [];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    description: movie.description || description,
    image: image ? [image] : undefined,
    datePublished: movie.releaseDate || (movie.year ? String(movie.year) : undefined),
    genre: genres.length ? genres : undefined,
    director: movie.director ? { '@type': 'Person', name: movie.director } : undefined,
    aggregateRating:
      movie.imdbRating > 0
        ? {
            '@type': 'AggregateRating',
            ratingValue: movie.imdbRating,
            bestRating: 10,
            ratingCount: movie.totalRatings || 1
          }
        : undefined
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
${buildBaseHead({ title, description, canonical, image, type: 'video.movie' })}
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>${pageStyles}</style>
</head>
<body>
  <main>
    <h1>${escapeHtml(movie.title)}</h1>
    <p class="meta">${escapeHtml([movie.year, movie.genre, movie.imdbRating ? `IMDB ${movie.imdbRating}/10` : ''].filter(Boolean).join(' · '))}</p>
    ${movie.tagline ? `<p><em>${escapeHtml(movie.tagline)}</em></p>` : ''}
    <div class="overview">${escapeHtml(movie.description || '')}</div>
    <div class="facts">
      ${movie.director ? `<div><strong>Director:</strong> ${escapeHtml(movie.director)}</div>` : ''}
      ${movie.runtime ? `<div><strong>Runtime:</strong> ${escapeHtml(movie.runtime)} min</div>` : ''}
      ${movie.language ? `<div><strong>Language:</strong> ${escapeHtml(movie.language)}</div>` : ''}
      ${movie.releaseDate ? `<div><strong>Release date:</strong> ${escapeHtml(movie.releaseDate)}</div>` : ''}
    </div>
    <p><a href="${escapeHtml(canonical)}">Open the full NK Movie Hub page</a></p>
    <a class="cta" href="${escapeHtml(canonical)}">Watch on NK Movie Hub</a>
  </main>
</body>
</html>`;
};

const buildTvShowHtml = (tvShow, siteOrigin) => {
  const canonical = `${siteOrigin}/tvshow/${tvShow._id}`;
  const title = `${tvShow.title}${tvShow.year ? ` (${tvShow.year})` : ''} | NK Movie Hub`;
  const description = truncate(tvShow.description || `Watch ${tvShow.title} on NK Movie Hub.`);
  const image = tvShow.bannerUrl || tvShow.imageUrl || '';
  const genres = tvShow.genre ? tvShow.genre.split(/[,|/]/).map((g) => g.trim()).filter(Boolean) : [];
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: tvShow.title,
    description: tvShow.description || description,
    image: image ? [image] : undefined,
    datePublished: tvShow.year ? String(tvShow.year) : undefined,
    genre: genres.length ? genres : undefined
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
${buildBaseHead({ title, description, canonical, image, type: 'video.tv_show' })}
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>${pageStyles}</style>
</head>
<body>
  <main>
    <h1>${escapeHtml(tvShow.title)}</h1>
    <p class="meta">${escapeHtml([tvShow.year, tvShow.genre, tvShow.imdbRating ? `IMDB ${tvShow.imdbRating}/10` : ''].filter(Boolean).join(' · '))}</p>
    <div class="overview">${escapeHtml(tvShow.description || '')}</div>
    <div class="facts">
      ${tvShow.numberOfSeasons ? `<div><strong>Seasons:</strong> ${escapeHtml(tvShow.numberOfSeasons)}</div>` : ''}
      ${tvShow.language ? `<div><strong>Language:</strong> ${escapeHtml(tvShow.language)}</div>` : ''}
    </div>
    <p><a href="${escapeHtml(canonical)}">Open the full NK Movie Hub page</a></p>
    <a class="cta" href="${escapeHtml(canonical)}">Watch on NK Movie Hub</a>
  </main>
</body>
</html>`;
};

module.exports = {
  buildMovieHtml,
  buildTvShowHtml
};
