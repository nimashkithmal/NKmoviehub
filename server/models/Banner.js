const mongoose = require('mongoose');

/**
 * Home banner slide.
 * imageUrl = uploaded artwork (not the poster).
 * Link exactly one of: movie OR tvShow.
 */
const bannerSchema = new mongoose.Schema({
  imageUrl: {
    type: String,
    required: [true, 'Banner image is required']
  },
  publicId: {
    type: String,
    default: null
  },
  movie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    default: null
  },
  tvShow: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TVShow',
    default: null
  },
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
    default: ''
  },
  order: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  addedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

bannerSchema.index({ status: 1, order: 1 });

bannerSchema.pre('validate', function validateLink(next) {
  const hasMovie = Boolean(this.movie);
  const hasTvShow = Boolean(this.tvShow);
  if (!hasMovie && !hasTvShow) {
    this.invalidate('movie', 'Select a movie or a TV show for this banner');
  }
  next();
});

module.exports = mongoose.model('Banner', bannerSchema);
