const express = require('express');
const fetch = require('node-fetch');
const Movie = require('../models/Movie');
const TVShow = require('../models/TVShow');
const PendingTitle = require('../models/PendingTitle');
const { protect, restrictToAdmin } = require('../middleware/auth');
const { findExistingMovieDuplicate } = require('../utils/deduplicateMovies');
const { uploadPoster } = require('../utils/cloudinaryUpload');
const { evaluateContentPolicy } = require('../utils/contentPolicy');
const { buildEpisodeUrl } = require('../utils/tvEpisodeUrls');
const {
  triggerEmbedSync,
  getEmbedSyncStatus,
  fetchEmbedMetadata
} = require('../utils/embedSyncIndexer');

const router = express.Router();
const EMBED_API = 'https://api.2embed.cc';

const escapeRegex = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function buildSeasonOneEpisodes(tmdbId) {
  const response = await fetch(
    `${EMBED_API}/season?tmdb_id=${encodeURIComponent(tmdbId)}&season=1`,
    { headers: { Accept: 'application/json' } }
  );

  if (response.ok) {
    const data = await response.json();
    const episodes = (data.episodes || []).filter((ep) => Number(ep.episode_number) > 0);
    if (episodes.length) {
      return episodes.map((ep, index) => ({
        episodeNumber: index + 1,
        seasonNumber: 1,
        seasonEpisodeNumber: Number(ep.episode_number),
        episodeUrl: buildEpisodeUrl(tmdbId, 1, ep.episode_number),
        episodeTitle: String(ep.name || '').trim()
      }));
    }
  }

  return [
    {
      episodeNumber: 1,
      seasonNumber: 1,
      seasonEpisodeNumber: 1,
      episodeUrl: buildEpisodeUrl(tmdbId, 1, 1),
      episodeTitle: ''
    }
  ];
}

async function findExistingTVShowDuplicate({ title, year, tmdbId }) {
  const clauses = [];
  if (tmdbId) clauses.push({ tmdbId: String(tmdbId) });
  if (title && year) {
    clauses.push({
      title: { $regex: `^${escapeRegex(String(title).trim())}$`, $options: 'i' },
      year: Number(year)
    });
  }
  if (!clauses.length) return null;
  return TVShow.findOne({ $or: clauses }).select('_id title year').lean();
}

async function approvePendingTitle(pending, userId, payload = {}) {
  const title = String(payload.title ?? pending.title).trim();
  const year = parseInt(payload.year ?? pending.year, 10);
  const description = String(payload.description ?? pending.description).trim();
  const genre = String(payload.genre ?? pending.genre).trim();
  const imdbRating = Math.min(10, Math.max(0, parseFloat(payload.imdbRating ?? pending.imdbRating) || 0));
  const posterUrl = String(payload.posterUrl ?? payload.imageUrl ?? pending.posterUrl ?? '').trim();
  const backdropUrl = String(payload.backdropUrl ?? pending.backdropUrl ?? '').trim() || null;
  const catalogStatus =
    payload.catalogStatus === 'coming_soon' || payload.status === 'coming_soon'
      ? 'coming_soon'
      : payload.catalogStatus === 'active' || payload.status === 'active'
        ? 'active'
        : pending.catalogStatus === 'coming_soon'
          ? 'coming_soon'
          : 'active';
  const siteStatus = catalogStatus === 'coming_soon' ? 'coming_soon' : 'active';

  const policy = evaluateContentPolicy({ title, description, genre });
  if (policy.restricted) {
    throw new Error('This title is blocked by content policy');
  }

  if (!title || !year || !description || !genre) {
    throw new Error('Title, year, description, and genre are required');
  }

  if (pending.type === 'movie') {
    const movieUrl =
      String(payload.movieUrl || `https://www.2embed.cc/embed/${pending.tmdbId}`).trim();
    const existing = await findExistingMovieDuplicate({ title, year, movieUrl });
    if (existing) {
      throw new Error(`Already in catalog: ${existing.title} (${existing.year})`);
    }

    if (!posterUrl) {
      throw new Error('Poster URL is required');
    }

    const movie = await Movie.create({
      title,
      year,
      description,
      genre,
      movieUrl,
      imdbRating,
      imageUrl: posterUrl,
      images: [posterUrl],
      bannerUrl: backdropUrl,
      trailerUrl: String(payload.trailerUrl ?? pending.trailerUrl ?? '').trim(),
      tagline: String(payload.tagline ?? pending.tagline ?? '').trim(),
      director: String(payload.director ?? pending.director ?? '').trim(),
      language: String(payload.language ?? pending.language ?? '').trim(),
      releaseDate: String(payload.releaseDate ?? pending.releaseDate ?? '').trim(),
      runtime: payload.runtime ?? pending.runtime ?? null,
      releaseStatus: String(payload.releaseStatus ?? pending.releaseStatus ?? '').trim(),
      addedBy: userId,
      status: siteStatus
    });

    return { kind: 'movie', id: movie._id };
  }

  const tmdbId = String(payload.tmdbId ?? pending.tmdbId).trim();
  const existingTv = await findExistingTVShowDuplicate({ title, year, tmdbId });
  if (existingTv) {
    throw new Error(`Already in catalog: ${existingTv.title} (${existingTv.year})`);
  }

  if (!posterUrl) {
    throw new Error('Poster URL is required');
  }

  const imageUrl = await uploadPoster(posterUrl, { type: 'tvshow' });
  const episodes = await buildSeasonOneEpisodes(tmdbId);

  const tvShow = await TVShow.create({
    title,
    year,
    description,
    genre,
    showUrl: episodes[0]?.episodeUrl || buildEpisodeUrl(tmdbId, 1, 1),
    episodes,
    episodeCount: episodes.length,
    numberOfSeasons: parseInt(payload.numberOfSeasons ?? pending.numberOfSeasons, 10) || 1,
    imdbRating,
    imageUrl,
    images: [imageUrl],
    bannerUrl: backdropUrl ? await uploadPoster(backdropUrl, { type: 'tvshow' }).catch(() => null) : null,
    trailerUrl: String(payload.trailerUrl ?? pending.trailerUrl ?? '').trim(),
    tagline: String(payload.tagline ?? pending.tagline ?? '').trim(),
    director: String(payload.director ?? pending.director ?? '').trim(),
    language: String(payload.language ?? pending.language ?? '').trim(),
    releaseDate: String(payload.releaseDate ?? pending.releaseDate ?? '').trim(),
    runtime: payload.runtime ?? pending.runtime ?? null,
    releaseStatus: String(payload.releaseStatus ?? pending.releaseStatus ?? '').trim(),
    tmdbId,
    addedBy: userId,
    status: siteStatus
  });

  return { kind: 'tvshow', id: tvShow._id };
}

