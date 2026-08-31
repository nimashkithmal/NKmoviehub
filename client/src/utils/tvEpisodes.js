/** Shared TV season / episode helpers */

export const extractTmdbIdFromUrl = (url = '') => {
  const raw = String(url || '');
  return (
    raw.match(/2embed\.[^/]+\/embedtv(?:full)?\/(\d+)/i)?.[1] ||
    raw.match(/2embed\.[^/]+\/tv\/(\d+)/i)?.[1] ||
    raw.match(/2embed\.[^/]+\/embed\/(\d+)/i)?.[1] ||
    null
  );
};

export const extractSeasonEpisodeFromUrl = (url = '') => {
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

  return null;
};

export const getTvShowTmdbId = (tvShow) => {
  const fromField = String(tvShow?.tmdbId || '').trim();
  if (fromField) return fromField;

  const fromShow = extractTmdbIdFromUrl(tvShow?.showUrl);
  if (fromShow) return fromShow;

  for (const episode of tvShow?.episodes || []) {
    const fromEpisode = extractTmdbIdFromUrl(episode?.episodeUrl);
    if (fromEpisode) return fromEpisode;
  }

  return null;
};

export const groupEpisodesBySeasons = (episodes = [], numberOfSeasons = 1) => {
  if (!episodes.length || !numberOfSeasons) return [];

  const sortedEpisodes = [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
  const episodesBySeason = {};

  sortedEpisodes.forEach((episode, index) => {
    const url = episode.episodeUrl || '';
    const fromUrl = extractSeasonEpisodeFromUrl(url);
    let seasonNum = Number(episode.seasonNumber) || fromUrl?.season || 1;
    let seasonEpisodeNumber = Number(episode.seasonEpisodeNumber) || fromUrl?.episode || 1;

    if (!episode.seasonNumber) {
      const seasonMatch =
        url.match(/[?&]s=(\d{1,3})(?:[?&]|$)/i) ||
        url.match(/embedtv\/\d+&s=(\d{1,3})/i) ||
        url.match(/[sS](\d{1,3})[eE]/) ||
        url.match(/season[_\s-]?(\d{1,3})/i) ||
        url.match(/\/s(\d{1,3})\//);

      if (seasonMatch) {
        const detectedSeason = parseInt(seasonMatch[1], 10);
        if (detectedSeason >= 1 && detectedSeason <= numberOfSeasons) {
          seasonNum = detectedSeason;
        }
      } else if (numberOfSeasons > 1) {
        const episodesPerSeason = Math.ceil(sortedEpisodes.length / numberOfSeasons);
        seasonNum = Math.floor(index / episodesPerSeason) + 1;
        if (seasonNum > numberOfSeasons) seasonNum = numberOfSeasons;
        seasonEpisodeNumber = (index % episodesPerSeason) + 1;
      }
    }

    if (!episodesBySeason[seasonNum]) episodesBySeason[seasonNum] = [];
    episodesBySeason[seasonNum].push({
      ...episode,
      seasonNumber: seasonNum,
      seasonEpisodeNumber:
        episode.seasonEpisodeNumber || episodesBySeason[seasonNum].length + 1
    });
  });

  const seasons = [];
  for (let seasonNum = 1; seasonNum <= numberOfSeasons; seasonNum += 1) {
    if (episodesBySeason[seasonNum]?.length) {
      seasons.push({
        seasonNumber: seasonNum,
        episodes: episodesBySeason[seasonNum]
      });
    }
  }

  return seasons;
};

export const findEpisodeInSeasons = (seasons, seasonNumber, episodeNumber) => {
  const season = seasons.find((s) => s.seasonNumber === seasonNumber) || seasons[0];
  if (!season) return null;
  return (
    season.episodes.find((ep) => ep.seasonEpisodeNumber === episodeNumber) ||
    season.episodes[episodeNumber - 1] ||
    null
  );
};
