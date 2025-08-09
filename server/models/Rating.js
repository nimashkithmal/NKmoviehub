const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  movie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: [1, 'Rating must be at least 1'],
    max: [10, 'Rating cannot exceed 10']
  },
  review: {
    type: String,
    trim: true,
    maxlength: [500, 'Review cannot exceed 500 characters']
  }
}, {
  timestamps: true
});

// Ensure one rating per user per movie
ratingSchema.index({ user: 1, movie: 1 }, { unique: true });

// Virtual for formatted rating
ratingSchema.virtual('formattedRating').get(function() {
  return this.rating.toFixed(1);
});

// Ensure virtuals are serialized
ratingSchema.set('toJSON', { virtuals: true });
ratingSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Rating', ratingSchema); 