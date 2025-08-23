const express = require('express');
const { body, validationResult } = require('express-validator');
const Movie = require('../models/Movie');
const Rating = require('../models/Rating');
const { protect, restrictToAdmin } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;

const router = express.Router();

// Configure Cloudinary
// Fallback environment variables if dotenv fails
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dmjhodvge';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '869289811975563';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '0N4n4B6JfqHrY_Pev2vEbn8P80U';

console.log('Cloudinary config:', {
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: '***' + CLOUDINARY_API_KEY.slice(-4),
  api_secret: '***' + CLOUDINARY_API_SECRET.slice(-4)
});

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
});

// @route   GET /api/movies
// @desc    Get all movies (public)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 12, search = '', genre = '', year = '', status = 'active' } = req.query;
    
    // Build filter object
    const filter = { status: 'active' };
    
    if (search) {
      filter.$text = { $search: search };
    }
    
    if (genre) {
      filter.genre = { $regex: genre, $options: 'i' };
    }
    
    if (year) {
      filter.year = parseInt(year);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get movies with pagination
    const movies = await Movie.find(filter)
      .populate('addedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Movie.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        movies,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalMovies: total,
          moviesPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get movies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching movies'
    });
  }
});

// @route   GET /api/movies/admin
// @desc    Get all movies for admin (including inactive)
// @access  Private/Admin
router.get('/admin', protect, restrictToAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', genre = '', status = '' } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$text = { $search: search };
    }
    
    if (genre) {
      filter.genre = { $regex: genre, $options: 'i' };
    }
    
    if (status) {
      filter.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get movies with pagination
    const movies = await Movie.find(filter)
      .populate('addedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await Movie.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        movies,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalMovies: total,
          moviesPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get admin movies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching movies'
    });
  }
});

// @route   GET /api/movies/stats
// @desc    Get movie statistics (admin only)
// @access  Private/Admin
router.get('/stats', protect, restrictToAdmin, async (req, res) => {
  try {
    const stats = await Movie.getStats();
    
    // Get additional stats
    const newMoviesThisMonth = await Movie.countDocuments({
      createdAt: {
        $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      }
    });
    
    const inactiveMovies = await Movie.countDocuments({ status: 'inactive' });
    
    res.json({
      success: true,
      data: {
        ...stats,
        newMoviesThisMonth,
        inactiveMovies
      }
    });
  } catch (error) {
    console.error('Get movie stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching statistics'
    });
  }
});

// @route   GET /api/movies/:id
// @desc    Get movie by ID (public)
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id)
      .populate('addedBy', 'name email');
    
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }
    
    res.json({
      success: true,
      data: { movie }
    });
  } catch (error) {
    console.error('Get movie error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching movie'
    });
  }
});

