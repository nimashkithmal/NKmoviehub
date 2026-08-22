/**
 * Single place where posters get pushed to Cloudinary.
 *
 * Every poster that reaches the database goes through here, so images are
 * always hosted on Cloudinary rather than stored locally or hot-linked from
 * somebody else's CDN.
 */
const cloudinary = require('cloudinary').v2;

// Fallback values keep the API working if dotenv fails to load config.env
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dmjhodvge';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '869289811975563';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '0N4n4B6JfqHrY_Pev2vEbn8P80U';

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET
});

const POSTER_FOLDERS = {
  movie: 'nkmoviehub',
  tvshow: 'nkmoviehub/tvshows',
  banner: 'nkmoviehub/home-page-banner'
};

const POSTER_TRANSFORMATION = [
  { width: 500, height: 750, crop: 'fill' },
  { quality: 'auto' }
];

// Home page slides are wide rather than portrait, so they need their own size
const BANNER_TRANSFORMATION = [
  { width: 1920, height: 800, crop: 'fill' },
  { quality: 'auto' }
];

const TRANSFORMATIONS = {
  movie: POSTER_TRANSFORMATION,
  tvshow: POSTER_TRANSFORMATION,
  banner: BANNER_TRANSFORMATION
};

const isCloudinaryUrl = (value) =>
  typeof value === 'string' && value.includes('res.cloudinary.com');

const isDataUri = (value) =>
  typeof value === 'string' && value.startsWith('data:image/');

const isRemoteUrl = (value) =>
  typeof value === 'string' && /^https?:\/\//i.test(value);

/**
 * Cloudinary only accepts base64 data URIs, but the placeholder generator
 * produces percent-encoded SVG, so re-encode those before uploading.
 */
const normalizeDataUri = (value) => {
  const match = value.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!match) return value;

  const [, mimeType, base64Flag, payload] = match;
  if (base64Flag) return value;

  const decoded = decodeURIComponent(payload);
  return `data:${mimeType};base64,${Buffer.from(decoded, 'utf8').toString('base64')}`;
};

/**
 * Upload one image and return Cloudinary's full response.
 * Callers that need the public_id back - to be able to delete the image later -
 * use this; everything else uses uploadPoster and gets just the URL.
 */
const uploadImage = async (source, options = {}) => {
  const {
    type = 'movie',
    folder = POSTER_FOLDERS[type] || POSTER_FOLDERS.movie,
    publicId,
    transformation = TRANSFORMATIONS[type] || POSTER_TRANSFORMATION
  } = options;

  if (isCloudinaryUrl(source)) {
    // Already hosted by us; there is nothing to re-upload
    return { secure_url: source, public_id: null };
  }

  if (!isDataUri(source) && !isRemoteUrl(source)) {
    throw new Error('Unsupported image source - expected an uploaded image or an image URL');
  }

  const uploadOptions = {
    folder,
    transformation,
    // SVG placeholders would otherwise stay vector; posters are served as images
    format: 'jpg'
  };

  if (publicId) {
    uploadOptions.public_id = publicId;
    uploadOptions.overwrite = true;
  }

  return cloudinary.uploader.upload(
    isDataUri(source) ? normalizeDataUri(source) : source,
    uploadOptions
  );
};

/**
 * Upload one poster and return its Cloudinary URL.
 * Accepts a base64/data-URI upload from the admin form or a remote image URL.
 * Anything already on Cloudinary is returned untouched.
 */
const uploadPoster = async (source, options = {}) => {
  const result = await uploadImage(source, options);
  return result.secure_url;
};

/**
 * Upload a list of posters, skipping anything that cannot be uploaded.
 * Returns the Cloudinary URLs in the original order.
 */
const uploadPosters = async (sources, options = {}) => {
  const uploaded = [];

  for (let i = 0; i < sources.length; i++) {
    try {
      uploaded.push(await uploadPoster(sources[i], options));
    } catch (error) {
      console.error(`Skipping image ${i + 1}/${sources.length}: ${error.message}`);
    }
  }

  return uploaded;
};

module.exports = {
  cloudinary,
  uploadImage,
  uploadPoster,
  uploadPosters,
  isCloudinaryUrl,
  POSTER_FOLDERS,
  POSTER_TRANSFORMATION,
  BANNER_TRANSFORMATION
};
