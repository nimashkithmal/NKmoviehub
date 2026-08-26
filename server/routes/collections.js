const express = require('express');
const { body, validationResult } = require('express-validator');
const Collection = require('../models/Collection');
const Movie = require('../models/Movie');
const { protect, restrictToAdmin } = require('../middleware/auth');

const router = express.Router();

const MOVIE_FIELDS = 'title year status';

const populateMovies = (query) =>
  query.populate({
    path: 'movies',
    select: MOVIE_FIELDS,
    match: { status: 'active' }
  });

// @route   GET /api/collections
// @desc    Public active collections with movie name lists
router.get('/', async (req, res) => {
  try {
    const collections = await populateMovies(
      Collection.find({ status: 'active' }).sort({ order: 1, createdAt: 1 })
    ).select('name description order movies');

    res.json({
      success: true,
      data: { collections }
    });
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching collections'
    });
  }
});

// @route   GET /api/collections/admin
router.get('/admin', protect, restrictToAdmin, async (req, res) => {
  try {
    const collections = await Collection.find()
      .populate('movies', 'title year status')
      .populate('addedBy', 'name email')
      .sort({ order: 1, createdAt: 1 });

    res.json({
      success: true,
      data: { collections }
    });
  } catch (error) {
    console.error('Get admin collections error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching collections'
    });
  }
});

// @route   GET /api/collections/:id
router.get('/:id', async (req, res) => {
  try {
    const collection = await populateMovies(
      Collection.findOne({ _id: req.params.id, status: 'active' })
    ).select('name description order movies');

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    res.json({
      success: true,
      data: { collection }
    });
  } catch (error) {
    console.error('Get collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching collection'
    });
  }
});

const sanitizeMovieIds = async (movieIds = []) => {
  const ids = [...new Set((movieIds || []).filter(Boolean).map(String))];
  if (!ids.length) return [];
  const found = await Movie.find({ _id: { $in: ids } }).select('_id');
  const foundSet = new Set(found.map((m) => String(m._id)));
  return ids.filter((id) => foundSet.has(id));
};

// @route   POST /api/collections
router.post('/', protect, restrictToAdmin, [
  body('name').trim().notEmpty().withMessage('Collection name is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),
  body('description').optional({ checkFalsy: true }).isLength({ max: 500 }),
  body('order').optional().isInt({ min: 0 }),
  body('status').optional().isIn(['active', 'inactive']),
  body('movieIds').optional().isArray()
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

    const {
      name,
      description = '',
      order = 0,
      status = 'active',
      movieIds = []
    } = req.body;

    const movies = await sanitizeMovieIds(movieIds);

    const collection = await Collection.create({
      name: name.trim(),
      description: (description || '').trim(),
      order: Number(order) || 0,
      status,
      movies,
      addedBy: req.user._id
    });

    await collection.populate('movies', 'title year status');

    res.status(201).json({
      success: true,
      message: 'Collection created',
      data: { collection }
    });
  } catch (error) {
    console.error('Create collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating collection'
    });
  }
});

// @route   PUT /api/collections/:id
router.put('/:id', protect, restrictToAdmin, [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('description').optional({ checkFalsy: true }).isLength({ max: 500 }),
  body('order').optional().isInt({ min: 0 }),
  body('status').optional().isIn(['active', 'inactive']),
  body('movieIds').optional().isArray()
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

    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    const { name, description, order, status, movieIds } = req.body;

    if (name !== undefined) collection.name = name.trim();
    if (description !== undefined) collection.description = String(description).trim();
    if (order !== undefined) collection.order = Number(order) || 0;
    if (status !== undefined) collection.status = status;
    if (movieIds !== undefined) {
      collection.movies = await sanitizeMovieIds(movieIds);
    }

    await collection.save();
    await collection.populate('movies', 'title year status');

    res.json({
      success: true,
      message: 'Collection updated',
      data: { collection }
    });
  } catch (error) {
    console.error('Update collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating collection'
    });
  }
});

// @route   DELETE /api/collections/:id
router.delete('/:id', protect, restrictToAdmin, async (req, res) => {
  try {
    const collection = await Collection.findById(req.params.id);
    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    await collection.deleteOne();

    res.json({
      success: true,
      message: 'Collection deleted'
    });
  } catch (error) {
    console.error('Delete collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting collection'
    });
  }
});

module.exports = router;
