const mongoose = require('mongoose');

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
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
    default: ''
  },
  movies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Movie'
  }],
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

collectionSchema.index({ status: 1, order: 1 });

module.exports = mongoose.model('Collection', collectionSchema);
