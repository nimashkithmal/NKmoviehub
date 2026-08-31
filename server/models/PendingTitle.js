const mongoose = require('mongoose');

const pendingTitleSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['movie', 'tvshow'],
      required: true
    },
    tmdbId: {
      type: String,
      required: true,
      trim: true
    },
    imdbId: { type: String, trim: true, default: '' },
    title: { type: String, required: true, trim: true, maxlength: 100 },
    year: { type: Number, required: true },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    genre: { type: String, required: true, trim: true },
    posterUrl: { type: String, default: '' },
    backdropUrl: { type: String, default: '' },
    imdbRating: { type: Number, default: 0, min: 0, max: 10 },
    releaseDate: { type: String, default: '' },
    trailerUrl: { type: String, default: '' },
    language: { type: String, default: '' },
    director: { type: String, default: '' },
    tagline: { type: String, default: '' },
    runtime: { type: Number, default: null },
    numberOfSeasons: { type: Number, default: 1 },
    episodeCount: { type: Number, default: 0 },
    source: { type: String, default: 'trending' },
    catalogStatus: {
      type: String,
      enum: ['active', 'coming_soon'],
      default: 'active'
    },
    releaseStatus: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'dismissed'],
      default: 'pending'
    },
    discoveredAt: { type: Date, default: Date.now },
    approvedAt: { type: Date, default: null },
    dismissedAt: { type: Date, default: null },
    addedCatalogId: { type: mongoose.Schema.Types.ObjectId, default: null }
  },
  { timestamps: true }
);

pendingTitleSchema.index({ type: 1, tmdbId: 1 }, { unique: true });
pendingTitleSchema.index({ status: 1, discoveredAt: -1 });

module.exports = mongoose.model('PendingTitle', pendingTitleSchema);
