const express = require('express');
const {
  startCastIndexer,
  getCastIndexerStatus,
  getCastStats,
  searchCastPeople,
  getCastPersonBySlug
} = require('../utils/castIndexer');

const router = express.Router();

// @route   GET /api/cast/status
// @desc    Cast index build progress + totals
// @access  Public
router.get('/status', async (req, res) => {
  try {
    const [status, stats] = await Promise.all([
      Promise.resolve(getCastIndexerStatus()),
      getCastStats()
    ]);

    const percent = stats.totalTitles > 0
      ? Math.min(100, Math.round((stats.indexedTitles / stats.totalTitles) * 100))
      : status.percent;

    return res.json({
      success: true,
      data: {
        ...status,
        ...stats,
        percent
      }
    });
  } catch (err) {
    console.error('Cast status error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to load cast index status'
    });
  }
});

// @route   GET /api/cast
// @desc    Browse cast collection with search + pagination
// @access  Public
router.get('/', async (req, res) => {
  try {
    const result = await searchCastPeople({
      q: req.query.q || req.query.search || '',
      page: req.query.page,
      limit: req.query.limit,
      sort: req.query.sort
    });

    res.set('Cache-Control', 'public, max-age=60');
    return res.json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Cast list error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to load cast collection'
    });
  }
});

// @route   POST /api/cast/rebuild
// @desc    Kick off background cast index rebuild
// @access  Public (safe — only reads catalog + 2embed metadata)
router.post('/rebuild', (req, res) => {
  startCastIndexer();
  return res.json({
    success: true,
    message: 'Cast index rebuild started',
    data: getCastIndexerStatus()
  });
});

// @route   GET /api/cast/:slug
// @desc    Cast member detail with linked titles
// @access  Public
router.get('/:slug', async (req, res) => {
  try {
    const person = await getCastPersonBySlug(String(req.params.slug || '').trim());
    if (!person) {
      return res.status(404).json({
        success: false,
        message: 'Cast member not found'
      });
    }

    const credits = [...(person.credits || [])].sort((a, b) => {
      const yearA = Number(a.year) || 0;
      const yearB = Number(b.year) || 0;
      if (yearB !== yearA) return yearB - yearA;
      return String(a.title).localeCompare(String(b.title));
    });

    res.set('Cache-Control', 'public, max-age=300');
    return res.json({
      success: true,
      data: {
        ...person,
        credits
      }
    });
  } catch (err) {
    console.error('Cast detail error:', err.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to load cast member'
    });
  }
});

module.exports = router;
