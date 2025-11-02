const express = require('express');
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');
const TVShow = require('../models/TVShow');
const { protect, restrictToAdmin } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;

const router = express.Router();

// Configure Cloudinary
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dmjhodvge';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '869289811975563';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '0N4n4B6JfqHrY_Pev2vEbn8P80U';

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
});

// @route   GET /api/tvshows
// @desc    Get all TV shows (public)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 1000, search = '', genre = '', year = '', status = 'active' } = req.query;
    
    // Build filter object
    const filter = { status: 'active' };
    
    if (search && search.trim()) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { genre: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (genre) {
      filter.genre = { $regex: genre, $options: 'i' };
    }
    
    if (year) {
      filter.year = parseInt(year);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get TV shows with pagination
    const tvShows = await TVShow.find(filter)
      .populate('addedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await TVShow.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        tvShows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalTVShows: total,
          tvShowsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get TV shows error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching TV shows'
    });
  }
});

// @route   GET /api/tvshows/admin
// @desc    Get all TV shows for admin (including inactive)
// @access  Private/Admin
router.get('/admin', protect, restrictToAdmin, async (req, res) => {
  console.log('✅ TV Shows Admin route hit');
  try {
    const { page = 1, limit = 1000, search = '', genre = '', status = '' } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { genre: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (genre) {
      filter.genre = { $regex: genre, $options: 'i' };
    }
    
    if (status) {
      filter.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get TV shows with pagination
    const tvShows = await TVShow.find(filter)
      .populate('addedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const total = await TVShow.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        tvShows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalTVShows: total,
          tvShowsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get admin TV shows error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching TV shows'
    });
  }
});

// @route   GET /api/tvshows/filters
// @desc    Get unique genres and years for filtering
// @access  Public
router.get('/filters', async (req, res) => {
  try {
    // Get unique genres
    const genres = await TVShow.distinct('genre', { status: 'active' });
    
    // Get unique years, sorted descending
    const years = await TVShow.distinct('year', { status: 'active' });
    const sortedYears = years.sort((a, b) => b - a);
    
    res.json({
      success: true,
      data: {
        genres: genres.sort(),
        years: sortedYears
      }
    });
  } catch (error) {
    console.error('Get filters error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching filters'
    });
  }
});

// @route   GET /api/tvshows/:id
// @desc    Get TV show by ID (public)
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    // Prevent special routes from being matched as IDs
    const specialRoutes = ['admin', 'filters'];
    if (specialRoutes.includes(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Route not found'
      });
    }
    
    // Check if id is a valid MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'TV Show not found'
      });
    }
    
    const tvShow = await TVShow.findById(req.params.id)
      .populate('addedBy', 'name email');
    
    if (!tvShow) {
      return res.status(404).json({
        success: false,
        message: 'TV Show not found'
      });
    }
    
    res.json({
      success: true,
      data: { tvShow }
    });
  } catch (error) {
    console.error('Get TV show error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching TV show'
    });
  }
});

