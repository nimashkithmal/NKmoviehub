#!/usr/bin/env node
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { deduplicateMovies, findDuplicateGroups } = require('../utils/deduplicateMovies');

dotenv.config({ path: path.join(__dirname, '../config.env') });

const dryRun = process.argv.includes('--dry-run');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);

  const before = await findDuplicateGroups();
  console.log(`Found ${before.length} duplicate title+year groups`);

  if (!before.length) {
    console.log('No duplicates to remove.');
    process.exit(0);
  }

  before.forEach((group) => {
    console.log(`- ${group.title} (${group.year}) x${group.movies.length}`);
  });

  const result = await deduplicateMovies({ dryRun });
  console.log(dryRun ? '\nDry run only. No records deleted.' : `\nRemoved ${result.removed} duplicate movies.`);

  if (!dryRun) {
    const after = await findDuplicateGroups();
    console.log(`Remaining duplicate groups: ${after.length}`);
  }

  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
