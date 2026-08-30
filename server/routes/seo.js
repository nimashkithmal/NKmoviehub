const express = require('express');
const Movie = require('../models/Movie');
const TVShow = require('../models/TVShow');
const { buildMovieHtml, buildTvShowHtml } = require('../utils/seoHtml');

const router = express.Router();

const SITE_ORIGIN = (process.env.SITE_URL || 'https://nkmoviehub.vercel.app').replace(
  /\/$/,
  ''
);

const STATIC_PAGES = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/collections', changefreq: 'weekly', priority: '0.9' },
  { loc: '/about', changefreq: 'monthly', priority: '0.6' },
  { loc: '/contact', changefreq: 'monthly', priority: '0.6' },
  { loc: '/privacy', changefreq: 'monthly', priority: '0.5' },
  { loc: '/terms', changefreq: 'monthly', priority: '0.5' },
  { loc: '/dmca', changefreq: 'monthly', priority: '0.5' }
];

const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
};

const xmlEscape = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// @route   GET /api/seo/sitemap.xml
// @desc    Dynamic sitemap with public movies and TV shows
// @access  Public
router.get('/sitemap.xml', async (req, res) => {
  try {
    const [movies, tvShows] = await Promise.all([
      Movie.find({ status: { $in: ['active', 'coming_soon'] } })
        .select('_id updatedAt')
        .sort({ updatedAt: -1 })
        .lean(),
      TVShow.find({ status: { $in: ['active', 'coming_soon'] } })
        .select('_id updatedAt')
        .sort({ updatedAt: -1 })
        .lean()
    ]);

    const urls = [
      ...STATIC_PAGES.map((page) => ({
        loc: `${SITE_ORIGIN}${page.loc}`,
        changefreq: page.changefreq,
        priority: page.priority,
        lastmod: null
      })),
      ...movies.map((movie) => ({
        loc: `${SITE_ORIGIN}/movie/${movie._id}`,
        changefreq: 'weekly',
        priority: '0.8',
        lastmod: toIsoDate(movie.updatedAt)
      })),
      ...tvShows.map((show) => ({
        loc: `${SITE_ORIGIN}/tvshow/${show._id}`,
        changefreq: 'weekly',
        priority: '0.8',
        lastmod: toIsoDate(show.updatedAt)
      }))
    ];

    const body = urls
      .map((url) => {
        const lastmod = url.lastmod ? `\n    <lastmod>${url.lastmod}</lastmod>` : '';
        return `  <url>
    <loc>${xmlEscape(url.loc)}</loc>${lastmod}
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.send(xml);
  } catch (error) {
    console.error('Sitemap error:', error);
    return res.status(500).send('Failed to generate sitemap');
  }
});

// @route   GET /api/seo/prerender/movie/:id
// @desc    Bot-friendly HTML for movie pages
// @access  Public
router.get('/prerender/movie/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id).lean();
    if (!movie) {
      return res.status(404).send('Movie not found');
    }

    const html = buildMovieHtml(movie, SITE_ORIGIN);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.send(html);
  } catch (error) {
    console.error('Movie prerender error:', error);
    return res.status(500).send('Failed to prerender movie page');
  }
});

// @route   GET /api/seo/prerender/tvshow/:id
// @desc    Bot-friendly HTML for TV show pages
// @access  Public
router.get('/prerender/tvshow/:id', async (req, res) => {
  try {
    const tvShow = await TVShow.findById(req.params.id).lean();
    if (!tvShow) {
      return res.status(404).send('TV show not found');
    }

    const html = buildTvShowHtml(tvShow, SITE_ORIGIN);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
    return res.send(html);
  } catch (error) {
    console.error('TV show prerender error:', error);
    return res.status(500).send('Failed to prerender TV show page');
  }
});

module.exports = router;
