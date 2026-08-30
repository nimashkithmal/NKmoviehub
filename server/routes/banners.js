const express = require('express');
const { body, validationResult } = require('express-validator');
const Banner = require('../models/Banner');
const Movie = require('../models/Movie');
const TVShow = require('../models/TVShow');
const { protect, restrictToAdmin } = require('../middleware/auth');
const { cloudinary, uploadImage } = require('../utils/cloudinaryUpload');

const { isPubliclyAccessible } = require('../utils/contentPolicy');

const router = express.Router();

const DETAIL_FIELDS = 'title year description genre imdbRating averageRating imageUrl images';

const destroyImage = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Cloudinary delete error:', error);
  }
};

const populateBanner = (query) =>
  query
    .populate('movie', DETAIL_FIELDS)
    .populate('tvShow', DETAIL_FIELDS);

// @route   GET /api/banners
router.get('/', async (req, res) => {
  try {
    const banners = (await populateBanner(
      Banner.find({ status: 'active' }).sort({ order: 1, createdAt: 1 })
    )
      .select('imageUrl title order movie tvShow')
      .lean()).filter(
      (banner) =>
        (!banner.movie || isPubliclyAccessible(banner.movie)) &&
        (!banner.tvShow || isPubliclyAccessible(banner.tvShow))
    );

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
router.get('/admin', protect, restrictToAdmin, async (req, res) => {
  try {
    const banners = await populateBanner(
      Banner.find()
        .populate('addedBy', 'name email')
        .sort({ order: 1, createdAt: 1 })
    );

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

const resolveLink = async ({ movieId, tvShowId }) => {
  if (movieId) {
    const movie = await Movie.findById(movieId).select('_id title');
    if (!movie) return { error: 'Selected movie was not found' };
    return { movie: movie._id, tvShow: null, title: movie.title };
  }
  if (tvShowId) {
    const tvShow = await TVShow.findById(tvShowId).select('_id title');
    if (!tvShow) return { error: 'Selected TV show was not found' };
    return { movie: null, tvShow: tvShow._id, title: tvShow.title };
  }
  return { error: 'Please select a movie or a TV show' };
};

// @route   POST /api/banners
router.post('/', protect, restrictToAdmin, [
  body('image')
    .notEmpty()
    .withMessage('An image file or image URL is required'),
  body('movieId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid movie id'),
  body('tvShowId')
    .optional({ checkFalsy: true })
    .isMongoId()
    .withMessage('Invalid TV show id'),
  body('title')
    .optional({ checkFalsy: true })
    .isLength({ max: 100 })
    .withMessage('Title cannot exceed 100 characters')
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

    const { image, movieId, tvShowId, title = '', status = 'active' } = req.body;

    if (!movieId && !tvShowId) {
      return res.status(400).json({
        success: false,
        message: 'Please select a movie or a TV show'
      });
    }
    if (movieId && tvShowId) {
      return res.status(400).json({
        success: false,
        message: 'Select either a movie or a TV show, not both'
      });
    }

    const link = await resolveLink({ movieId, tvShowId });
    if (link.error) {
      return res.status(400).json({ success: false, message: link.error });
    }

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

    const order = req.body.order !== undefined
      ? parseInt(req.body.order, 10)
      : await Banner.countDocuments();

    const banner = await Banner.create({
      imageUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
      movie: link.movie,
      tvShow: link.tvShow,
      title: title || link.title,
      order,
      status: status === 'inactive' ? 'inactive' : 'active',
      addedBy: req.user._id
    });

    await populateBanner(Banner.findById(banner._id)).then((doc) => doc);

    const populated = await populateBanner(Banner.findById(banner._id));

    res.status(201).json({
      success: true,
      message: 'Banner added successfully',
      data: { banner: populated }
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
router.put('/:id', protect, restrictToAdmin, async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    const { image, title, order, status, movieId, tvShowId } = req.body;

    const cleanMovieId = movieId && String(movieId).trim() ? String(movieId).trim() : null;
    const cleanTvShowId = tvShowId && String(tvShowId).trim() ? String(tvShowId).trim() : null;

    if (cleanMovieId || cleanTvShowId) {
      if (cleanMovieId && cleanTvShowId) {
        return res.status(400).json({
          success: false,
          message: 'Select either a movie or a TV show, not both'
        });
      }

      const link = await resolveLink({
        movieId: cleanMovieId || undefined,
        tvShowId: cleanTvShowId || undefined
      });
      if (link.error) {
        return res.status(400).json({ success: false, message: link.error });
      }

      // Explicitly clear the other link so old "movie required" docs migrate cleanly
      banner.movie = link.movie || null;
      banner.tvShow = link.tvShow || null;
      if (title === undefined || title === null || title === '') {
        banner.title = link.title;
      }
    }

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

    if (title !== undefined && title !== null && title !== '') banner.title = title;
    if (order !== undefined) banner.order = parseInt(order, 10);
    if (status === 'active' || status === 'inactive') banner.status = status;

    await banner.save();
    const populated = await populateBanner(Banner.findById(banner._id));

    res.json({
      success: true,
      message: 'Banner updated successfully',
      data: { banner: populated }
    });
  } catch (error) {
    console.error('Update banner error:', error);
    const message = error?.name === 'ValidationError'
      ? Object.values(error.errors).map((e) => e.message).join(', ')
      : 'Server error while updating the banner';
    res.status(error?.name === 'ValidationError' ? 400 : 500).json({
      success: false,
      message
    });
  }
});

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

    const banners = await populateBanner(
      Banner.find().sort({ order: 1, createdAt: 1 })
    );

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
