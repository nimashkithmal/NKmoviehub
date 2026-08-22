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
  tvshow: 'nkmoviehub/tvshows'
};

const POSTER_TRANSFORMATION = [
  { width: 500, height: 750, crop: 'fill' },
  { quality: 'auto' }
];

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
 * Upload one poster and return its Cloudinary URL.
 * Accepts a base64/data-URI upload from the admin form or a remote image URL.
 * Anything already on Cloudinary is returned untouched.
 */
const uploadPoster = async (source, options = {}) => {
  const { type = 'movie', folder = POSTER_FOLDERS[type] || POSTER_FOLDERS.movie, publicId } = options;

  if (isCloudinaryUrl(source)) {
    return source; // already hosted by us
  }

  if (!isDataUri(source) && !isRemoteUrl(source)) {
    throw new Error('Unsupported image source - expected an uploaded image or an image URL');
  }

  const uploadOptions = {
    folder,
    transformation: POSTER_TRANSFORMATION,
    // SVG placeholders would otherwise stay vector; posters are served as images
    format: 'jpg'
  };

  if (publicId) {
    uploadOptions.public_id = publicId;
    uploadOptions.overwrite = true;
  }

  const result = await cloudinary.uploader.upload(
    isDataUri(source) ? normalizeDataUri(source) : source,
    uploadOptions
  );

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
  uploadPoster,
  uploadPosters,
  isCloudinaryUrl,
  POSTER_FOLDERS,
  POSTER_TRANSFORMATION
};
