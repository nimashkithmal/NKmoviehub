const express = require('express');
const AnalyticsEvent = require('../models/AnalyticsEvent');
const { protect, restrictToAdmin } = require('../middleware/auth');
const { getDashboard } = require('../services/analyticsDashboard');

const router = express.Router();

const ALLOWED_TYPES = new Set(['page_view', 'view_content', 'watch_click']);
const ALLOWED_CONTENT = new Set(['movie', 'tv_show', 'tv_episode', '']);

// @route   POST /api/analytics/track
// @desc    Mirror client analytics events (GA4 runs in browser)
router.post('/track', express.json({ limit: '16kb' }), async (req, res) => {
  try {
    let payload = req.body;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      if (typeof req.body === 'string' && req.body.trim()) {
        payload = JSON.parse(req.body);
      } else {
        return res.status(400).json({ success: false, message: 'Invalid payload' });
      }
    }

    const {
      type,
      contentType = '',
      itemId = '',
      itemName = '',
      path = '',
      title = '',
      visitorId = '',
      trafficSource = 'direct',
      countryHint = {}
    } = payload;

    if (!ALLOWED_TYPES.has(type)) {
      return res.status(400).json({ success: false, message: 'Invalid event type' });
    }

    const safeContent = ALLOWED_CONTENT.has(contentType) ? contentType : '';

    await AnalyticsEvent.create({
      type,
      contentType: safeContent,
      itemId: String(itemId).slice(0, 120),
      itemName: String(itemName).slice(0, 200),
      path: String(path).slice(0, 300),
      title: String(title).slice(0, 200),
      visitorId: String(visitorId).slice(0, 80),
      trafficSource: String(trafficSource || 'direct').slice(0, 120),
      countryHint: {
        timezone: String(countryHint.timezone || '').slice(0, 80),
        locale: String(countryHint.locale || '').slice(0, 20)
      }
    });

    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Analytics track error:', error);
    res.status(500).json({ success: false, message: 'Failed to record event' });
  }
});

// @route   GET /api/analytics/dashboard
// @desc    Admin analytics summary
router.get('/dashboard', protect, restrictToAdmin, async (req, res) => {
  try {
    const data = await getDashboard(req.query);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Analytics dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to load analytics dashboard'
    });
  }
});

module.exports = router;