// @route   POST /api/tvshows
// @desc    Create a new TV show (admin only)
// @access  Private/Admin
router.post('/', protect, restrictToAdmin, [
  body('title').trim().isLength({ min: 2, max: 100 }).withMessage('Title must be between 2 and 100 characters'),
  body('year').isInt({ min: 1900, max: new Date().getFullYear() + 5 }).withMessage('Please provide a valid year'),
  body('description').trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  body('genre').trim().isLength({ min: 2, max: 50 }).withMessage('Genre must be between 2 and 50 characters'),
  body('showUrl').optional({ checkFalsy: true }).isURL().withMessage('Please provide a valid TV show URL'),
  body('episodeCount').optional().isInt({ min: 0 }).withMessage('Episode count must be a non-negative integer'),
  body('numberOfSeasons').optional().isInt({ min: 1 }).withMessage('Number of seasons must be at least 1'),
  body('imdbRating').isFloat({ min: 0, max: 10 }).withMessage('IMDB rating must be between 0 and 10'),
  body('imageFile').notEmpty().withMessage('TV Show image is required')
], async (req, res) => {
  try {
    console.log('Received TV show creation request:', {
      title: req.body.title,
      year: req.body.year,
      genre: req.body.genre,
      hasShowUrl: !!req.body.showUrl,
      hasEpisodes: !!req.body.episodes,
      episodeCount: req.body.episodeCount,
      hasImageFile: !!req.body.imageFile,
      hasImdbRating: req.body.imdbRating !== undefined
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

    const { title, year, description, genre, showUrl, imdbRating, imageFile, episodeCount, numberOfSeasons, episodes } = req.body;

    // Validate required fields (showUrl is now optional if episodes are provided)
    if (!title || !year || !description || !genre || imdbRating === undefined || !imageFile) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: title, year, description, genre, imdbRating, and imageFile are required'
      });
    }

    // Validate that either showUrl or episodes are provided
    const hasEpisodes = episodes && Array.isArray(episodes) && episodes.length > 0;
    const hasShowUrl = showUrl && showUrl.trim() !== '';
    if (!hasEpisodes && !hasShowUrl) {
      return res.status(400).json({
        success: false,
        message: 'Either showUrl or episodes must be provided'
      });
    }

    // Upload image to Cloudinary
    let imageUrl;
    try {
      let uploadData = imageFile;
      
      if (typeof imageFile === 'string' && imageFile.startsWith('data:image/')) {
        uploadData = imageFile;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid image format. Please provide a valid image file.'
        });
      }
      
      const uploadResult = await cloudinary.uploader.upload(uploadData, {
        folder: 'nkmoviehub/tvshows',
        transformation: [
          { width: 500, height: 750, crop: 'fill' },
          { quality: 'auto' }
        ]
      });
      imageUrl = uploadResult.secure_url;
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload image: ' + uploadError.message
      });
    }

    // Process episodes if provided
    let processedEpisodes = [];
    console.log('📺 Raw episodes received:', JSON.stringify(episodes, null, 2));
    console.log('📺 Episodes type:', typeof episodes, 'Is Array?', Array.isArray(episodes));
    
    if (episodes !== undefined && episodes !== null) {
      if (Array.isArray(episodes)) {
        console.log('✅ Episodes is an array with length:', episodes.length);
        
        // Filter and process episodes
        const validEpisodes = episodes.filter(ep => {
          const isValid = ep && ep.episodeUrl && typeof ep.episodeUrl === 'string' && ep.episodeUrl.trim() !== '';
          if (!isValid) {
            console.log('❌ Invalid episode filtered out:', ep);
          }
          return isValid;
        });
        console.log('✅ Valid episodes after filter:', validEpisodes.length);
        
        if (validEpisodes.length > 0) {
          processedEpisodes = validEpisodes.map((ep, index) => {
            // Ensure episodeNumber is a valid number, defaulting to index + 1 if missing or invalid
            const epNum = (ep.episodeNumber && !isNaN(parseInt(ep.episodeNumber)) && parseInt(ep.episodeNumber) > 0) 
              ? parseInt(ep.episodeNumber) 
              : (index + 1);
            
            const processed = {
              episodeNumber: epNum,
              episodeUrl: ep.episodeUrl.trim(),
              episodeTitle: (ep.episodeTitle && typeof ep.episodeTitle === 'string' && ep.episodeTitle.trim()) 
                ? ep.episodeTitle.trim() 
                : `Episode ${epNum}`
            };
            
            console.log(`✅ Processed episode ${index + 1}:`, JSON.stringify(processed, null, 2));
            return processed;
          });
          
          // Sort by episode number
          processedEpisodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
          
          console.log('✅ Final processed episodes array:', JSON.stringify(processedEpisodes, null, 2));
          console.log('✅ Processed episodes count:', processedEpisodes.length);
        } else {
          console.log('⚠️ No valid episodes found after filtering');
        }
      } else {
        console.log('⚠️ Episodes is not an array:', typeof episodes, episodes);
      }
    } else {
      console.log('⚠️ Episodes is undefined or null');
    }

    // Create new TV show
    const tvShowData = {
      title,
      year: parseInt(year),
      description,
      genre,
      showUrl: showUrl || (processedEpisodes.length > 0 ? processedEpisodes[0].episodeUrl : ''),
      episodeCount: processedEpisodes.length > 0 ? processedEpisodes.length : (parseInt(episodeCount) || 0),
      numberOfSeasons: numberOfSeasons ? parseInt(numberOfSeasons) : 1,
      episodes: processedEpisodes, // Always set episodes array (even if empty)
      imdbRating: parseFloat(imdbRating),
      imageUrl,
      addedBy: req.user.id
    };
    
    console.log('📺 Creating TV Show with data:');
    console.log('  - Title:', tvShowData.title);
    console.log('  - Episode Count:', tvShowData.episodeCount);
    console.log('  - Episodes Array Length:', tvShowData.episodes.length);
    console.log('  - Episodes Array:', JSON.stringify(tvShowData.episodes, null, 2));
    console.log('  - Show URL:', tvShowData.showUrl);

    // Explicitly validate episodes structure before creating
    if (processedEpisodes.length > 0) {
      console.log('🔍 Validating episodes before save:');
      processedEpisodes.forEach((ep, idx) => {
        console.log(`  Episode ${idx + 1}:`, {
          episodeNumber: ep.episodeNumber,
          episodeUrl: ep.episodeUrl ? `${ep.episodeUrl.substring(0, 50)}...` : 'MISSING',
          episodeTitle: ep.episodeTitle
        });
        
        if (!ep.episodeNumber || ep.episodeNumber < 1) {
          console.error(`❌ Invalid episodeNumber for episode ${idx + 1}:`, ep.episodeNumber);
        }
        if (!ep.episodeUrl || ep.episodeUrl.trim() === '') {
          console.error(`❌ Invalid episodeUrl for episode ${idx + 1}`);
        }
      });
    }
    
    const tvShow = new TVShow(tvShowData);
    
    // Validate before saving
    try {
      await tvShow.validate();
      console.log('✅ TV Show validation passed');
    } catch (validationError) {
      console.error('❌ TV Show validation failed:', validationError);
      return res.status(400).json({
        success: false,
        message: 'Validation error: ' + validationError.message,
        errors: validationError.errors
      });
    }

    await tvShow.save();
    console.log('✅ TV Show saved. Episodes in saved document:', JSON.stringify(tvShow.episodes, null, 2));
    console.log('✅ TV Show episodeCount:', tvShow.episodeCount);
    console.log('✅ TV Show ID:', tvShow._id);
    
    // Reload from database to ensure we have the latest data
    const savedTVShow = await TVShow.findById(tvShow._id);
    if (!savedTVShow) {
      console.error('❌ Failed to reload TV Show from database');
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve saved TV show'
      });
    }
    
    console.log('✅ Reloaded TV Show. Episodes in reloaded document:', JSON.stringify(savedTVShow.episodes, null, 2));
    console.log('✅ Reloaded TV Show episodeCount:', savedTVShow.episodeCount);
    console.log('✅ Reloaded TV Show episodes array type:', Array.isArray(savedTVShow.episodes));
    console.log('✅ Reloaded TV Show episodes length:', savedTVShow.episodes ? savedTVShow.episodes.length : 'null');
    
    await savedTVShow.populate('addedBy', 'name email');

    res.status(201).json({
      success: true,
      message: 'TV Show created successfully',
      data: { tvShow: savedTVShow }
    });

  } catch (error) {
    console.error('Create TV show error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating TV show: ' + error.message
    });
  }
});