// @route   POST /api/movies
// @desc    Create a new movie (admin only)
// @access  Private/Admin
router.post('/', protect, restrictToAdmin, [
  body('title').trim().isLength({ min: 2, max: 100 }).withMessage('Title must be between 2 and 100 characters'),
  body('year').isInt({ min: 1900, max: new Date().getFullYear() + 5 }).withMessage('Please provide a valid year'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  body('genre').trim().isLength({ min: 2, max: 50 }).withMessage('Genre must be between 2 and 50 characters'),
  body('movieUrl').isURL().withMessage('Please provide a valid movie URL'),
  body('downloadUrl').isURL().withMessage('Please provide a valid download URL'),
  body('imdbRating').isFloat({ min: 0, max: 10 }).withMessage('IMDB rating must be between 0 and 10'),
  body('imageFile').notEmpty().withMessage('Movie image is required')
], async (req, res) => {
  try {
    console.log('Received movie creation request:', {
      title: req.body.title,
      year: req.body.year,
      genre: req.body.genre,
      hasImageFile: !!req.body.imageFile,
      imageFileLength: req.body.imageFile ? req.body.imageFile.length : 0,
      hasDownloadUrl: !!req.body.downloadUrl,
      hasImdbRating: req.body.imdbRating !== undefined,
      fullBody: JSON.stringify(req.body, null, 2)
    });

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.array());
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, year, description, genre, movieUrl, downloadUrl, imdbRating, imageFile } = req.body;

    // Additional validation for edge cases
    if (title && title.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Title cannot be empty'
      });
    }
    
    if (description && description.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Description cannot be empty'
      });
    }
    
    if (genre && genre.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Genre cannot be empty'
      });
    }
    
    if (movieUrl && movieUrl.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Movie URL cannot be empty'
      });
    }
    
    if (downloadUrl && downloadUrl.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Download URL cannot be empty'
      });
    }

    // Validate required fields
    if (!title || !year || !description || !genre || !movieUrl || !downloadUrl || imdbRating === undefined || !imageFile) {
      console.log('Missing required fields:', { 
        title: title || 'MISSING', 
        year: year || 'MISSING', 
        description: description || 'MISSING', 
        genre: genre || 'MISSING', 
        movieUrl: movieUrl || 'MISSING', 
        downloadUrl: downloadUrl || 'MISSING', 
        imdbRating: imdbRating !== undefined ? imdbRating : 'MISSING', 
        hasImageFile: !!imageFile 
      });
      
      const missingFields = [];
      if (!title) missingFields.push('title');
      if (!year) missingFields.push('year');
      if (!description) missingFields.push('description');
      if (!genre) missingFields.push('genre');
      if (!movieUrl) missingFields.push('movieUrl');
      if (!downloadUrl) missingFields.push('downloadUrl');
      if (imdbRating === undefined) missingFields.push('imdbRating');
      if (!imageFile) missingFields.push('imageFile');
      
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Upload image to Cloudinary
    let imageUrl;
    try {
      console.log('Starting Cloudinary upload...');
      console.log('Image file type:', typeof imageFile);
      console.log('Image file starts with data:image:', imageFile ? imageFile.startsWith('data:image/') : 'N/A');
      
      // Handle base64 image data
      let uploadData = imageFile;
      
      // If it's a base64 string, use it directly
      if (typeof imageFile === 'string' && imageFile.startsWith('data:image/')) {
        uploadData = imageFile;
        console.log('Using base64 image data for upload');
      } else {
        console.log('Image data format not recognized');
        return res.status(400).json({
          success: false,
          message: 'Invalid image format. Please provide a valid image file.'
        });
      }
      
      console.log('Uploading to Cloudinary...');
      const uploadResult = await cloudinary.uploader.upload(uploadData, {
        folder: 'nkmoviehub',
        transformation: [
          { width: 500, height: 750, crop: 'fill' },
          { quality: 'auto' }
        ]
      });
      console.log('Cloudinary upload successful:', uploadResult.secure_url);
      imageUrl = uploadResult.secure_url;
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      console.error('Error details:', {
        message: uploadError.message,
        code: uploadError.code,
        statusCode: uploadError.http_code
      });
      return res.status(500).json({
        success: false,
        message: 'Failed to upload image: ' + uploadError.message
      });
    }

    // Create new movie
    const movie = new Movie({
      title,
      year: parseInt(year),
      description,
      genre,
      movieUrl,
      downloadUrl,
      imdbRating: parseFloat(imdbRating),
      imageUrl,
      addedBy: req.user.id
    });

    console.log('Saving movie to database:', {
      title: movie.title,
      year: movie.year,
      genre: movie.genre,
      hasImageUrl: !!movie.imageUrl,
      hasDownloadUrl: !!movie.downloadUrl,
      imdbRating: movie.imdbRating
    });

    await movie.save();

    // Populate addedBy field
    await movie.populate('addedBy', 'name email');

    console.log('Movie created successfully:', movie._id);

    res.status(201).json({
      success: true,
      message: 'Movie created successfully',
      data: { movie }
    });

  } catch (error) {
    console.error('Create movie error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Server error while creating movie: ' + error.message
    });
  }
});

// @route   PUT /api/movies/:id
// @desc    Update movie (admin only)
// @access  Private/Admin
router.put('/:id', protect, restrictToAdmin, [
  body('title').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Title must be between 2 and 100 characters'),
  body('year').optional().isInt({ min: 1900, max: new Date().getFullYear() + 5 }).withMessage('Please provide a valid year'),
  body('description').optional().trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  body('genre').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Genre must be between 2 and 50 characters'),
  body('movieUrl').optional().isURL().withMessage('Please provide a valid movie URL')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, year, description, genre, movieUrl, imageFile } = req.body;
    const updateData = {};

    if (title) updateData.title = title;
    if (year) updateData.year = parseInt(year);
    if (description) updateData.description = description;
    if (genre) updateData.genre = genre;
    if (movieUrl) updateData.movieUrl = movieUrl;

    // Handle image update if provided
    if (imageFile) {
      try {
        // Handle base64 image data
        let uploadData = imageFile;
        
        // If it's a base64 string, use it directly
        if (typeof imageFile === 'string' && imageFile.startsWith('data:image/')) {
          uploadData = imageFile;
        }
        
        const uploadResult = await cloudinary.uploader.upload(uploadData, {
          folder: 'nkmoviehub',
          transformation: [
            { width: 500, height: 750, crop: 'fill' },
            { quality: 'auto' }
          ]
        });
        updateData.imageUrl = uploadResult.secure_url;
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload new image'
        });
      }
    }

    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('addedBy', 'name email');

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    res.json({
      success: true,
      message: 'Movie updated successfully',
      data: { movie }
    });

  } catch (error) {
    console.error('Update movie error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating movie'
    });
  }
});