// @route   GET /api/sync/status
router.get('/status', protect, restrictToAdmin, (req, res) => {
  res.json({ success: true, data: getEmbedSyncStatus() });
});

// @route   POST /api/sync/run
router.post('/run', protect, restrictToAdmin, (req, res) => {
  const query = String(req.body?.q || req.body?.query || '').trim();
  const type =
    req.body?.type === 'tvshow' ? 'tvshow' : req.body?.type === 'movie' ? 'movie' : '';
  const result = triggerEmbedSync({ query, type });
  res.json({
    success: true,
    message: query
      ? `Searching 2embed for "${query}"`
      : '2embed trending sync started',
    data: { ...getEmbedSyncStatus(), ...result }
  });
});

// @route   GET /api/sync/pending
router.get('/pending', protect, restrictToAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit, 10) || 30));
    const type = req.query.type === 'tvshow' ? 'tvshow' : req.query.type === 'movie' ? 'movie' : '';
    const search = String(req.query.q || req.query.search || '').trim();
    const exact = req.query.exact === '1' || req.query.exact === 'true';
    const filter = { status: 'pending' };
    if (type) filter.type = type;
    if (search) {
      filter.title = exact
        ? { $regex: `^${escapeRegex(search)}$`, $options: 'i' }
        : { $regex: escapeRegex(search), $options: 'i' };
    }

    const [items, total] = await Promise.all([
      PendingTitle.find(filter)
        .sort({ discoveredAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      PendingTitle.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        items,
        pagination: {
          currentPage: page,
          totalPages: Math.max(1, Math.ceil(total / limit)),
          totalItems: total,
          itemsPerPage: limit
        }
      }
    });
  } catch (err) {
    console.error('List pending titles error:', err);
    res.status(500).json({ success: false, message: 'Failed to load pending titles' });
  }
});

// @route   GET /api/sync/pending/:id
router.get('/pending/:id', protect, restrictToAdmin, async (req, res) => {
  try {
    const item = await PendingTitle.findById(req.params.id).lean();
    if (!item) {
      return res.status(404).json({ success: false, message: 'Pending title not found' });
    }
    res.json({ success: true, data: { item } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load pending title' });
  }
});

// @route   POST /api/sync/pending/:id/approve
router.post('/pending/:id/approve', protect, restrictToAdmin, async (req, res) => {
  try {
    const pending = await PendingTitle.findById(req.params.id);
    if (!pending) {
      return res.status(404).json({ success: false, message: 'Pending title not found' });
    }
    if (pending.status !== 'pending') {
      return res.status(400).json({ success: false, message: `Already ${pending.status}` });
    }

    if (!pending.posterUrl) {
      const fresh = await fetchEmbedMetadata(pending.type, pending.tmdbId);
      if (fresh?.poster || fresh?.poster_path) {
        pending.posterUrl = fresh.poster || `https://image.tmdb.org/t/p/w500${fresh.poster_path}`;
        await pending.save();
      }
    }

    const created = await approvePendingTitle(pending, req.user.id, req.body || {});
    pending.status = 'approved';
    pending.approvedAt = new Date();
    pending.addedCatalogId = created.id;
    await pending.save();

    res.json({
      success: true,
      message: `${pending.type === 'movie' ? 'Movie' : 'TV show'} added to catalog`,
      data: { pending, created }
    });
  } catch (err) {
    console.error('Approve pending title error:', err);
    res.status(400).json({ success: false, message: err.message || 'Failed to approve title' });
  }
});

// @route   POST /api/sync/pending/:id/dismiss
router.post('/pending/:id/dismiss', protect, restrictToAdmin, async (req, res) => {
  try {
    const pending = await PendingTitle.findById(req.params.id);
    if (!pending) {
      return res.status(404).json({ success: false, message: 'Pending title not found' });
    }

    pending.status = 'dismissed';
    pending.dismissedAt = new Date();
    await pending.save();

    res.json({ success: true, message: 'Title dismissed', data: { pending } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to dismiss title' });
  }
});

module.exports = router;
