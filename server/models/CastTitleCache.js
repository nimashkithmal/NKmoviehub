const mongoose = require('mongoose');

const castMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    character: { type: String, default: '' },
    profile: { type: String, default: '' },
    role: { type: String, enum: ['cast', 'director'], default: 'cast' }
  },
  { _id: false }
);

const castTitleCacheSchema = new mongoose.Schema({
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['movie', 'tvshow'],
    required: true
  },
  tmdbId: {
    type: String,
    required: true,
    index: true
  },
  title: { type: String, required: true, trim: true },
  year: { type: Number, default: null },
  imageUrl: { type: String, default: '' },
  cast: {
    type: [castMemberSchema],
    default: []
  },
  fetchedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

castTitleCacheSchema.index({ entityId: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('CastTitleCache', castTitleCacheSchema);
