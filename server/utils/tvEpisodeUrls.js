const EMBED_BASE = 'https://www.2embed.cc';

const extractTmdbId = (url = '', fallback = '') => {
  const raw = String(url || '');
  return (
    raw.match(/2embed\.[^/]+\/embedtv(?:full)?\/(\d+)/i)?.[1] ||
    raw.match(/2embed\.[^/]+\/tv\/(\d+)/i)?.[1] ||
    String(fallback || '').trim() ||
    null
  );
};

const extractSeasonEpisode = (url = '') => {
  const raw = String(url || '');
  const queryMatch = raw.match(/[?&]s=(\d{1,3})(?:[?&]e=(\d{1,3}))?/i);
  if (queryMatch) {
    return {
      season: parseInt(queryMatch[1], 10) || 1,
      episode: parseInt(queryMatch[2], 10) || 1
    };
  }

  const compactMatch = raw.match(/[sS](\d{1,3})[eE](\d{1,3})/);
  if (compactMatch) {
    return {
      season: parseInt(compactMatch[1], 10) || 1,
      episode: parseInt(compactMatch[2], 10) || 1
    };
  }

  const pathMatch = raw.match(/\/embed\/tv\/\d+\/(\d+)\/(\d+)/i);
  if (pathMatch) {
    return {
      season: parseInt(pathMatch[1], 10) || 1,
      episode: parseInt(pathMatch[2], 10) || 1
    };
  }

  return { season: 1, episode: 1 };
};

const buildEpisodeUrl = (tmdbId, season, episode) =>
  `${EMBED_BASE}/embedtv/${tmdbId}&s=${Number(season) || 1}&e=${Number(episode) || 1}`;

const normalizeEpisodeUrl = (url = '', tmdbId = '') => {
  const id = extractTmdbId(url, tmdbId);
  if (!id) return String(url || '').trim();

  const { season, episode } = extractSeasonEpisode(url);
  return buildEpisodeUrl(id, season, episode);
};

const normalizeEpisodeRecord = (episode = {}, tmdbId = '') => {
  const seasonNumber = Number(episode.seasonNumber) || extractSeasonEpisode(episode.episodeUrl).season;
  const seasonEpisodeNumber =
    Number(episode.seasonEpisodeNumber) || extractSeasonEpisode(episode.episodeUrl).episode;
  const id = extractTmdbId(episode.episodeUrl, tmdbId);

  return {
    episodeNumber: Number(episode.episodeNumber) || 1,
    seasonNumber,
    seasonEpisodeNumber,
    episodeUrl: id ? buildEpisodeUrl(id, seasonNumber, seasonEpisodeNumber) : normalizeEpisodeUrl(episode.episodeUrl, tmdbId),
    episodeTitle: String(episode.episodeTitle || '').trim()
  };
};

module.exports = {
  EMBED_BASE,
  extractTmdbId,
  extractSeasonEpisode,
  buildEpisodeUrl,
  normalizeEpisodeUrl,
  normalizeEpisodeRecord
};
