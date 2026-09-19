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

const uniqueLabeledSources = (sources = []) => {
  const seen = new Set();
  return withServerLabels(
    sources.filter((item) => {
      if (!item?.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    })
  );
};

/** Extract TMDB / IMDb id from a stored catalog embed URL. */
export const extractEmbedIds = (url) => {
  const playable = getEmbedPlayableUrl(url) || url || '';
  const tmdbMovie = playable.match(/2embed\.[^/]+\/embed\/(\d+)/i)?.[1];
  const imdbMovie = playable.match(/2embed\.[^/]+\/embed\/(tt\d+)/i)?.[1];
  const tmdbTv = playable.match(
    /2embed\.[^/]+\/embedtv\/(\d+)/i
  )?.[1];
  return {
    tmdbId: tmdbMovie || tmdbTv || null,
    imdbId: imdbMovie || null
  };
};

export const buildTvEmbedSources = ({ tmdbId, season = 1, episode = 1, episodeUrl = '' }) => {
  const s = Number(season) || 1;
  const e = Number(episode) || 1;
  if (!tmdbId) return [];

  // VidSrc first (more reliable default). Videasy replaces flaky 2embed as #2.
  const sources = [
    { url: `https://vidsrc.to/embed/tv/${tmdbId}/${s}/${e}` },
    { url: `https://player.videasy.net/tv/${tmdbId}/${s}/${e}` },
    { url: `https://moviesapi.to/tv/${tmdbId}-${s}-${e}` },
    { url: `https://vidlink.pro/tv/${tmdbId}/${s}/${e}` },
    { url: `https://vidsrc.me/embed/tv/${tmdbId}/${s}/${e}` },
    {
      url:
        getEmbedPlayableUrl(episodeUrl) || buildTvEpisodeUrl(tmdbId, s, e)
    }
  ];

  return uniqueLabeledSources(sources);
};

export const buildEmbedSourcesFromUrl = (url) => {
  const primary = getEmbedPlayableUrl(url);
  if (!primary) return [];

  const tvMatch = primary.match(
    /2embed\.[^/]+\/embedtv\/(\d+)(?:[?&]s=(\d+)(?:&e=(\d+))?)?/i
  );

  if (tvMatch) {
    const id = tvMatch[1];
    const s = tvMatch[2] || '1';
    const e = tvMatch[3] || '1';
    return buildTvEmbedSources({ tmdbId: id, season: s, episode: e, episodeUrl: primary });
  }

  const movieMatch = primary.match(/2embed\.[^/]+\/embed\/(\d+)/i);
  const imdbMovie = primary.match(/2embed\.[^/]+\/embed\/(tt\d+)/i);

  if (movieMatch) {
    const id = movieMatch[1];
    // Server 1 = former Server 2 (vidsrc). Server 2 = Videasy (2embed replacement).
    return uniqueLabeledSources([
      { url: `https://vidsrc.to/embed/movie/${id}` },
      { url: `https://player.videasy.net/movie/${id}` },
      { url: `https://moviesapi.to/movie/${id}` },
      { url: `https://vidlink.pro/movie/${id}` },
      { url: `https://vidsrc.me/embed/movie/${id}` },
      { url: `https://multiembed.mov/?video_id=${id}&tmdb=1` },
      { url: `https://www.2embed.cc/embed/${id}` }
    ]);
  }

  if (imdbMovie) {
    return uniqueLabeledSources([
      { url: `https://vidsrc.to/embed/movie?imdb=${imdbMovie[1]}` },
      { url: `https://www.2embed.cc/embed/${imdbMovie[1]}` }
    ]);
  }

  return uniqueLabeledSources([{ url: primary }]);
};

/** Normalize admin manual override URL for in-site iframe (YouTube → embed). */
export const getManualPlayEmbedUrl = (url) => {
  const raw = String(url || '').trim();
  if (!raw) return null;

  const youtubeId =
    raw.match(/youtube\.com\/watch\?[^#]*v=([A-Za-z0-9_-]{6,})/i)?.[1] ||
    raw.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i)?.[1] ||
    raw.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/i)?.[1] ||
    null;

  if (youtubeId) {
    return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`;
  }

  return getEmbedPlayableUrl(raw) || raw;
};

/**
 * Watch sources for a movie. If admin set manualPlayUrl (servers broken),
 * use only that — otherwise the usual multi-server list from movieUrl.
 */
export const buildMovieWatchSources = (movie) => {
  const manual = getManualPlayEmbedUrl(movie?.manualPlayUrl);
  if (manual) {
    return [{ id: 'server-1', label: 'Manual', url: manual }];
  }

  const sources = buildEmbedSourcesFromUrl(movie?.movieUrl);
  if (sources.length) return sources;

  const playable = getEmbedPlayableUrl(movie?.movieUrl) || movie?.movieUrl;
  return playable ? withServerLabels([{ url: playable }]) : [];
};
