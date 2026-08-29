const mongoose = require('mongoose');
const { CATEGORY_IDS } = require('../constants/collectionCategories');

const toSlug = (value) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Named franchise / universe groups (Marvel, DC, Harry Potter, etc.).
 * Public page shows title + year name lists; click opens movie detail.
 */
const collectionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Collection name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  slug: {
    type: String,
    trim: true,
    lowercase: true,
    unique: true,
    sparse: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  category: {
    type: String,
    enum: CATEGORY_IDS,
    default: 'action_franchises'
  },
  movies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie'
  }],
  /** MCU timeline / list display years — parallel to `movies` array */
  timelineYears: {
    type: [Number],
    default: []
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

collectionSchema.index({ status: 1, category: 1, order: 1 });

collectionSchema.pre('validate', function setSlug(next) {
  if (!this.slug && this.name) {
    this.slug = toSlug(this.name);
  }
  next();
});

module.exports = mongoose.model('Collection', collectionSchema);
module.exports.toSlug = toSlug;