// @route   PUT /api/tvshows/:id
// @desc    Update TV show (admin only)
// @access  Private/Admin
router.put('/:id', protect, restrictToAdmin, [
  body('title').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Title must be between 2 and 100 characters'),
  body('year').optional().isInt({ min: 1900, max: new Date().getFullYear() + 5 }).withMessage('Please provide a valid year'),
  body('description').optional().trim().isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
  body('genre').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Genre must be between 2 and 50 characters'),
  body('showUrl').optional().isURL().withMessage('Please provide a valid TV show URL'),
  body('episodeCount').optional().isInt({ min: 0 }).withMessage('Episode count must be a non-negative integer'),
  body('numberOfSeasons').optional().isInt({ min: 1 }).withMessage('Number of seasons must be at least 1'),
  body('imdbRating').optional().isFloat({ min: 0, max: 10 }).withMessage('IMDB rating must be between 0 and 10')
], async (req, res) => {
  try {
    // Check if id is a valid MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'TV Show not found'
      });
    }

    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { title, year, description, genre, showUrl, imdbRating, imageFile, episodeCount, numberOfSeasons, episodes } = req.body;
    const updateData = {};

    if (title !== undefined && title !== null && title !== '') updateData.title = title;
    if (year !== undefined && year !== null && year !== '') updateData.year = parseInt(year);
    if (description !== undefined && description !== null && description !== '') updateData.description = description;
    if (genre !== undefined && genre !== null && genre !== '') updateData.genre = genre;
    if (showUrl !== undefined && showUrl !== null && showUrl !== '') updateData.showUrl = showUrl;
    if (imdbRating !== undefined && imdbRating !== null && imdbRating !== '') updateData.imdbRating = parseFloat(imdbRating);
    if (numberOfSeasons !== undefined && numberOfSeasons !== null && numberOfSeasons !== '') updateData.numberOfSeasons = parseInt(numberOfSeasons);
    
    // Handle episodes if provided
    if (episodes && Array.isArray(episodes)) {
      const processedEpisodes = episodes
        .filter(ep => ep && ep.episodeUrl && ep.episodeUrl.trim() !== '')
        .map((ep, index) => ({
          episodeNumber: ep.episodeNumber || (index + 1),
          episodeUrl: ep.episodeUrl.trim(),
          episodeTitle: ep.episodeTitle || `Episode ${ep.episodeNumber || (index + 1)}`
        }))
        .sort((a, b) => a.episodeNumber - b.episodeNumber);
      
      if (processedEpisodes.length > 0) {
        updateData.episodes = processedEpisodes;
        updateData.episodeCount = processedEpisodes.length;
        // If showUrl is not provided, set it to the first episode URL
        if (!updateData.showUrl) {
          updateData.showUrl = processedEpisodes[0].episodeUrl;
        }
      }
    } else if (episodeCount !== undefined && episodeCount !== null) {
      updateData.episodeCount = parseInt(episodeCount);
    }

    // Handle image update if provided
    if (imageFile) {
      try {
        let uploadData = imageFile;
        
        if (typeof imageFile === 'string' && imageFile.startsWith('data:image/')) {
          uploadData = imageFile;
        }
        
        const uploadResult = await cloudinary.uploader.upload(uploadData, {
          folder: 'nkmoviehub/tvshows',
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

    const tvShow = await TVShow.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('addedBy', 'name email');

    if (!tvShow) {
      return res.status(404).json({
        success: false,
        message: 'TV Show not found'
      });
    }

    res.json({
      success: true,
      message: 'TV Show updated successfully',
      data: { tvShow }
    });

  } catch (error) {
    console.error('Update TV show error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating TV show'
    });
  }
});

