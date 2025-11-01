const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Movie title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  year: {
    type: Number,
    required: [true, 'Release year is required'],
    min: [1900, 'Year must be at least 1900'],
    max: [new Date().getFullYear() + 5, 'Year cannot be more than 5 years in the future']
  },
  description: {
    type: String,
    required: [true, 'Movie description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  imageUrl: {
    type: String,
    required: [true, 'Movie image is required']
  },
  movieUrl: {
    type: String,
    required: [true, 'Movie URL is required'],
    trim: true
  },
  imdbRating: {
    type: Number,
    required: [true, 'IMDB rating is required'],
    min: [0, 'IMDB rating must be at least 0'],
    max: [10, 'IMDB rating cannot exceed 10'],
    default: 0
  },
  genre: {
    type: String,
    required: [true, 'Movie genre is required'],
    trim: true
  },
  averageRating: {
    type: Number,
    default: 0,
    min: [0, 'Average rating cannot be negative'],
    max: [10, 'Average rating cannot exceed 10']
  },
  totalRatings: {
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

// Index for better search performance
movieSchema.index({ title: 'text', description: 'text', genre: 'text' });

// Static method to get movie statistics
movieSchema.statics.getStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalMovies: { $sum: 1 },
        activeMovies: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
        averageRating: { $avg: '$rating' }
      }
    }
  ]);
  
  return stats[0] || { totalMovies: 0, activeMovies: 0, averageRating: 0 };
};

// Instance method to get formatted year
movieSchema.methods.getFormattedYear = function() {
  return this.year.toString();
};

// Instance method to get short description
movieSchema.methods.getShortDescription = function(maxLength = 100) {
  if (this.description.length <= maxLength) return this.description;
  return this.description.substring(0, maxLength) + '...';
};

// Instance method to update average rating
movieSchema.methods.updateAverageRating = async function() {
  const Rating = mongoose.model('Rating');
  const result = await Rating.aggregate([
    { $match: { movie: this._id } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 }
      }
    }
  ]);
  
  if (result.length > 0) {
    this.averageRating = Math.round(result[0].averageRating * 10) / 10;
    this.totalRatings = result[0].totalRatings;
  } else {
    this.averageRating = 0;
    this.totalRatings = 0;
  }
  
  await this.save();
  return { averageRating: this.averageRating, totalRatings: this.totalRatings };
};

// Instance method to get user rating for this movie
movieSchema.methods.getUserRating = async function(userId) {
  const Rating = mongoose.model('Rating');
  const rating = await Rating.findOne({ user: userId, movie: this._id });
  return rating ? rating.rating : null;
};

module.exports = mongoose.model('Movie', movieSchema); 