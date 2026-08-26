const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['movie_ask', 'contact', 'system'],
    default: 'movie_ask'
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  fromName: {
    type: String,
    trim: true,
    maxlength: 100,
    default: 'Guest'
  },
  fromEmail: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  movie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    default: null
  },
  movieTitle: {
    type: String,
    trim: true,
    default: ''
  },
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MovieQuestion',
    default: null
  },
  replied: {
    type: Boolean,
    default: false
  },
  read: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

notificationSchema.index({ read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
