#!/usr/bin/env node
/**
 * Unhide movies / TV shows that the old adult-content blocklist restricted
 * (policyRestricted: true). Titles that still match adult signals become 18+.
 *
 * Usage:
 *   npm run unblock:legacy            # report only
 *   npm run unblock:legacy -- --apply # write changes
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

const envPath = path.join(__dirname, '..', 'config.env');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
} else {
  require('dotenv').config();
}

const Movie = require('../models/Movie');
const TVShow = require('../models/TVShow');
const { unblockLegacyRestrictedTitles } = require('../utils/contentPolicy');

const apply = process.argv.includes('--apply');

(async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI / MONGO_URI missing');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 25000 });

  for (const [label, Model] of [['Movies', Movie], ['TV shows', TVShow]]) {
    const changes = await unblockLegacyRestrictedTitles(Model, { dryRun: !apply });
    console.log(`\n${label}: ${changes.length} ${apply ? 'unblocked' : 'would be unblocked'}`);
    for (const { title, year, set } of changes) {
      const notes = [set.matureContent ? '18+' : 'all ages', set.status ? `status → ${set.status}` : '']
        .filter(Boolean)
        .join(', ');
      console.log(`  - ${title} (${year}) — ${notes}`);
    }
  }

  if (!apply) console.log('\nReport only. Re-run with --apply to write these changes.');
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error('Unblock legacy titles failed:', error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
