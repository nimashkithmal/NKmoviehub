/** Build multi-server embed URLs for movies and TV (MovieAI-style). */

export const getEmbedPlayableUrl = (url) => {
  if (!url) return null;

  const movieMatch = url.match(/2embed\.[^/]+\/movie\/(\d+)/i);
  if (movieMatch) return `https://www.2embed.cc/embed/${movieMatch[1]}`;

  const tvEmbedMatch = url.match(
    /2embed\.[^/]+\/embedtv\/(\d+)(?:[?&]s=(\d+)(?:[?&]e=(\d+))?)?/i
  );
  if (tvEmbedMatch) {
    const id = tvEmbedMatch[1];
    const s = tvEmbedMatch[2];
    const e = tvEmbedMatch[3];
    if (s && e) return `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`;
    if (s) return `https://www.2embed.cc/embedtv/${id}&s=${s}`;
    return `https://www.2embed.cc/embedtv/${id}`;
  }

  const tvMatch = url.match(/2embed\.[^/]+\/tv\/(\d+)/i);
  if (tvMatch) return `https://www.2embed.cc/embedtv/${tvMatch[1]}`;

  if (url.includes('/embed/') || url.includes('/embedtv/')) return url;
  return url;
};

export const buildTvEpisodeUrl = (tmdbId, season, episode) =>
  `https://www.2embed.cc/embedtv/${tmdbId}&s=${Number(season) || 1}&e=${Number(episode) || 1}`;

export const withServerLabels = (sources = []) =>
  sources.map((source, index) => ({
    ...source,
    id: `server-${index + 1}`,
    label: `Server ${index + 1}`
  }));

export const buildTvEmbedSources = ({ tmdbId, season = 1, episode = 1, episodeUrl = '' }) => {
  const s = Number(season) || 1;
  const e = Number(episode) || 1;
  if (!tmdbId) return [];

  const twoEmbedUrl =
    getEmbedPlayableUrl(episodeUrl) || buildTvEpisodeUrl(tmdbId, s, e);

  const sources = [
    { url: twoEmbedUrl },
    { url: `https://vidsrc.to/embed/tv/${tmdbId}/${s}/${e}` },
    { url: `https://vidsrc.me/embed/tv/${tmdbId}/${s}/${e}` },
    { url: `https://embed.su/embed/tv/${tmdbId}/${s}/${e}` },
    { url: `https://player.autoembed.cc/embed/tv/${tmdbId}/${s}/${e}` }
  ];

  const seen = new Set();
  return withServerLabels(
    sources.filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
  );
};

export const buildEmbedSourcesFromUrl = (url) => {
  const primary = getEmbedPlayableUrl(url);
  if (!primary) return [];

  const sources = [{ url: primary }];
  const tvMatch = primary.match(
    /2embed\.[^/]+\/embedtv\/(\d+)(?:\?s=(\d+)(?:&e=(\d+))?)?/i
  );

  if (tvMatch) {
    const id = tvMatch[1];
    const s = tvMatch[2] || '1';
    const e = tvMatch[3] || '1';
    return buildTvEmbedSources({ tmdbId: id, season: s, episode: e });
  }

  const movieMatch = primary.match(/2embed\.[^/]+\/embed\/(\d+)/i);
  const imdbMovie = primary.match(/2embed\.[^/]+\/embed\/(tt\d+)/i);
  if (movieMatch) {
    const id = movieMatch[1];
    sources.push(
      { url: `https://vidsrc.to/embed/movie/${id}` },
      { url: `https://vidsrc.me/embed/movie/${id}` },
      { url: `https://embed.su/embed/movie/${id}` },
      { url: `https://player.autoembed.cc/embed/movie/${id}` },
      { url: `https://vidsrcme.ru/embed/movie/${id}` }
    );
  } else if (imdbMovie) {
    sources.push({ url: `https://vidsrc.to/embed/movie?imdb=${imdbMovie[1]}` });
  }

  const seen = new Set();
  return withServerLabels(
    sources.filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
  );
};
