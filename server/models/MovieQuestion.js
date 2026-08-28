const mongoose = require('mongoose');

const movieQuestionSchema = new mongoose.Schema({
  movie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie',
    required: true,
    index: true
  },
  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000
  },
  answer: {
    type: String,
    trim: true,
    maxlength: 4000,
    default: ''
  },
  answeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  answeredAt: {
    type: Date,
    default: null
  },
  sessionId: {
    type: String,
    trim: true,
    maxlength: 80,
    default: '',
    index: true
  },
  fromName: {
    type: String,
    trim: true,
    maxlength: 100,
    default: ''
  },
  fromEmail: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 120,
    default: ''
  }
}, {
  timestamps: true
});

movieQuestionSchema.index({ movie: 1, createdAt: 1 });
movieQuestionSchema.index({ movie: 1, sessionId: 1, createdAt: 1 });

module.exports = mongoose.model('MovieQuestion', movieQuestionSchema);
