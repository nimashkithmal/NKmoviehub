const mongoose = require('mongoose');

const analyticsEventSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['page_view', 'view_content', 'watch_click'],
    required: true,
    index: true
  },
  contentType: {
    type: String,
    enum: ['movie', 'tv_show', 'tv_episode', ''],
    default: ''
  },
  itemId: { type: String, default: '', trim: true },
  itemName: { type: String, default: '', trim: true },
  path: { type: String, default: '', trim: true },
  title: { type: String, default: '', trim: true },
  visitorId: { type: String, default: '', index: true },
  trafficSource: { type: String, default: 'direct', trim: true },
  countryHint: {
    timezone: { type: String, default: '' },
    locale: { type: String, default: '' }
  }
}, {
  timestamps: true
});

analyticsEventSchema.index({ createdAt: -1 });
analyticsEventSchema.index({ type: 1, createdAt: -1 });
analyticsEventSchema.index({ contentType: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('AnalyticsEvent', analyticsEventSchema);
