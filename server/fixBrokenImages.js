/**
 * Find image URLs in the database that no longer load (deleted Cloudinary
 * assets, the dead via.placeholder.com service, ...) and replace them with a
 * locally generated SVG poster so the UI stops firing failed requests.
 *
 * Usage:
 *   node fixBrokenImages.js --dry-run   # report only, change nothing
 *   node fixBrokenImages.js             # apply the fixes
 */
const mongoose = require('mongoose');
const fetch = require('node-fetch');
const Movie = require('./models/Movie');
const TVShow = require('./models/TVShow');
const { getPosterPlaceholder } = require('./utils/placeholderImage');
const { movieImageMap, tvShowImageMap } = require('./utils/posterLibrary');
require('dotenv').config({ path: './config.env' });

const DRY_RUN = process.argv.includes('--dry-run');
const REQUEST_TIMEOUT_MS = 10000;

// Hosts that are known to be gone - no point spending a request on them
const DEAD_HOSTS = ['via.placeholder.com', 'placeholder.com'];

const urlCache = new Map();

const isReachable = async (url) => {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('data:')) return true; // locally generated, always fine
  if (DEAD_HOSTS.some((host) => url.includes(host))) return false;
  if (!/^https?:\/\//i.test(url)) return false;

  if (urlCache.has(url)) return urlCache.get(url);

  let ok = false;
  try {
    const response = await fetch(url, { method: 'HEAD', timeout: REQUEST_TIMEOUT_MS });
    // Some CDNs reject HEAD but serve GET, so double-check those
    ok = response.ok || (response.status === 405 && (await fetch(url, { timeout: REQUEST_TIMEOUT_MS })).ok);
  } catch (error) {
    ok = false;
  }

  urlCache.set(url, ok);
  return ok;
};

// Prefer a known-good poster from the library; fall back to a generated one
const replacementFor = async (title, library) => {
  const known = library[title];
  if (known && (await isReachable(known))) return known;
  return getPosterPlaceholder(title);
};

const fixCollection = async (Model, label, library) => {
  const docs = await Model.find({});
  let fixedDocs = 0;
  let fixedUrls = 0;

  for (const doc of docs) {
    let changed = false;

    if (!(await isReachable(doc.imageUrl))) {
      const replacement = await replacementFor(doc.title, library);
      const kind = replacement.startsWith('data:') ? 'placeholder' : 'library poster';
      console.log(`  [${label}] ${doc.title}: imageUrl -> ${kind} (was ${doc.imageUrl || 'empty'})`);
      doc.imageUrl = replacement;
      changed = true;
      fixedUrls++;
    }

    if (Array.isArray(doc.images) && doc.images.length > 0) {
      const checked = [];
      for (const image of doc.images) {
        if (await isReachable(image)) {
          checked.push(image);
        } else {
          console.log(`  [${label}] ${doc.title}: images[] entry dropped (${image})`);
          changed = true;
          fixedUrls++;
        }
      }
      // Never leave a record with an empty gallery - fall back to the poster
      doc.images = checked.length > 0 ? checked : [doc.imageUrl];
    }

    if (changed) {
      fixedDocs++;
      if (!DRY_RUN) {
        await doc.save({ validateBeforeSave: false });
      }
    }
  }

  console.log(`${label}: ${fixedDocs}/${docs.length} records with broken images (${fixedUrls} dead URLs)`);
  return { fixedDocs, fixedUrls };
};

const fixBrokenImages = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Connected to MongoDB${DRY_RUN ? ' (dry run - nothing will be written)' : ''}\n`);

    const movies = await fixCollection(Movie, 'Movie', movieImageMap);
    const tvShows = await fixCollection(TVShow, 'TVShow', tvShowImageMap);

    const total = movies.fixedUrls + tvShows.fixedUrls;
    console.log(`\n${DRY_RUN ? 'Would replace' : 'Replaced'} ${total} dead image URL(s).`);
  } catch (error) {
    console.error('Failed to fix images:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

fixBrokenImages();
