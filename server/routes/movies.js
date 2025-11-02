const express = require('express');
const { body, validationResult } = require('express-validator');
const Movie = require('../models/Movie');
const Rating = require('../models/Rating');
const { protect, restrictToAdmin } = require('../middleware/auth');
const cloudinary = require('cloudinary').v2;
const fetch = require('node-fetch');

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
    const { page = 1, limit = 1000, search = '', genre = '', year = '', status = 'active' } = req.query;
    
    // Build filter object
    const filter = { status: 'active' };
    
    if (search && search.trim()) {
      // Use regex search instead of $text for better compatibility
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
    const { page = 1, limit = 1000, search = '', genre = '', status = '' } = req.query;
    
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

// @route   GET /api/movies/filters
// @desc    Get unique genres and years for filtering
// @access  Public
router.get('/filters', async (req, res) => {
  try {
    // Get unique genres
    const genres = await Movie.distinct('genre', { status: 'active' });
    
    // Get unique years, sorted descending
    const years = await Movie.distinct('year', { status: 'active' });
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

// Helper function to extract Google Drive file ID
const extractGoogleDriveFileId = (url) => {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /id=([a-zA-Z0-9_-]+)/,
    /\/d\/([a-zA-Z0-9_-]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Helper function to convert Google Drive URL to direct download URL
const getGoogleDriveDownloadUrl = (url) => {
  const fileId = extractGoogleDriveFileId(url);
  if (fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }
  return null;
};

// @route   GET /api/movies/:id/download
// @desc    Download a movie file
// @access  Private
router.get('/:id/download', protect, async (req, res) => {
  try {
    console.log('Download request received for movie ID:', req.params.id);
    const movie = await Movie.findById(req.params.id);
    
    if (!movie) {
      console.log('Movie not found:', req.params.id);
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    if (!movie.movieUrl) {
      console.log('Movie URL not available for movie:', movie._id);
      return res.status(400).json({
        success: false,
        message: 'Movie URL not available'
      });
    }

    console.log('Processing download for:', movie.title, 'URL:', movie.movieUrl);

    // For YouTube/Vimeo, return error (can't download directly)
    if (movie.movieUrl.includes('youtube.com') || movie.movieUrl.includes('youtu.be') || movie.movieUrl.includes('vimeo.com')) {
      return res.status(400).json({
        success: false,
        message: 'Direct download is not available for YouTube or Vimeo videos'
      });
    }

    let downloadUrl = movie.movieUrl;
    let filename = `${movie.title.replace(/[^a-z0-9]/gi, '_')}.mp4`;

    // Handle Google Drive URLs - redirect directly (can't stream easily)
    if (movie.movieUrl.includes('drive.google.com')) {
      const fileId = extractGoogleDriveFileId(movie.movieUrl);
      if (fileId) {
        // Use direct download URL for Google Drive
        downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
        console.log('Google Drive download URL:', downloadUrl);
        // Redirect to Google Drive download
        return res.redirect(downloadUrl);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid Google Drive URL. Make sure the file is shared publicly.'
        });
      }
    }

    // For direct file URLs, stream the file
    try {
      console.log('Fetching file from:', downloadUrl);
      const response = await fetch(downloadUrl);
      
      if (!response.ok) {
        console.error('Failed to fetch file:', response.status, response.statusText);
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }

      // Try to get filename from Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition && contentDisposition.includes('filename=')) {
        const matches = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (matches && matches[1]) {
          filename = matches[1].replace(/['"]/g, '').trim();
        }
      } else {
        // Try to determine filename from URL
        const urlParts = downloadUrl.split('/');
        const urlFilename = urlParts[urlParts.length - 1].split('?')[0];
        if (urlFilename && urlFilename.includes('.')) {
          filename = urlFilename;
        }
      }

      console.log('Downloading file as:', filename);

      // Set response headers for download
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      
      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('Content-Type', contentType);
      }
      
      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      // Stream the file to the client
      if (response.body) {
        response.body.pipe(res);
      } else {
        // Fallback: redirect to download URL
        res.redirect(downloadUrl);
      }

    } catch (fetchError) {
      console.error('Download fetch error:', fetchError);
      // If streaming fails, redirect to the URL directly
      res.redirect(downloadUrl);
    }

  } catch (error) {
    console.error('Download movie error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while downloading movie: ' + error.message
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
  body('imdbRating').isFloat({ min: 0, max: 10 }).withMessage('IMDB rating must be between 0 and 10'),
  body('imageFile').optional().notEmpty().withMessage('Movie image is required if imageFiles is not provided'),
  body('imageFiles').optional().isArray({ min: 1 }).withMessage('At least one image is required')
], async (req, res) => {
  try {
    console.log('Received movie creation request:', {
      title: req.body.title,
      year: req.body.year,
      genre: req.body.genre,
      hasImageFile: !!req.body.imageFile,
      hasImageFiles: !!(req.body.imageFiles && Array.isArray(req.body.imageFiles) && req.body.imageFiles.length > 0),
      imageFilesCount: req.body.imageFiles ? req.body.imageFiles.length : 0,
      imageFileLength: req.body.imageFile ? req.body.imageFile.length : 0,
      hasImdbRating: req.body.imdbRating !== undefined,
      fullBody: JSON.stringify(req.body, null, 2)
    });

    const { title, year, description, genre, movieUrl, imdbRating, imageFile, imageFiles } = req.body;
    
    // Custom validation: at least one image must be provided (either imageFile or imageFiles)
    if (!imageFile && (!imageFiles || !Array.isArray(imageFiles) || imageFiles.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{
          type: 'field',
          value: undefined,
          msg: 'At least one image is required (imageFile or imageFiles)',
          path: 'imageFile',
          location: 'body'
        }]
      });
    }
    
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
    
    // Validate required fields - check for either imageFile or imageFiles
    const hasImageFile = imageFile || (imageFiles && Array.isArray(imageFiles) && imageFiles.length > 0);
    if (!title || !year || !description || !genre || !movieUrl || imdbRating === undefined || !hasImageFile) {
      console.log('Missing required fields:', { 
        title: title || 'MISSING', 
        year: year || 'MISSING', 
        description: description || 'MISSING', 
        genre: genre || 'MISSING', 
        movieUrl: movieUrl || 'MISSING', 
        imdbRating: imdbRating !== undefined ? imdbRating : 'MISSING', 
        hasImageFile: !!imageFile,
        hasImageFiles: !!(imageFiles && Array.isArray(imageFiles) && imageFiles.length > 0)
      });
      
      const missingFields = [];
      if (!title) missingFields.push('title');
      if (!year) missingFields.push('year');
      if (!description) missingFields.push('description');
      if (!genre) missingFields.push('genre');
      if (!movieUrl) missingFields.push('movieUrl');
      if (imdbRating === undefined) missingFields.push('imdbRating');
      if (!hasImageFile) missingFields.push('imageFile or imageFiles');
      
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Upload images to Cloudinary
    let imageUrl;
    let images = [];
    
    // Support both single imageFile and array of imageFiles
    const imagesToUpload = imageFiles && Array.isArray(imageFiles) && imageFiles.length > 0 
      ? imageFiles 
      : (imageFile ? [imageFile] : []);
    
    if (imagesToUpload.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one image is required'
      });
    }
    
    try {
      console.log('Starting Cloudinary upload for', imagesToUpload.length, 'image(s)...');
      
      // Upload all images
      for (let i = 0; i < imagesToUpload.length; i++) {
        const imgFile = imagesToUpload[i];
        console.log(`Uploading image ${i + 1}/${imagesToUpload.length}...`);
        
        // Validate image format
        if (typeof imgFile !== 'string' || !imgFile.startsWith('data:image/')) {
          console.log('Invalid image format at index', i);
          continue; // Skip invalid images
        }
        
        const uploadResult = await cloudinary.uploader.upload(imgFile, {
          folder: 'nkmoviehub',
          transformation: [
            { width: 500, height: 750, crop: 'fill' },
            { quality: 'auto' }
          ]
        });
        
        const uploadedUrl = uploadResult.secure_url;
        images.push(uploadedUrl);
        
        // Set first image as imageUrl (for backward compatibility)
        if (i === 0) {
          imageUrl = uploadedUrl;
        }
        
        console.log(`Image ${i + 1} uploaded successfully:`, uploadedUrl);
      }
      
      if (images.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Failed to upload any valid images'
        });
      }
      
      console.log(`Successfully uploaded ${images.length} image(s)`);
    } catch (uploadError) {
      console.error('Cloudinary upload error:', uploadError);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload images: ' + uploadError.message
      });
    }

    // Create new movie
    const movie = new Movie({
      title,
      year: parseInt(year),
      description,
      genre,
      movieUrl,
      imdbRating: parseFloat(imdbRating),
      imageUrl,
      images: images, // Store array of images
      addedBy: req.user.id
    });

    console.log('Saving movie to database:', {
      title: movie.title,
      year: movie.year,
      genre: movie.genre,
      hasImageUrl: !!movie.imageUrl,
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
  body('movieUrl').optional().isURL().withMessage('Please provide a valid movie URL'),
  body('imdbRating').optional().isFloat({ min: 0, max: 10 }).withMessage('IMDB rating must be between 0 and 10')
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

    const { title, year, description, genre, movieUrl, imdbRating, imageFile, imageFiles, images } = req.body;
    
    console.log('Received update request body:', {
      title,
      year,
      description,
      genre,
      movieUrl,
      imdbRating,
      imdbRatingType: typeof imdbRating,
      hasImageFiles: !!(imageFiles && Array.isArray(imageFiles)),
      hasImages: !!(images && Array.isArray(images))
    });
    
    const updateData = {};

    if (title) updateData.title = title;
    if (year) updateData.year = parseInt(year);
    if (description) updateData.description = description;
    if (genre) updateData.genre = genre;
    if (movieUrl) updateData.movieUrl = movieUrl;
    
    // Always update imdbRating if provided (including 0)
    // The frontend always sends imdbRating, so we should process it
    if (imdbRating !== undefined && imdbRating !== null) {
      // Handle both number and string inputs
      let parsedRating;
      if (typeof imdbRating === 'number') {
        parsedRating = imdbRating;
      } else if (typeof imdbRating === 'string' && imdbRating.trim() !== '') {
        parsedRating = parseFloat(imdbRating);
      } else {
        parsedRating = NaN;
      }
      
      // Only update if it's a valid number in range (including 0)
      if (!isNaN(parsedRating) && parsedRating >= 0 && parsedRating <= 10) {
        updateData.imdbRating = parsedRating;
        console.log('✓ Including IMDB rating in update:', updateData.imdbRating, '(type:', typeof updateData.imdbRating + ')');
      } else {
        console.log('✗ IMDB rating invalid or out of range:', imdbRating, '-> parsed:', parsedRating);
      }
    } else {
      console.log('✗ IMDB rating not provided (undefined or null):', imdbRating);
    }

    // Check if movie exists first
    const existingMovie = await Movie.findById(req.params.id);
    if (!existingMovie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    // Handle images update - support multiple ways:
    // 1. images array (direct URLs) - existing images that should be kept
    // 2. imageFiles array (base64 to upload) - new images to upload
    // 3. imageFile (single base64, backward compatibility)
    // Get existing images from movie
    const existingImages = existingMovie.images && existingMovie.images.length > 0 ? existingMovie.images : [];
    
    // Upload new images if provided
    let uploadedImages = [];
    if (imageFiles && Array.isArray(imageFiles) && imageFiles.length > 0) {
      try {
        for (const imgFile of imageFiles) {
          if (typeof imgFile === 'string' && imgFile.startsWith('data:image/')) {
            const uploadResult = await cloudinary.uploader.upload(imgFile, {
              folder: 'nkmoviehub',
              transformation: [
                { width: 500, height: 750, crop: 'fill' },
                { quality: 'auto' }
              ]
            });
            uploadedImages.push(uploadResult.secure_url);
          }
        }
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload new images'
        });
      }
    }
    
    // Determine final images array
    if (images && Array.isArray(images)) {
      // If images array is provided, use it (filtered existing URLs)
      // Merge with newly uploaded images
      updateData.images = [...uploadedImages, ...images.filter(img => !uploadedImages.includes(img))];
    } else if (uploadedImages.length > 0) {
      // If only new images were uploaded, merge with existing
      updateData.images = [...uploadedImages, ...existingImages.filter(img => !uploadedImages.includes(img))];
    }
    
    // Handle single imageFile (backward compatibility)
    if (imageFile && !imageFiles) {
      try {
        if (typeof imageFile === 'string' && imageFile.startsWith('data:image/')) {
          const uploadResult = await cloudinary.uploader.upload(imageFile, {
            folder: 'nkmoviehub',
            transformation: [
              { width: 500, height: 750, crop: 'fill' },
              { quality: 'auto' }
            ]
          });
          const newImageUrl = uploadResult.secure_url;
          // Add to images array or create new one
          if (!updateData.images) {
            updateData.images = existingImages.length > 0 ? existingImages : [];
          }
          updateData.images = [newImageUrl, ...updateData.images.filter(img => img !== newImageUrl)];
          updateData.imageUrl = newImageUrl;
        }
      } catch (uploadError) {
        console.error('Cloudinary upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload new image'
        });
      }
    }
    
    // Update imageUrl to first image if images array is set
    if (updateData.images && updateData.images.length > 0) {
      updateData.imageUrl = updateData.images[0];
    } else if (images && Array.isArray(images) && images.length === 0) {
      // Explicitly set empty if all images were removed
      updateData.imageUrl = null;
      updateData.images = [];
    }

    console.log('Final updateData before database update:', JSON.stringify(updateData, null, 2));
    console.log('updateData.imdbRating:', updateData.imdbRating, 'Type:', typeof updateData.imdbRating);
    console.log('updateData keys:', Object.keys(updateData));
    console.log('Has imdbRating in updateData?', 'imdbRating' in updateData);

    // Use findByIdAndUpdate with the update object directly (MongoDB will handle it correctly)
    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      updateData,  // Direct object works fine, but $set is also valid
      { new: true, runValidators: true }
    ).populate('addedBy', 'name email');

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    console.log('Movie after update - IMDB rating:', movie.imdbRating, 'Type:', typeof movie.imdbRating);

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
// @desc    Update IMDB rating and image (admin only)
// @access  Private/Admin
router.put('/:id/update-admin-fields', protect, restrictToAdmin, [
  body('imdbRating').optional().isFloat({ min: 0, max: 10 }).withMessage('IMDB rating must be between 0 and 10'),
  body('imageFile').optional().notEmpty().withMessage('Image file cannot be empty if provided')
], async (req, res) => {
  try {
    const { imdbRating, imageFile, imageFiles } = req.body;
    const movieId = req.params.id;

    console.log('Updating admin fields for movie:', movieId, {
      hasImdbRating: imdbRating !== undefined,
      hasImageFile: !!imageFile,
      imageFileType: typeof imageFile,
      imageFileLength: imageFile ? imageFile.length : 0,
      imageFileStart: imageFile ? imageFile.substring(0, 50) : 'N/A'
    });

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

    // Handle image upload if provided - support both single and multiple images
    if (imageFiles && Array.isArray(imageFiles) && imageFiles.length > 0) {
      try {
        console.log(`Starting upload of ${imageFiles.length} image(s) to Cloudinary...`);
        
        const uploadedImages = [];
        for (let i = 0; i < imageFiles.length; i++) {
          const imgFile = imageFiles[i];
          
          // Validate image format
          if (typeof imgFile !== 'string' || !imgFile.startsWith('data:image/')) {
            console.error(`Invalid image format at index ${i}`);
            continue; // Skip invalid images
          }
          
          const uploadResult = await cloudinary.uploader.upload(imgFile, {
            folder: 'nkmoviehub',
            transformation: [
              { width: 500, height: 750, crop: 'fill' },
              { quality: 'auto' }
            ]
          });
          
          uploadedImages.push(uploadResult.secure_url);
          console.log(`Image ${i + 1}/${imageFiles.length} uploaded successfully`);
          
          // Set first image as imageUrl (for backward compatibility)
          if (i === 0) {
            movie.imageUrl = uploadResult.secure_url;
          }
        }
        
        if (uploadedImages.length > 0) {
          // Merge with existing images, avoiding duplicates
          const existingImages = movie.images && movie.images.length > 0 ? movie.images : [];
          movie.images = [...uploadedImages, ...existingImages.filter(img => !uploadedImages.includes(img))];
          console.log(`Total images after update: ${movie.images.length}`);
        } else {
          return res.status(400).json({
            success: false,
            message: 'Failed to upload any valid images'
          });
        }
        
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload images: ' + uploadError.message
        });
      }
    } else if (imageFile) {
      // Single image upload (backward compatibility)
      try {
        console.log('Starting image update to Cloudinary...');
        
        if (typeof imageFile !== 'string' || !imageFile.startsWith('data:image/')) {
          return res.status(400).json({
            success: false,
            message: 'Invalid image format. Please provide a valid image file.'
          });
        }
        
        // Upload new image to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(imageFile, {
          folder: 'nkmoviehub',
          transformation: [
            { width: 500, height: 750, crop: 'fill' },
            { quality: 'auto' }
          ]
        });
        
        movie.imageUrl = uploadResult.secure_url;
        
        // Add to images array or create new one
        const existingImages = movie.images && movie.images.length > 0 ? movie.images : [];
        movie.images = [uploadResult.secure_url, ...existingImages.filter(img => img !== uploadResult.secure_url)];
        
        console.log('Image updated successfully:', uploadResult.secure_url);
        
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload image: ' + uploadError.message
        });
      }
    }

    // Update other fields
    if (imdbRating !== undefined) {
      movie.imdbRating = parseFloat(imdbRating);
    }

    console.log('Saving movie with updated data...');
    console.log('Updated movie data:', {
      imageUrl: movie.imageUrl,
      imdbRating: movie.imdbRating
    });

    try {
      await movie.save();
      console.log('Movie saved successfully');
    } catch (saveError) {
      console.error('Error saving movie:', saveError);
      return res.status(500).json({
        success: false,
        message: 'Failed to save movie: ' + saveError.message
      });
    }

    // Populate addedBy field
    try {
      await movie.populate('addedBy', 'name email');
      console.log('Movie populated successfully');
    } catch (populateError) {
      console.error('Error populating movie:', populateError);
      // Continue anyway - not critical
    }

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