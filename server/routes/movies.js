const express = require('express');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Movie = require('../models/Movie');
const Rating = require('../models/Rating');
const Notification = require('../models/Notification');
const MovieQuestion = require('../models/MovieQuestion');
const { protect, restrictToAdmin } = require('../middleware/auth');
const {
  extractTmdbId,
  getTrendingTmdbIds,
  orderDocsTrendingFirst
} = require('../utils/trendingPopular');
const {
  promoteReleasedComingSoon,
  sortComingSoon,
  filterUpcomingOnly
} = require('../utils/comingSoon');
const {
  applyPublicCatalogFilter,
  filterPublicItems,
  evaluateContentPolicy,
  isPubliclyAccessible
} = require('../utils/contentPolicy');
const fetch = require('node-fetch');
// Cloudinary is configured once in utils/cloudinaryUpload; every poster that
// reaches the database is uploaded there first
const { cloudinary, uploadPoster, uploadPosters, isCloudinaryUrl } = require('../utils/cloudinaryUpload');
const {
  applyLanguageFilter,
  collectLanguageOptions
} = require('../utils/languageFilter');
const { findExistingMovieDuplicate } = require('../utils/deduplicateMovies');

const router = express.Router();

const parseMoneyInput = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, value);
  const raw = String(value).trim().replace(/[$,\s]/g, '');
  if (!raw) return null;
  const match = raw.match(/^([\d.]+)\s*([kmb])?$/i);
  if (!match) {
    const n = Number(raw);
    return Number.isFinite(n) ? Math.max(0, n) : null;
  }
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return null;
  const suffix = (match[2] || '').toLowerCase();
  const mult = suffix === 'b' ? 1e9 : suffix === 'm' ? 1e6 : suffix === 'k' ? 1e3 : 1;
  return Math.max(0, amount * mult);
};

const normalizeTrailerUrl = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const id =
    raw.match(/youtube\.com\/watch\?[^#]*v=([A-Za-z0-9_-]{6,})/i)?.[1] ||
    raw.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i)?.[1] ||
    raw.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/i)?.[1] ||
    null;
  if (id) return `https://www.youtube.com/embed/${id}`;
  return raw.slice(0, 500);
};

const pickMetaFields = (body = {}) => {
  const meta = {};
  if (body.tagline !== undefined) meta.tagline = String(body.tagline || '').trim().slice(0, 300);
  if (body.director !== undefined) meta.director = String(body.director || '').trim().slice(0, 200);
  if (body.language !== undefined) meta.language = String(body.language || '').trim().slice(0, 80);
  if (body.releaseStatus !== undefined) meta.releaseStatus = String(body.releaseStatus || '').trim().slice(0, 80);
  if (body.releaseDate !== undefined) meta.releaseDate = String(body.releaseDate || '').trim().slice(0, 40);
  if (body.trailerUrl !== undefined) meta.trailerUrl = normalizeTrailerUrl(body.trailerUrl);
  if (body.runtime !== undefined && body.runtime !== null && body.runtime !== '') {
    const runtime = parseInt(body.runtime, 10);
    meta.runtime = Number.isFinite(runtime) && runtime >= 0 ? runtime : null;
  }
  if (body.budget !== undefined) meta.budget = parseMoneyInput(body.budget);
  if (body.revenue !== undefined) meta.revenue = parseMoneyInput(body.revenue);
  return meta;
};

