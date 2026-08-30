const { buildMovieHtml } = require('../../../lib/seoHtml');

const API_BASE = (process.env.API_BASE_URL || 'http://51.20.40.2').replace(/\/$/, '');
const SITE_ORIGIN = (process.env.SITE_URL || 'https://nkmoviehub.vercel.app').replace(/\/$/, '');

module.exports = async (req, res) => {
  const { id } = req.query;
  if (!id) {
    return res.status(400).send('Missing movie id');
  }

  try {
    const response = await fetch(`${API_BASE}/api/movies/${id}`);
    if (!response.ok) {
      return res.status(response.status).send('Movie not found');
    }

    const result = await response.json();
    const movie = result?.data?.movie;
    if (!movie) {
      return res.status(404).send('Movie not found');
    }

    const html = buildMovieHtml(movie, SITE_ORIGIN);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Movie prerender error:', error);
    return res.status(500).send('Failed to prerender movie page');
  }
};
