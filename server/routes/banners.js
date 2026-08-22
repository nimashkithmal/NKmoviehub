const express = require('express');
const { body, validationResult } = require('express-validator');
const Banner = require('../models/Banner');
const { protect, restrictToAdmin } = require('../middleware/auth');
// Every banner image is pushed to Cloudinary before it reaches the database
const { cloudinary, uploadImage } = require('../utils/cloudinaryUpload');

const router = express.Router();

/**
 * Remove an image from Cloudinary, ignoring failures.
 * A slide should still be deletable even if the remote file has already gone.
 */
const destroyImage = async (publicId) => {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
  }
};

// @route   GET /api/banners
// @desc    Get the active home page slides
// @access  Public
router.get('/', async (req, res) => {
  try {
    const banners = await Banner.find({ status: 'active' })
      .sort({ order: 1, createdAt: 1 })
      .select('imageUrl title order');

    res.json({
      success: true,
      data: { banners }
    });
  } catch (error) {
    console.error('Get banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching banners'
    });
  }
});

// @route   GET /api/banners/admin
// @desc    Get every slide, including inactive ones (admin only)
// @access  Private/Admin
router.get('/admin', protect, restrictToAdmin, async (req, res) => {
  try {
    const banners = await Banner.find()
      .populate('addedBy', 'name email')
      .sort({ order: 1, createdAt: 1 });

    res.json({
      success: true,
      data: { banners }
    });
  } catch (error) {
    console.error('Get admin banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching banners'
    });
  }
});

// @route   POST /api/banners
// @desc    Add a home page slide (admin only)
// @access  Private/Admin
router.post('/', protect, restrictToAdmin, [
  body('image')
    .notEmpty()
    .withMessage('An image file or image URL is required'),
  body('title')
    .optional({ checkFalsy: true })
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters'),
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order must be a positive number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { image, title = '', status = 'active' } = req.body;

    let uploaded;
    try {
      uploaded = await uploadImage(image, { type: 'banner' });
    } catch (uploadError) {
      console.error('Banner upload error:', uploadError);
      return res.status(400).json({
        success: false,
        message: 'Could not upload the banner image. Please check the file or URL.'
      });
    }

    // New slides go to the end of the slideshow unless an order is given
    const order = req.body.order !== undefined
      ? parseInt(req.body.order, 10)
      : await Banner.countDocuments();

    const banner = await Banner.create({
      imageUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
      title,
      order,
      status: status === 'inactive' ? 'inactive' : 'active',
      addedBy: req.user._id
    });

    res.status(201).json({
      success: true,
      message: 'Banner added successfully',
      data: { banner }
    });
  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating the banner'
    });
  }
});

// @route   PUT /api/banners/:id
// @desc    Update a slide's image, title or position (admin only)
// @access  Private/Admin
router.put('/:id', protect, restrictToAdmin, async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    const { image, title, order, status } = req.body;

    // Replacing the image also clears the old one out of Cloudinary
    if (image && image !== banner.imageUrl) {
      let uploaded;
      try {
        uploaded = await uploadImage(image, { type: 'banner' });
      } catch (uploadError) {
        console.error('Banner upload error:', uploadError);
        return res.status(400).json({
          success: false,
          message: 'Could not upload the banner image. Please check the file or URL.'
        });
      }

      const previousPublicId = banner.publicId;
      banner.imageUrl = uploaded.secure_url;
      banner.publicId = uploaded.public_id;
      await destroyImage(previousPublicId);
    }

    if (title !== undefined) banner.title = title;
    if (order !== undefined) banner.order = parseInt(order, 10);
    if (status === 'active' || status === 'inactive') banner.status = status;

    await banner.save();

    res.json({
      success: true,
      message: 'Banner updated successfully',
      data: { banner }
    });
  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating the banner'
    });
  }
});

// @route   PATCH /api/banners/:id/status
// @desc    Show or hide a slide without deleting it (admin only)
// @access  Private/Admin
router.patch('/:id/status', protect, restrictToAdmin, async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    banner.status = banner.status === 'active' ? 'inactive' : 'active';
    await banner.save();

    res.json({
      success: true,
      message: `Banner is now ${banner.status}`,
      data: { banner }
    });
  } catch (error) {
    console.error('Toggle banner status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating the banner'
    });
  }
});

// @route   PUT /api/banners/reorder
// @desc    Save a new slide order (admin only)
// @access  Private/Admin
router.put('/reorder/all', protect, restrictToAdmin, async (req, res) => {
  try {
    const { order } = req.body;

    if (!Array.isArray(order)) {
      return res.status(400).json({
        success: false,
        message: 'Expected an array of banner ids in the wanted order'
      });
    }

    await Promise.all(
      order.map((id, index) => Banner.findByIdAndUpdate(id, { order: index }))
    );

    const banners = await Banner.find().sort({ order: 1, createdAt: 1 });

    res.json({
      success: true,
      message: 'Banner order saved',
      data: { banners }
    });
  } catch (error) {
    console.error('Reorder banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while reordering banners'
    });
  }
});

// @route   DELETE /api/banners/:id
// @desc    Delete a slide and its Cloudinary image (admin only)
// @access  Private/Admin
router.delete('/:id', protect, restrictToAdmin, async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    await destroyImage(banner.publicId);
    await Banner.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Banner deleted successfully'
    });
  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting the banner'
    });
  }
});

module.exports = router;
