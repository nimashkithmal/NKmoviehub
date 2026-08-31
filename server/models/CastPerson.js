const mongoose = require('mongoose');

const castCreditSchema = new mongoose.Schema(
  {
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    type: {
      type: String,
      enum: ['movie', 'tvshow'],
      required: true
    },
    title: { type: String, required: true, trim: true },
    year: { type: Number, default: null },
    imageUrl: { type: String, default: '' },
    character: { type: String, default: '' },
    role: { type: String, enum: ['cast', 'director'], default: 'cast' }
  },
  { _id: false }
);

const castPersonSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  tmdbPersonId: {
    type: String,
    default: '',
    trim: true,
    index: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  profile: {
    type: String,
    default: ''
  },
  creditCount: {
    type: Number,
    default: 0,
    index: true
  },
  credits: {
    type: [castCreditSchema],
    default: []
  }
});

castPersonSchema.index({ name: 'text' });

module.exports = mongoose.model('CastPerson', castPersonSchema);
