/**
 * Move every existing movie/TV show poster onto Cloudinary and rewrite the
 * database URLs to point at our own Cloudinary account, so nothing depends on
 * an outside CDN staying up.
 *
 * Uploads use a deterministic public_id per title, so re-running the script
 * overwrites the same assets instead of piling up duplicates.
 *
 * Usage:
 *   node migratePostersToCloudinary.js --dry-run   # report only
 *   node migratePostersToCloudinary.js             # upload and update the DB
 */
const mongoose = require('mongoose');
const Movie = require('./models/Movie');
const TVShow = require('./models/TVShow');
const { uploadPoster, isCloudinaryUrl } = require('./utils/cloudinaryUpload');
require('dotenv').config({ path: './config.env' });

const DRY_RUN = process.argv.includes('--dry-run');

const slugify = (title) =>
  String(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'poster';

const migrateCollection = async (Model, label, type) => {
  const docs = await Model.find({});
  let migratedDocs = 0;
  let uploadedCount = 0;
  let skippedCount = 0;

  for (const doc of docs) {
    // images[] is the source of truth; fall back to the single imageUrl
    const sources = Array.isArray(doc.images) && doc.images.length > 0
      ? doc.images
      : (doc.imageUrl ? [doc.imageUrl] : []);

    if (sources.length === 0) {
      console.log(`  [${label}] ${doc.title}: no image to migrate`);
      continue;
    }

    if (sources.every(isCloudinaryUrl)) {
      skippedCount++;
      continue; // already on Cloudinary
    }

    const migrated = [];
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];

      if (isCloudinaryUrl(source)) {
        migrated.push(source);
        continue;
      }

      const publicId = `${slugify(doc.title)}-${i + 1}`;
      const described = source.startsWith('data:') ? 'generated placeholder' : source;

      if (DRY_RUN) {
        console.log(`  [${label}] ${doc.title}: would upload ${described} as ${publicId}`);
        migrated.push(source);
        uploadedCount++;
        continue;
      }

      try {
        const url = await uploadPoster(source, { type, publicId });
        console.log(`  [${label}] ${doc.title}: ${publicId} -> ${url}`);
        migrated.push(url);
        uploadedCount++;
      } catch (error) {
        console.error(`  [${label}] ${doc.title}: upload failed (${error.message}) - keeping existing URL`);
        migrated.push(source);
      }
    }

    if (!DRY_RUN) {
      doc.images = migrated;
      doc.imageUrl = migrated[0];
      await doc.save({ validateBeforeSave: false });
    }
    migratedDocs++;
  }

  console.log(`${label}: ${migratedDocs} record(s) migrated, ${skippedCount} already on Cloudinary, ${uploadedCount} image(s) uploaded\n`);
  return uploadedCount;
};

const migratePosters = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Connected to MongoDB${DRY_RUN ? ' (dry run - nothing will be uploaded or written)' : ''}\n`);

    const movies = await migrateCollection(Movie, 'Movie', 'movie');
    const tvShows = await migrateCollection(TVShow, 'TVShow', 'tvshow');

    console.log(`${DRY_RUN ? 'Would upload' : 'Uploaded'} ${movies + tvShows} poster(s) to Cloudinary.`);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

migratePosters();
