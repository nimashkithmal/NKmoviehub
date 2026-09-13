const express = require('express');
const Movie = require('../models/Movie');
const TVShow = require('../models/TVShow');
const { applyPublicCatalogFilter, filterPublicItems } = require('../utils/contentPolicy');
const { escapeRegex, parseCatalogSearch, tokenRegex } = require('../utils/catalogSearch');

const router = express.Router();

const SUGGEST_FIELDS = 'title year imageUrl status';
const MAX_PER_TYPE = 6;
const MAX_TOTAL = 8;

const rankTitle = (title = '', query = '') => {
  const t = String(title).toLowerCase();
  const q = String(query).toLowerCase().trim();
  if (!q) return 3;
  if (t.startsWith(q)) return 0;
  if (t.split(/\s+/).some((word) => word.startsWith(q))) return 1;
  if (t.includes(q)) return 2;
  return 3;
};

// @route   GET /api/search/suggest
// @desc    Lightweight title suggestions for the navbar search
// @access  Public
router.get('/suggest', async (req, res) => {
  try {
    const rawQuery = String(req.query.q || req.query.search || '').trim();
    if (rawQuery.length < 2) {
      return res.json({ success: true, data: { suggestions: [] } });
    }

    const { query, year: yearHint } = parseCatalogSearch(rawQuery);
    const text = query || rawQuery;
    if (text.length < 2 && !yearHint) {
      return res.json({ success: true, data: { suggestions: [] } });
    }

    const escaped = escapeRegex(text);
    const titlePattern = text.length >= 2 ? tokenRegex(text) : escaped;
    const titleFilter = applyPublicCatalogFilter({
      status: { $in: ['active', 'coming_soon'] },
      ...(text.length >= 2 ? { title: { $regex: titlePattern, $options: 'i' } } : {}),
      ...(yearHint ? { year: yearHint } : {})
    });

    const [movies, tvShows] = await Promise.all([
      Movie.find(titleFilter).select(SUGGEST_FIELDS).limit(MAX_PER_TYPE).lean(),
      TVShow.find(titleFilter).select(SUGGEST_FIELDS).limit(MAX_PER_TYPE).lean()
    ]);

    const suggestions = filterPublicItems([
      ...movies.map((item) => ({ ...item, type: 'movie' })),
      ...tvShows.map((item) => ({ ...item, type: 'tvshow' }))
    ])
      .sort((a, b) => {
        const rankDiff = rankTitle(a.title, text) - rankTitle(b.title, text);
        if (rankDiff !== 0) return rankDiff;
        if (yearHint) {
          const aYear = Number(a.year) === Number(yearHint) ? 0 : 1;
          const bYear = Number(b.year) === Number(yearHint) ? 0 : 1;
          if (aYear !== bYear) return aYear - bYear;
        }
        return String(a.title).localeCompare(String(b.title));
      })
      .slice(0, MAX_TOTAL)
      .map((item) => ({
        _id: item._id,
        title: item.title,
        year: item.year,
        imageUrl: item.imageUrl,
        type: item.type,
        status: item.status
      }));

    res.set('Cache-Control', 'private, max-age=30');
    res.json({
      success: true,
      data: { suggestions, query: rawQuery }
    });
  } catch (error) {
    console.error('Search suggest error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching search suggestions'
    });
  }
});

module.exports = router;
