/**
 * Move the nine hard-coded home page slideshow wallpapers onto Cloudinary and
 * store them as Banner documents, so the slideshow is served from our own
 * account and can be managed from the admin dashboard.
 *
 * Uploads use a deterministic public_id, so re-running the script overwrites
 * the same assets instead of piling up duplicates.
 *
 * Usage:
 *   node seedHomeBanners.js --dry-run   # report only
 *   node seedHomeBanners.js             # upload and write to the database
 */
const mongoose = require('mongoose');
const Banner = require('./models/Banner');
const User = require('./models/User');
const { uploadImage, POSTER_FOLDERS } = require('./utils/cloudinaryUpload');
require('dotenv').config({ path: './config.env' });

const DRY_RUN = process.argv.includes('--dry-run');

// The wallpapers the home page used before banners lived in the database
const LEGACY_BANNERS = [
  'https://c4.wallpaperflare.com/wallpaper/884/965/115/movies-flash-superman-wonder-woman-wallpaper-preview.jpg',
  'https://images5.alphacoders.com/840/840870.jpg',
  'https://wallpapercave.com/wp/wp2592669.jpg',
  'https://wallup.net/wp-content/uploads/2019/09/06/297529-legend-of-the-seeker-models-tabrett-bethell-cara-mason-748x421.jpg',
  'https://www.syfy.com/sites/syfy/files/styles/hero_image__large__computer__alt_1_5x/public/2021/01/legends-of-tomorrow.jpg',
  'https://www.chromethemer.com/wallpapers/chromebook-wallpapers/images/960/marvel-logo-chromebook-wallpaper.jpg',
  'https://wallpapers.com/images/high/4k-avengers-infinity-war-whole-cast-gx5riyd6eqklm4hf.webp',
  'https://4kwallpapers.com/images/walls/thumbs_3t/11941.jpg',
  'https://www.pixelstalk.net/wp-content/uploads/2016/01/Harry-Potter-7-Wallpaper-HD-Free.jpg'
];

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to ${process.env.MONGODB_URI}`);

  // Banners are owned by an admin; the first one found is good enough here
  const admin = await User.findOne({ role: 'admin' });
  if (!admin) {
    throw new Error('No admin user found - create one before seeding banners');
  }

  const existing = await Banner.countDocuments();
  if (existing > 0) {
    console.log(`${existing} banner(s) already in the database - nothing to seed.`);
    return;
  }

  let created = 0;
  let failed = 0;

  for (let i = 0; i < LEGACY_BANNERS.length; i++) {
    const source = LEGACY_BANNERS[i];
    const publicId = `home-banner-${i + 1}`;

    if (DRY_RUN) {
      console.log(`[dry run] would upload ${source} as ${POSTER_FOLDERS.banner}/${publicId}`);
      continue;
    }

    try {
      const uploaded = await uploadImage(source, { type: 'banner', publicId });
      await Banner.create({
        imageUrl: uploaded.secure_url,
        publicId: uploaded.public_id,
        order: i,
        status: 'active',
        addedBy: admin._id
      });
      created++;
      console.log(`${i + 1}/${LEGACY_BANNERS.length} uploaded -> ${uploaded.secure_url}`);
    } catch (error) {
      failed++;
      console.error(`${i + 1}/${LEGACY_BANNERS.length} failed (${source}): ${error.message}`);
    }
  }

  console.log(`\nDone. Created ${created} banner(s), ${failed} failed.`);
};

run()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
