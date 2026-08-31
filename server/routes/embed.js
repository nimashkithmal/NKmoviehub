const express = require('express');
const fetch = require('node-fetch');

const router = express.Router();

const EMBED_API = 'https://api.2embed.cc';

const proxyEmbed = async (req, res, path) => {
  const { tmdb_id, imdb_id } = req.query;

  if (!tmdb_id && !imdb_id) {
    return res.status(400).json({
      success: false,
      message: 'tmdb_id or imdb_id is required'
    });
  }

  const params = new URLSearchParams();
  if (tmdb_id) params.set('tmdb_id', String(tmdb_id));
  if (imdb_id) params.set('imdb_id', String(imdb_id));

  try {
    const response = await fetch(`${EMBED_API}/${path}?${params.toString()}`, {
      headers: { Accept: 'application/json' }
    });

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: 'Embed metadata unavailable'
      });
    }

    const data = await response.json();
    return res.json(data);
  } catch (err) {
    console.error(`Embed proxy error (${path}):`, err.message);
    return res.status(502).json({
      success: false,
      message: 'Failed to fetch embed metadata'
    });
  }
};

router.get('/movie', (req, res) => proxyEmbed(req, res, 'movie'));
router.get('/tv', (req, res) => proxyEmbed(req, res, 'tv'));

router.get('/season', async (req, res) => {
  const { tmdb_id, season } = req.query;
  const tmdbId = String(tmdb_id || '').trim();
  const seasonNum = Math.max(1, parseInt(season, 10) || 1);

  if (!tmdbId) {
    return res.status(400).json({
      success: false,
      message: 'tmdb_id is required'
    });
  }

  try {
    const response = await fetch(
      `${EMBED_API}/season?tmdb_id=${encodeURIComponent(tmdbId)}&season=${seasonNum}`,
      { headers: { Accept: 'application/json' } }
    );

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: 'Season metadata unavailable'
      });
    }

    const data = await response.json();
    const episodes = (data.episodes || []).map((ep) => ({
      episodeNumber: Number(ep.episode_number) || 0,
      still: ep.still || ''
    }));

    res.set('Cache-Control', 'public, max-age=3600');
    return res.json({ success: true, data: { season: seasonNum, episodes } });
  } catch (err) {
    console.error('Embed season proxy error:', err.message);
    return res.status(502).json({
      success: false,
      message: 'Failed to fetch season metadata'
    });
  }
});

module.exports = router;