// @route   GET /api/movies
// @desc    Get all movies (public)
// @access  Public
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 1000,
      search = '',
      genre = '',
      year = '',
      language = '',
      status = 'active',
      sort = 'popular'
    } = req.query;
    
    // Public catalog: active by default; Coming Soon category uses status=coming_soon
    // Search should also find Coming Soon titles (e.g. Avengers: Doomsday)
    const hasSearch = Boolean(search && String(search).trim());
    const comingSoonOnly = status === 'coming_soon';
    if (comingSoonOnly) {
      await promoteReleasedComingSoon(Movie);
    }

    const filter = applyPublicCatalogFilter({});
    if (comingSoonOnly) {
      filter.status = 'coming_soon';
    } else if (hasSearch) {
      filter.status = { $in: ['active', 'coming_soon'] };
    } else {
      filter.status = 'active';
    }
    
    if (hasSearch) {
      // Use regex search instead of $text for better compatibility
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { genre: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (genre) {
      const escaped = String(genre).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.genre = {
        $regex: `(^|[,|/]\\s*)${escaped}(?=\\s*[,|/]|$)`,
        $options: 'i'
      };
    }
    
    if (year) {
      filter.year = parseInt(year);
    }

    applyLanguageFilter(filter, language);

    // Calculate pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(2000, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    // Coming Soon browse: only future releases, nearest first
    if (comingSoonOnly) {
      const candidates = await Movie.find(filter)
        .populate('addedBy', 'name email')
        .lean();
      const upcoming = filterPublicItems(filterUpcomingOnly(candidates));
      const total = upcoming.length;
      const movies = upcoming.slice(skip, skip + limitNum);

      return res.json({
        success: true,
        data: {
          movies,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.max(1, Math.ceil(total / limitNum) || 1),
            totalMovies: total,
            moviesPerPage: limitNum
          }
        }
      });
    }

    // Popular: trending titles first, then the rest of the catalog
    if (sort === 'popular') {
      const trendingIds = await getTrendingTmdbIds('movie', 2);
      const candidates = await Movie.find(filter)
        .select('_id movieUrl imdbRating averageRating year title')
        .lean();
      const orderedIds = orderDocsTrendingFirst(candidates, trendingIds, (doc) =>
        extractTmdbId(doc.movieUrl)
      )
        .filter((doc) => isPubliclyAccessible(doc))
        .map((doc) => doc._id);
      const total = orderedIds.length;
      const pageIds = orderedIds.slice(skip, skip + limitNum);
      const found = await Movie.find({ _id: { $in: pageIds } })
        .populate('addedBy', 'name email')
        .lean();
      const byId = new Map(found.map((m) => [String(m._id), m]));
      const movies = filterPublicItems(
        pageIds.map((id) => byId.get(String(id))).filter(Boolean)
      );

      return res.json({
        success: true,
        data: {
          movies,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.max(1, Math.ceil(total / limitNum) || 1),
            totalMovies: total,
            moviesPerPage: limitNum
          }
        }
      });
    }

    let sortSpec = { year: -1, createdAt: -1 };
    if (sort === 'rated') sortSpec = { imdbRating: -1, averageRating: -1, createdAt: -1 };
    else if (sort === 'az') sortSpec = { title: 1 };
    
    // Get movies with pagination
    const movies = filterPublicItems(
      await Movie.find(filter)
        .populate('addedBy', 'name email')
        .sort(sortSpec)
        .skip(skip)
        .limit(limitNum)
    );
    
    // Get total count for pagination
    const total = await Movie.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        movies,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.max(1, Math.ceil(total / limitNum)),
          totalMovies: total,
          moviesPerPage: limitNum
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
    const { page = 1, limit = 30, search = '', genre = '', status = '' } = req.query;
    
    // Build filter object
    const filter = {};
    
    if (search && String(search).trim()) {
      const q = String(search).trim();
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { genre: { $regex: q, $options: 'i' } }
      ];
      if (/^\d{4}$/.test(q)) {
        filter.$or.push({ year: parseInt(q, 10) });
      }
    }
    
    if (genre) {
      const escaped = String(genre).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.genre = {
        $regex: `(^|[,|/]\\s*)${escaped}(?=\\s*[,|/]|$)`,
        $options: 'i'
      };
    }
    
    if (status) {
      filter.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 30));
    const skip = (pageNum - 1) * limitNum;
    
    // Get movies with pagination
    const movies = await Movie.find(filter)
      .populate('addedBy', 'name email')
      .sort({ year: -1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum);
    
    // Get total count for pagination
    const total = await Movie.countDocuments(filter);
    
    res.json({
      success: true,
      data: {
        movies,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.max(1, Math.ceil(total / limitNum)),
          totalMovies: total,
          moviesPerPage: limitNum
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
    // Split combined strings like "Action, Adventure, Comedy" into single genres
    const rawGenres = await Movie.distinct('genre', applyPublicCatalogFilter({ status: 'active' }));
    const genreSet = new Set();
    for (const value of rawGenres) {
      String(value || '')
        .split(/[,|/]+/)
        .forEach((g) => {
          const cleaned = g.trim();
          if (cleaned) genreSet.add(cleaned);
        });
    }
    const genres = Array.from(genreSet).sort((a, b) => a.localeCompare(b));
    
    // Get unique years, sorted descending
    const years = await Movie.distinct('year', applyPublicCatalogFilter({ status: 'active' }));
    const sortedYears = years.sort((a, b) => b - a);

    const rawLanguages = await Movie.distinct('language', applyPublicCatalogFilter({ status: 'active' }));
    const languages = collectLanguageOptions(rawLanguages);
    
    res.json({
      success: true,
      data: {
        genres,
        years: sortedYears,
        languages
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

// @route   GET /api/movies/coming-soon
// @desc    Titles marked Coming Soon for the home catalog row
// @access  Public
router.get('/coming-soon', async (req, res) => {
  try {
    await promoteReleasedComingSoon(Movie);

    const movies = filterPublicItems(
      filterUpcomingOnly(
        await Movie.find(applyPublicCatalogFilter({ status: 'coming_soon' }))
          .select('-__v')
          .lean()
      )
    );

    res.json({
      success: true,
      data: { movies: movies.slice(0, 40) }
    });
  } catch (error) {
    console.error('Get coming soon movies error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching coming soon movies'
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
// @access  Public
router.get('/:id/download', async (req, res) => {
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

// @route   GET /api/movies/:id/watch
// @desc    Lightweight movie payload for the watch player
// @access  Public
router.get('/:id/watch', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    const movie = await Movie.findById(req.params.id)
      .select(
        'title year description imageUrl bannerUrl images movieUrl trailerUrl imdbRating genre runtime status language'
      )
      .lean();

    if (!movie || !isPubliclyAccessible(movie)) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    res.set('Cache-Control', 'public, max-age=120');
    res.json({
      success: true,
      data: { movie }
    });
  } catch (error) {
    console.error('Get movie watch payload error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching movie'
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
    
    if (!movie || !isPubliclyAccessible(movie)) {
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

    const { title, year, description, genre, movieUrl, imdbRating, imageFile, imageFiles, imageUrl: providedImageUrl } = req.body;
    
    // Custom validation: poster file(s) OR a direct image URL (e.g. TMDB) — video never goes to Cloudinary
    const hasImageFile = imageFile || (imageFiles && Array.isArray(imageFiles) && imageFiles.length > 0);
    const hasImageUrl = providedImageUrl && String(providedImageUrl).trim().startsWith('http');
    if (!hasImageFile && !hasImageUrl) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: [{
          type: 'field',
          value: undefined,
          msg: 'At least one image is required (imageFile, imageFiles, or imageUrl)',
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

    const existingMovie = await findExistingMovieDuplicate({
      title,
      year,
      movieUrl
    });
    if (existingMovie) {
      return res.status(409).json({
        success: false,
        message: `A movie with this title and year already exists (${existingMovie.title}, ${existingMovie.year})`
      });
    }
    
    // Validate required fields (poster file upload OR direct imageUrl — video stays as movieUrl only)
    if (!title || !year || !description || !genre || !movieUrl || imdbRating === undefined || (!hasImageFile && !hasImageUrl)) {
      console.log('Missing required fields:', { 
        title: title || 'MISSING', 
        year: year || 'MISSING', 
        description: description || 'MISSING', 
        genre: genre || 'MISSING', 
        movieUrl: movieUrl || 'MISSING', 
        imdbRating: imdbRating !== undefined ? imdbRating : 'MISSING', 
        hasImageFile: !!hasImageFile,
        hasImageUrl: !!hasImageUrl
      });
      
      const missingFields = [];
      if (!title) missingFields.push('title');
      if (!year) missingFields.push('year');
      if (!description) missingFields.push('description');
      if (!genre) missingFields.push('genre');
      if (!movieUrl) missingFields.push('movieUrl');
      if (imdbRating === undefined) missingFields.push('imdbRating');
      if (!hasImageFile && !hasImageUrl) missingFields.push('imageFile, imageFiles, or imageUrl');
      
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const policyCheck = evaluateContentPolicy({
      title,
      description,
      genre,
      tagline: req.body.tagline
    });
    if (policyCheck.restricted) {
      return res.status(400).json({
        success: false,
        message: 'This title cannot be published due to content policy.',
        reason: policyCheck.reason
      });
    }

    // Poster: use direct URL when given (no Cloudinary). Upload files only when provided.
    // movieUrl is never uploaded to Cloudinary — embed/stream links stay as-is.
    let imageUrl;
    let images = [];

    if (hasImageUrl && !hasImageFile) {
      imageUrl = String(providedImageUrl).trim();
      images = [imageUrl];
    } else {
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
        images = await uploadPosters(imagesToUpload, { type: 'movie' });
        imageUrl = images[0];

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
    }

    // Create new movie
    const meta = pickMetaFields(req.body);
    const movie = new Movie({
      title,
      year: parseInt(year),
      description,
      genre,
      movieUrl,
      imdbRating: parseFloat(imdbRating),
      imageUrl,
      images: images, // Store array of images
      ...meta,
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

    const { title, year, description, genre, movieUrl, imdbRating, imageFile, imageFiles, images, bannerFile, bannerUrl, clearBanner } = req.body;
    
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
    Object.assign(updateData, pickMetaFields(req.body));
    
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
        uploadedImages = await uploadPosters(imageFiles, { type: 'movie' });
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
      const remoteToUpload = images.filter(
        (img) => !uploadedImages.includes(img) && !isCloudinaryUrl(img)
      );
      const alreadyHosted = images.filter(
        (img) => !uploadedImages.includes(img) && isCloudinaryUrl(img)
      );
      const uploadedKept = remoteToUpload.length
        ? await uploadPosters(remoteToUpload, { type: 'movie' })
        : [];
      updateData.images = [...uploadedImages, ...alreadyHosted, ...uploadedKept];
    } else if (uploadedImages.length > 0) {
      // If only new images were uploaded, merge with existing
      updateData.images = [...uploadedImages, ...existingImages.filter(img => !uploadedImages.includes(img))];
    }
    
    // Handle single imageFile (backward compatibility)
    if (imageFile && !imageFiles) {
      try {
        if (typeof imageFile === 'string') {
          const newImageUrl = await uploadPoster(imageFile, { type: 'movie' });
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

    // Detail-page banner (separate from poster gallery — never stored in images[])
    if (clearBanner === true || clearBanner === 'true') {
      updateData.bannerUrl = null;
    } else if (bannerFile && typeof bannerFile === 'string') {
      try {
        updateData.bannerUrl = await uploadPoster(bannerFile, { type: 'banner' });
      } catch (uploadError) {
        console.error('Banner upload error:', uploadError);
        return res.status(500).json({
          success: false,
          message: 'Failed to upload detail banner: ' + uploadError.message
        });
      }
    } else if (bannerUrl && typeof bannerUrl === 'string' && bannerUrl.trim().startsWith('http')) {
      try {
        updateData.bannerUrl = await uploadPoster(bannerUrl.trim(), { type: 'banner' });
      } catch (uploadError) {
        // Fall back to storing the remote URL directly if Cloudinary rejects it
        updateData.bannerUrl = bannerUrl.trim();
      }
    }

    console.log('Final updateData before database update:', JSON.stringify(updateData, null, 2));
    console.log('updateData.imdbRating:', updateData.imdbRating, 'Type:', typeof updateData.imdbRating);
    console.log('updateData keys:', Object.keys(updateData));
    console.log('Has imdbRating in updateData?', 'imdbRating' in updateData);

    const existing = await Movie.findById(req.params.id).select(
      'title description genre tagline status policyRestricted'
    );
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    const policyCheck = evaluateContentPolicy({
      title: updateData.title || existing.title,
      description: updateData.description || existing.description,
      genre: updateData.genre || existing.genre,
      tagline: updateData.tagline ?? existing.tagline,
      policyRestricted: existing.policyRestricted
    });
    if (policyCheck.restricted) {
      updateData.policyRestricted = true;
      updateData.policyRestrictedReason = policyCheck.reason;
      if (['active', 'coming_soon'].includes(updateData.status || existing.status)) {
        updateData.status = 'inactive';
      }
    } else {
      updateData.policyRestricted = false;
      updateData.policyRestrictedReason = '';
    }

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
          
          const uploadedUrl = await uploadPoster(imgFile, { type: 'movie' });

          uploadedImages.push(uploadedUrl);
          console.log(`Image ${i + 1}/${imageFiles.length} uploaded successfully`);

          // Set first image as imageUrl (for backward compatibility)
          if (i === 0) {
            movie.imageUrl = uploadedUrl;
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
        
        if (typeof imageFile !== 'string') {
          return res.status(400).json({
            success: false,
            message: 'Invalid image format. Please provide a valid image file.'
          });
        }

        // Upload new image to Cloudinary
        const uploadedUrl = await uploadPoster(imageFile, { type: 'movie' });

        movie.imageUrl = uploadedUrl;

        // Add to images array or create new one
        const existingImages = movie.images && movie.images.length > 0 ? movie.images : [];
        movie.images = [uploadedUrl, ...existingImages.filter(img => img !== uploadedUrl)];

        console.log('Image updated successfully:', uploadedUrl);
        
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

// @route   GET /api/movies/:id/questions
// @desc    Public Q&A thread for a movie
// @access  Public
router.get('/:id/questions', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id).select('_id');
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    const sessionId = String(req.query.sessionId || '').trim().slice(0, 80);
    const filter = { movie: movie._id };
    if (sessionId) {
      filter.sessionId = sessionId;
    }

    const questions = await MovieQuestion.find(filter)
      .sort({ createdAt: 1 })
      .select('question answer answeredAt createdAt fromName fromEmail')
      .lean();

    res.json({
      success: true,
      data: { questions }
    });
  } catch (error) {
    console.error('Get movie questions error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching questions'
    });
  }
});

// @route   POST /api/movies/:id/ask
// @desc    Ask about this movie (public Q&A + admin notification)
// @access  Public
router.post('/:id/ask', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id).select('title year status');
    if (!movie) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    const message = String(req.body?.message || req.body?.question || '').trim().slice(0, 2000);
    const sessionId = String(req.body?.sessionId || '').trim().slice(0, 80);
    const fromName = String(req.body?.fromName || req.body?.name || '').trim().slice(0, 100);
    const fromEmail = String(req.body?.fromEmail || req.body?.email || '').trim().slice(0, 120);

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Question is required'
      });
    }

    const question = await MovieQuestion.create({
      movie: movie._id,
      question: message,
      sessionId,
      fromName,
      fromEmail
    });

    await Notification.create({
      type: 'movie_ask',
      title: `Ask about: ${movie.title}`,
      message,
      movie: movie._id,
      movieTitle: movie.title,
      question: question._id,
      fromName: fromName || 'Guest',
      fromEmail
    });

    res.status(201).json({
      success: true,
      message: 'Question posted. An admin will be notified.',
      data: {
        question: {
          _id: question._id,
          question: question.question,
          answer: question.answer || '',
          answeredAt: question.answeredAt,
          createdAt: question.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Ask about movie error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending your question'
    });
  }
});

// @route   POST /api/movies/:id/questions/:qid/reply
// @desc    Admin reply to a movie question
// @access  Private/Admin
router.post('/:id/questions/:qid/reply', protect, restrictToAdmin, async (req, res) => {
  try {
    const answer = String(req.body?.answer || '').trim().slice(0, 4000);
    if (!answer) {
      return res.status(400).json({
        success: false,
        message: 'Answer is required'
      });
    }

    const question = await MovieQuestion.findOne({
      _id: req.params.qid,
      movie: req.params.id
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found'
      });
    }

    question.answer = answer;
    question.answeredBy = req.user.id;
    question.answeredAt = new Date();
    await question.save();

    await Notification.updateMany(
      { question: question._id },
      { $set: { read: true, replied: true } }
    );

    res.json({
      success: true,
      message: 'Reply posted',
      data: {
        question: {
          _id: question._id,
          question: question.question,
          answer: question.answer,
          answeredAt: question.answeredAt,
          createdAt: question.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Reply to movie question error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while posting reply'
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

    const allowed = ['active', 'inactive', 'coming_soon'];
    const requested = req.body?.status;
    const newStatus = allowed.includes(requested)
      ? requested
      : (movie.status === 'active' ? 'inactive' : 'active');
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

// @route   POST /api/movies/admin/enforce-content-policy
// @desc    Hide titles that violate AdSense content policy
// @access  Private/Admin
router.post('/admin/enforce-content-policy', protect, restrictToAdmin, async (req, res) => {
  try {
    const movies = await Movie.find({}).select('title description tagline genre status policyRestricted');
    let movieCount = 0;

    for (const doc of movies) {
      const result = evaluateContentPolicy(doc);
      if (!result.restricted) continue;
      movieCount += 1;
      doc.policyRestricted = true;
      doc.policyRestrictedReason = result.reason;
      if (doc.status === 'active' || doc.status === 'coming_soon') {
        doc.status = 'inactive';
      }
      await doc.save();
    }

    const TVShow = require('../models/TVShow');
    const shows = await TVShow.find({}).select('title description tagline genre status policyRestricted');
    let tvCount = 0;

    for (const doc of shows) {
      const result = evaluateContentPolicy(doc);
      if (!result.restricted) continue;
      tvCount += 1;
      doc.policyRestricted = true;
      doc.policyRestrictedReason = result.reason;
      if (doc.status === 'active' || doc.status === 'coming_soon') {
        doc.status = 'inactive';
      }
      await doc.save();
    }

    res.json({
      success: true,
      message: `Content policy enforced. Restricted ${movieCount} movies and ${tvCount} TV shows.`,
      data: { restrictedMovies: movieCount, restrictedTvShows: tvCount }
    });
  } catch (error) {
    console.error('Enforce content policy error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while enforcing content policy'
    });
  }
});

module.exports = router; 