// @route   PUT /api/movies/:id/update-admin-fields
// @desc    Update IMDB rating and download URL (admin only)
// @access  Private/Admin
router.put('/:id/update-admin-fields', protect, restrictToAdmin, [
  body('imdbRating').optional().isFloat({ min: 0, max: 10 }).withMessage('IMDB rating must be between 0 and 10'),
  body('downloadUrl').optional().isURL().withMessage('Please provide a valid download URL')
], async (req, res) => {
  try {
    const { imdbRating, downloadUrl } = req.body;
    const movieId = req.params.id;

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    // Find the movie
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    // Update only the fields that are provided
    if (imdbRating !== undefined) {
      movie.imdbRating = parseFloat(imdbRating);
    }
    
    if (downloadUrl !== undefined) {
      movie.downloadUrl = downloadUrl;
    }

    await movie.save();

    // Populate addedBy field
    await movie.populate('addedBy', 'name email');

    res.json({
      success: true,
      message: 'Movie updated successfully',
      data: { movie }
    });

  } catch (error) {
    console.error('Update admin fields error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating movie: ' + error.message
    });
  }
});

// @route   DELETE /api/movies/:id
// @desc    Delete movie (admin only)
// @access  Private/Admin
router.delete('/:id', protect, restrictToAdmin, async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    // Delete image from Cloudinary if it exists
    if (movie.imageUrl) {
      try {
        const publicId = movie.imageUrl.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`nkmoviehub/${publicId}`);
      } catch (deleteError) {
        console.error('Cloudinary delete error:', deleteError);
        // Continue with movie deletion even if image deletion fails
      }
    }

    await Movie.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Movie deleted successfully'
    });

  } catch (error) {
    console.error('Delete movie error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting movie'
    });
  }
});

// @route   PATCH /api/movies/:id/status
// @desc    Toggle movie status (admin only)
// @access  Private/Admin
router.patch('/:id/status', protect, restrictToAdmin, async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    const newStatus = movie.status === 'active' ? 'inactive' : 'active';
    movie.status = newStatus;
    await movie.save();

    await movie.populate('addedBy', 'name email');

    res.json({
      success: true,
      message: `Movie status updated to ${newStatus}`,
      data: { movie }
    });

  } catch (error) {
    console.error('Toggle movie status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating movie status'
    });
  }
});

// ==================== RATING ROUTES ====================

// @route   POST /api/movies/:id/rate
// @desc    Rate a movie (authenticated users)
// @access  Private
router.post('/:id/rate', protect, [
  body('rating').isInt({ min: 1, max: 10 }).withMessage('Rating must be between 1 and 10'),
  body('review').optional().isLength({ max: 500 }).withMessage('Review cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors.array()
      });
    }

    const { rating, review } = req.body;
    const movieId = req.params.id;
    const userId = req.user.id;

    // Check if movie exists
    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    // Check if movie is active
    if (movie.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Cannot rate inactive movies'
      });
    }

    // Create or update rating
    const existingRating = await Rating.findOne({ user: userId, movie: movieId });
    
    if (existingRating) {
      // Update existing rating
      existingRating.rating = rating;
      existingRating.review = review || '';
      await existingRating.save();
    } else {
      // Create new rating
      await Rating.create({
        user: userId,
        movie: movieId,
        rating,
        review: review || ''
      });
    }

    // Update movie's average rating
    await movie.updateAverageRating();

    // Get updated movie with populated data
    await movie.populate('addedBy', 'name email');

    res.json({
      success: true,
      message: existingRating ? 'Rating updated successfully' : 'Rating added successfully',
      data: { 
        movie,
        userRating: rating
      }
    });

  } catch (error) {
    console.error('Rate movie error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while rating movie'
    });
  }
});

// @route   GET /api/movies/:id/rating
// @desc    Get user's rating for a specific movie
// @access  Private
router.get('/:id/rating', protect, async (req, res) => {
  try {
    const movieId = req.params.id;
    const userId = req.user.id;

    const rating = await Rating.findOne({ user: userId, movie: movieId });
    
    res.json({
      success: true,
      data: {
        rating: rating ? rating.rating : null,
        review: rating ? rating.review : '',
        hasRated: !!rating
      }
    });

  } catch (error) {
    console.error('Get user rating error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user rating'
    });
  }
});

// @route   GET /api/movies/:id/ratings
// @desc    Get all ratings for a specific movie (public)
// @access  Public
router.get('/:id/ratings', async (req, res) => {
  try {
    const movieId = req.params.id;
    
    const ratings = await Rating.find({ movie: movieId })
      .populate('user', 'name')
      .sort({ createdAt: -1 })
      .limit(20);

    const movie = await Movie.findById(movieId);
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    res.json({
      success: true,
      data: {
        ratings,
        movieStats: {
          averageRating: movie.averageRating,
          totalRatings: movie.totalRatings
        }
      }
    });

  } catch (error) {
    console.error('Get movie ratings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching movie ratings'
    });
  }
});

module.exports = router; 