// @route   DELETE /api/tvshows/:id
// @desc    Delete TV show (admin only)
// @access  Private/Admin
router.delete('/:id', protect, restrictToAdmin, async (req, res) => {
  try {
    const tvShow = await TVShow.findById(req.params.id);
    
    if (!tvShow) {
      return res.status(404).json({
        success: false,
        message: 'TV Show not found'
      });
    }

    // Delete image from Cloudinary if it exists
    if (tvShow.imageUrl) {
      try {
        const publicId = tvShow.imageUrl.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`nkmoviehub/tvshows/${publicId}`);
      } catch (deleteError) {
        console.error('Cloudinary delete error:', deleteError);
        // Continue with TV show deletion even if image deletion fails
      }
    }

    await TVShow.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'TV Show deleted successfully'
    });

  } catch (error) {
    console.error('Delete TV show error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting TV show'
    });
  }
});

// @route   PATCH /api/tvshows/:id/status
// @desc    Toggle TV show status (admin only)
// @access  Private/Admin
router.patch('/:id/status', protect, restrictToAdmin, async (req, res) => {
  try {
    const tvShow = await TVShow.findById(req.params.id);
    
    if (!tvShow) {
      return res.status(404).json({
        success: false,
        message: 'TV Show not found'
      });
    }

    const newStatus = tvShow.status === 'active' ? 'inactive' : 'active';
    tvShow.status = newStatus;
    await tvShow.save();

    await tvShow.populate('addedBy', 'name email');

    res.json({
      success: true,
      message: `TV Show status updated to ${newStatus}`,
      data: { tvShow }
    });

  } catch (error) {
    console.error('Toggle TV show status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating TV show status'
    });
  }
});

module.exports = router;

