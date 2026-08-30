#!/usr/bin/env node
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../config.env') });

const Movie = require('../models/Movie');
const TVShow = require('../models/TVShow');
const { evaluateContentPolicy } = require('../utils/contentPolicy');

const enforceModel = async (Model, label) => {
  const docs = await Model.find({}).select('title description tagline genre status policyRestricted policyRestrictedReason');
  let restricted = 0;
  let cleared = 0;

  for (const doc of docs) {
    const result = evaluateContentPolicy(doc);

    if (result.restricted) {
      if (!doc.policyRestricted || doc.status === 'active' || doc.status === 'coming_soon') {
        restricted += 1;
        doc.policyRestricted = true;
        doc.policyRestrictedReason = result.reason;
        if (doc.status === 'active' || doc.status === 'coming_soon') {
          doc.status = 'inactive';
        }
        await doc.save();
        console.log(`[${label}] restricted: ${doc.title}`);
      }
      continue;
    }

    if (doc.policyRestricted) {
      cleared += 1;
      doc.policyRestricted = false;
      doc.policyRestrictedReason = '';
      await doc.save();
      console.log(`[${label}] cleared: ${doc.title}`);
    }
  }

  return { restricted, cleared };
};

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const movies = await enforceModel(Movie, 'movie');
  const tv = await enforceModel(TVShow, 'tv');
  console.log(
    `Done. Restricted ${movies.restricted} movies, cleared ${movies.cleared}. Restricted ${tv.restricted} TV shows, cleared ${tv.cleared}.`
  );
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
