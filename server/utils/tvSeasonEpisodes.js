const fetch = require('node-fetch');
const { buildEpisodeUrl } = require('./tvEpisodeUrls');

const EMBED_API = 'https://api.2embed.cc';
const MAX_SEASON_PROBE = 50;

async function fetchSeasonEpisodes(tmdbId, seasonNumber) {
  const response = await fetch(
    `${EMBED_API}/season?tmdb_id=${encodeURIComponent(tmdbId)}&season=${seasonNumber}`,
    { headers: { Accept: 'application/json' } }
  );

  if (!response.ok) return [];

  const data = await response.json();
  return (data.episodes || []).filter((ep) => Number(ep.episode_number) > 0);
}

async function buildAllSeasonEpisodes(tmdbId, numberOfSeasons = null) {
  const declaredSeasons = Math.max(0, Number(numberOfSeasons) || 0);
  const probeLimit = Math.max(MAX_SEASON_PROBE, declaredSeasons);
  const episodes = [];
  let globalEpisodeNumber = 1;
  let highestSeason = 0;

  for (let season = 1; season <= probeLimit; season += 1) {
    const seasonEps = await fetchSeasonEpisodes(tmdbId, season);

    if (!seasonEps.length) {
      // 2embed often omits number_of_seasons — keep probing until a gap after episodes.
      if (episodes.length > 0 && season > highestSeason) break;
      continue;
    }

    highestSeason = season;
    for (const ep of seasonEps) {
      episodes.push({
        episodeNumber: globalEpisodeNumber,
        seasonNumber: season,
        seasonEpisodeNumber: Number(ep.episode_number),
        episodeUrl: buildEpisodeUrl(tmdbId, season, ep.episode_number),
        episodeTitle: String(ep.name || '').trim()
      });
      globalEpisodeNumber += 1;
    }
  }

  if (!episodes.length) {
    return {
      episodes: [
        {
          episodeNumber: 1,
          seasonNumber: 1,
          seasonEpisodeNumber: 1,
          episodeUrl: buildEpisodeUrl(tmdbId, 1, 1),
          episodeTitle: ''
        }
      ],
      numberOfSeasons: 1
    };
  }

  return {
    episodes,
    numberOfSeasons: Math.max(highestSeason, declaredSeasons, 1)
  };
}

function summarizeEpisodes(episodes = []) {
  const seasonMap = new Map();

  for (const ep of episodes) {
    const seasonNumber = Number(ep.seasonNumber) || 1;
    if (!seasonMap.has(seasonNumber)) {
      seasonMap.set(seasonNumber, {
        seasonNumber,
        episodeCount: 0,
        episodes: []
      });
    }
    const row = seasonMap.get(seasonNumber);
    row.episodeCount += 1;
    row.episodes.push({
      seasonEpisodeNumber: Number(ep.seasonEpisodeNumber) || row.episodeCount,
      title: String(ep.episodeTitle || '').trim() || `Episode ${row.episodeCount}`
    });
  }

  const seasons = [...seasonMap.values()].sort((a, b) => a.seasonNumber - b.seasonNumber);

  return {
    numberOfSeasons: seasons.length ? seasons[seasons.length - 1].seasonNumber : 1,
    episodeCount: episodes.length,
    seasons
  };
}

module.exports = { buildAllSeasonEpisodes, fetchSeasonEpisodes, summarizeEpisodes };
