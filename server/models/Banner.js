const mongoose = require('mongoose');

/**
 * A single slide in the home page slideshow.
 *
 * The image always lives on Cloudinary under the home page banner folder;
 * publicId is kept so the image can be removed from Cloudinary when the slide
 * is deleted or its image is replaced.
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
  title: {
    type: String,
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters'],
    default: ''
  },
  // Lower numbers show first; ties fall back to creation order
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

module.exports = mongoose.model('Banner', bannerSchema);
