#!/usr/bin/env node
/**
 * Full-system AdSense catalog + cast audit / cleanup
 *
 * Usage:
 *   npm run adsense:audit
 *   npm run adsense:cleanup
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
const Banner = require('../models/Banner');
const CastPerson = require('../models/CastPerson');
const CastTitleCache = require('../models/CastTitleCache');
const PendingTitle = require('../models/PendingTitle');
const {
  evaluateContentPolicy,
  evaluatePersonPolicy,
  isAdsenseSafeEpisodeTitle,
  isThinContent,
  policyUpdateFields,
  personPolicyUpdateFields,
  MIN_OVERVIEW_CHARS
} = require('../utils/contentPolicy');

const doCleanup = process.argv.includes('--cleanup');

const connect = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI / MONGO_URI missing');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 25000 });
};

const livePolicy = (doc) =>
  evaluateContentPolicy({
    title: doc.title,
    description: doc.description,
    tagline: doc.tagline,
    genre: doc.genre,
    policyRestricted: false,
    adult: doc.adult,
    isAdult: doc.isAdult
  });

async function scanTitles(Model, kind) {
  const docs = await Model.find({})
    .select(
      kind === 'tvshow'
        ? 'title description tagline genre status imageUrl images bannerUrl episodes policyRestricted adsenseSafe'
        : 'title description tagline genre status imageUrl images bannerUrl policyRestricted adsenseSafe'
    )
    .lean();

  const unsafe = [];
  const thin = [];
  let episodesScanned = 0;
  let unsafeEpisodes = 0;

  for (const doc of docs) {
    const policy = livePolicy(doc);
    if (policy.restricted || doc.policyRestricted) {
      if (policy.restricted || doc.policyRestricted) {
        unsafe.push({
          id: String(doc._id),
          kind,
          title: doc.title,
          reason: policy.reason || doc.policyRestrictedReason || 'policyRestricted'
        });
      }
    }
    if (isThinContent(doc)) {
      thin.push({ id: String(doc._id), kind, title: doc.title });
    }

    if (kind === 'tvshow' && Array.isArray(doc.episodes)) {
      for (const ep of doc.episodes) {
        episodesScanned += 1;
        const epTitle = ep.episodeTitle || '';
        if (epTitle && !isAdsenseSafeEpisodeTitle(epTitle)) {
          unsafeEpisodes += 1;
          unsafe.push({
            id: String(doc._id),
            kind: 'episode',
            title: `${doc.title} — ${epTitle}`,
            reason: 'Unsafe episode title',
            episodeNumber: ep.episodeNumber,
            seasonNumber: ep.seasonNumber
          });
        }
      }
    }
  }

  // Dedupe title-level unsafe (episode rows may duplicate show id)
  const titleUnsafe = unsafe.filter((row) => row.kind === kind);
  const uniqueTitleUnsafe = [];
  const seen = new Set();
  for (const row of titleUnsafe) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    uniqueTitleUnsafe.push(row);
  }

  return {
    total: docs.length,
    unsafe: uniqueTitleUnsafe,
    unsafeEpisodeRows: unsafe.filter((row) => row.kind === 'episode'),
    thin,
    episodesScanned,
    unsafeEpisodes
  };
}

async function scanPeople() {
  const people = await CastPerson.find({})
    .select('name slug character credits profile policyRestricted adsenseSafe')
    .lean();

  const unsafe = [];
  for (const person of people) {
    const policy = evaluatePersonPolicy({
      ...person,
      policyRestricted: false,
      adsenseSafe: true
    });

    // Also unsafe if any credit title text fails content policy
    const creditHits = (person.credits || []).filter((credit) =>
      livePolicy({ title: credit.title, description: '', genre: '' }).restricted
    );

    if (policy.restricted || creditHits.length > 0 || person.policyRestricted) {
      unsafe.push({
        id: String(person._id),
        kind: 'person',
        title: person.name,
        slug: person.slug,
        reason:
          policy.reason ||
          (creditHits.length
            ? `Linked to unsafe title credits (${creditHits.length})`
            : person.policyRestrictedReason || 'policyRestricted')
      });
    }
  }

  return { total: people.length, unsafe };
}

async function scanPending() {
  const rows = await PendingTitle.find({ status: 'pending' })
    .select('title description genre tagline type status')
    .lean();
  const unsafe = [];
  for (const row of rows) {
    const policy = livePolicy(row);
    if (policy.restricted) {
      unsafe.push({
        id: String(row._id),
        kind: 'pending',
        title: row.title,
        reason: policy.reason
      });
    }
  }
  return { total: rows.length, unsafe };
}

async function scanBanners() {
  const banners = await Banner.find({})
    .populate('movie', 'title description tagline genre policyRestricted adsenseSafe')
    .populate('tvShow', 'title description tagline genre policyRestricted adsenseSafe')
    .lean();

  const unsafe = [];
  for (const banner of banners) {
    const linked = banner.movie || banner.tvShow;
    if (!linked) continue;
    const policy = livePolicy(linked);
    if (policy.restricted || linked.policyRestricted) {
      unsafe.push({
        id: String(banner._id),
        kind: 'banner',
        title: banner.title || linked.title,
        reason: policy.reason || 'Linked unsafe title',
        status: banner.status
      });
    }
  }
  return { total: banners.length, unsafe };
}

async function cleanupTitles(Model, unsafeRows) {
  let updated = 0;
  for (const row of unsafeRows) {
    const doc = await Model.findById(row.id);
    if (!doc) continue;
    const policy = livePolicy(doc);
    if (!policy.restricted) continue;
    Object.assign(doc, policyUpdateFields(policy, doc.status));
    await doc.save();
    updated += 1;
  }
  return updated;
}

async function rehabilitateTitles(Model) {
  const flagged = await Model.find({
    $or: [{ policyRestricted: true }, { adsenseSafe: false }]
  });
  let cleared = 0;
  for (const doc of flagged) {
    const policy = livePolicy(doc);
    if (policy.restricted) continue;
    Object.assign(doc, policyUpdateFields(policy, doc.status));
    await doc.save();
    cleared += 1;
  }
  return cleared;
}

async function cleanupEpisodes() {
  const shows = await TVShow.find({ 'episodes.0': { $exists: true } }).select(
    'title episodes'
  );
  let cleaned = 0;
  for (const show of shows) {
    let changed = false;
    show.episodes = (show.episodes || []).map((ep) => {
      if (ep.episodeTitle && !isAdsenseSafeEpisodeTitle(ep.episodeTitle)) {
        ep.episodeTitle = '';
        changed = true;
        cleaned += 1;
      }
      return ep;
    });
    if (changed) await show.save();
  }
  return cleaned;
}

async function cleanupPeople(unsafePeople) {
  let flagged = 0;
  let deleted = 0;

  // Flag/delete people from scan
  for (const row of unsafePeople) {
    const person = await CastPerson.findById(row.id);
    if (!person) continue;

    const policy = evaluatePersonPolicy({
      name: person.name,
      policyRestricted: false,
      adsenseSafe: true
    });

    // Strip credits that point at restricted catalog titles
    const creditIds = (person.credits || []).map((c) => c.entityId);
    const [badMovies, badShows] = await Promise.all([
      Movie.find({
        _id: { $in: creditIds },
        $or: [{ policyRestricted: true }, { adsenseSafe: false }]
      })
        .select('_id')
        .lean(),
      TVShow.find({
        _id: { $in: creditIds },
        $or: [{ policyRestricted: true }, { adsenseSafe: false }]
      })
        .select('_id')
        .lean()
    ]);
    const badSet = new Set(
      [...badMovies, ...badShows].map((doc) => String(doc._id))
    );

    person.credits = (person.credits || []).filter((credit) => {
      if (badSet.has(String(credit.entityId))) return false;
      if (livePolicy({ title: credit.title, description: '', genre: '' }).restricted) {
        return false;
      }
      return true;
    });
    person.creditCount = person.credits.length;

    if (policy.restricted || person.creditCount === 0) {
      await CastPerson.deleteOne({ _id: person._id });
      deleted += 1;
      continue;
    }

    Object.assign(person, personPolicyUpdateFields({ restricted: false }));
    await person.save();
  }

  // Second pass: any remaining people failing name policy
  const all = await CastPerson.find({}).select('name');
  for (const person of all) {
    const policy = evaluatePersonPolicy({ name: person.name });
    if (!policy.restricted) continue;
    await CastPerson.deleteOne({ _id: person._id });
    deleted += 1;
    flagged += 1;
  }

  return { flagged, deleted };
}

async function cleanupPending(unsafePending) {
  let dismissed = 0;
  for (const row of unsafePending) {
    await PendingTitle.updateOne(
      { _id: row.id },
      { $set: { status: 'dismissed', dismissedAt: new Date() } }
    );
    dismissed += 1;
  }
  return dismissed;
}

async function cleanupBanners(unsafeBanners) {
  let deactivated = 0;
  for (const row of unsafeBanners) {
    await Banner.updateOne({ _id: row.id }, { $set: { status: 'inactive' } });
    deactivated += 1;
  }
  return deactivated;
}

async function purgeCastCachesForRestricted() {
  const restrictedIds = [
    ...(
      await Movie.find({
        $or: [{ policyRestricted: true }, { adsenseSafe: false }]
      })
        .select('_id')
        .lean()
    ).map((d) => d._id),
    ...(
      await TVShow.find({
        $or: [{ policyRestricted: true }, { adsenseSafe: false }]
      })
        .select('_id')
        .lean()
    ).map((d) => d._id)
  ];

  if (!restrictedIds.length) return 0;
  const result = await CastTitleCache.deleteMany({ entityId: { $in: restrictedIds } });
  await CastPerson.updateMany(
    { 'credits.entityId': { $in: restrictedIds } },
    { $pull: { credits: { entityId: { $in: restrictedIds } } } }
  );
  await CastPerson.updateMany({}, [{ $set: { creditCount: { $size: '$credits' } } }]);
  await CastPerson.deleteMany({ creditCount: { $lte: 0 } });
  return result.deletedCount || 0;
}

function printSection(label, lines) {
  console.log(`\n=== ${label} ===`);
  lines.forEach((line) => console.log(line));
}

(async () => {
  await connect();

  console.log('NK Movie Hub — FULL AdSense system audit');
  console.log(`Mode: ${doCleanup ? 'CLEANUP' : 'AUDIT'}`);

  const movies = await scanTitles(Movie, 'movie');
  const tvShows = await scanTitles(TVShow, 'tvshow');
  const people = await scanPeople();
  const pending = await scanPending();
  const banners = await scanBanners();

  const moviesScanned = movies.total;
  const tvScanned = tvShows.total;
  const episodesScanned = tvShows.episodesScanned;
  const peopleScanned = people.total;

  const unsafeRecords = [
    ...movies.unsafe,
    ...tvShows.unsafe,
    ...tvShows.unsafeEpisodeRows,
    ...people.unsafe,
    ...pending.unsafe,
    ...banners.unsafe
  ];

  printSection('Scan totals', [
    `Movies scanned: ${moviesScanned}`,
    `TV shows scanned: ${tvScanned}`,
    `Episodes scanned: ${episodesScanned}`,
    `Actors/people scanned: ${peopleScanned}`,
    `Pending titles scanned: ${pending.total}`,
    `Banners scanned: ${banners.total}`,
    `Thin movies/TV (missing overview/poster): ${movies.thin.length + tvShows.thin.length}`,
    `Unsafe records found: ${unsafeRecords.length}`
  ]);

  if (unsafeRecords.length) {
    console.log('\nUnsafe samples (up to 40):');
    unsafeRecords.slice(0, 40).forEach((row) => {
      console.log(`  - [${row.kind}] ${row.title} (${row.id}) :: ${row.reason}`);
    });
  }

  let removed = {
    movies: 0,
    tv: 0,
    episodes: 0,
    peopleDeleted: 0,
    pending: 0,
    banners: 0,
    caches: 0,
    rehabilitated: 0
  };

  if (doCleanup) {
    removed.rehabilitated =
      (await rehabilitateTitles(Movie)) + (await rehabilitateTitles(TVShow));
    removed.movies = await cleanupTitles(Movie, movies.unsafe);
    removed.tv = await cleanupTitles(TVShow, tvShows.unsafe);
    removed.episodes = await cleanupEpisodes();
    const peopleCleanup = await cleanupPeople(people.unsafe);
    removed.peopleDeleted = peopleCleanup.deleted;
    removed.pending = await cleanupPending(pending.unsafe);
    removed.banners = await cleanupBanners(banners.unsafe);
    removed.caches = await purgeCastCachesForRestricted();

    console.log('\n=== Cleanup results ===');
    console.log(`Movies deactivated/flagged: ${removed.movies}`);
    console.log(`TV shows deactivated/flagged: ${removed.tv}`);
    console.log(`Unsafe episode titles cleared: ${removed.episodes}`);
    console.log(`Actors/people removed: ${removed.peopleDeleted}`);
    console.log(`Pending titles dismissed: ${removed.pending}`);
    console.log(`Banners deactivated: ${removed.banners}`);
    console.log(`Cast title caches purged: ${removed.caches}`);
    console.log(`Stale flags rehabilitated: ${removed.rehabilitated}`);
  }

  // Second pass audit after cleanup (or same pass if audit-only)
  const movies2 = doCleanup ? await scanTitles(Movie, 'movie') : movies;
  const tv2 = doCleanup ? await scanTitles(TVShow, 'tvshow') : tvShows;
  const people2 = doCleanup ? await scanPeople() : people;
  const pending2 = doCleanup ? await scanPending() : pending;
  const banners2 = doCleanup ? await scanBanners() : banners;

  const remainingUnsafe = [
    ...movies2.unsafe.filter((row) => {
      // Count only still-live-restricted (already inactive still listed as unsafe — OK)
      return true;
    }),
    ...tv2.unsafe,
    ...tv2.unsafeEpisodeRows,
    ...people2.unsafe,
    ...pending2.unsafe,
    ...banners2.unsafe.filter((b) => b.status !== 'inactive')
  ];

  // For "Remaining adult content: 0" — only count PUBLICLY reachable:
  // active/coming_soon titles that fail policy, active people, pending, active banners
  const publicMovieUnsafe = (
    await Movie.find({
      status: { $in: ['active', 'coming_soon'] },
      $or: [{ policyRestricted: true }, { adsenseSafe: false }]
    })
      .select('title')
      .lean()
  ).length;

  // Also live-scan active titles that aren't flagged yet
  const activeMovies = await Movie.find({ status: { $in: ['active', 'coming_soon'] } })
    .select('title description tagline genre policyRestricted adsenseSafe')
    .lean();
  let liveActiveUnsafeMovies = 0;
  for (const doc of activeMovies) {
    if (livePolicy(doc).restricted) liveActiveUnsafeMovies += 1;
  }

  const activeShows = await TVShow.find({ status: { $in: ['active', 'coming_soon'] } })
    .select('title description tagline genre policyRestricted adsenseSafe episodes')
    .lean();
  let liveActiveUnsafeShows = 0;
  let liveUnsafeEpisodesPublic = 0;
  for (const doc of activeShows) {
    if (livePolicy(doc).restricted) liveActiveUnsafeShows += 1;
    for (const ep of doc.episodes || []) {
      if (ep.episodeTitle && !isAdsenseSafeEpisodeTitle(ep.episodeTitle)) {
        liveUnsafeEpisodesPublic += 1;
      }
    }
  }

  const publicPeopleUnsafe = await CastPerson.countDocuments({
    $or: [{ policyRestricted: true }, { adsenseSafe: false }]
  });
  // Live name scan on remaining public people
  const publicPeople = await CastPerson.find({
    policyRestricted: { $ne: true },
    adsenseSafe: { $ne: false }
  })
    .select('name')
    .lean();
  let liveUnsafePeople = 0;
  for (const person of publicPeople) {
    if (evaluatePersonPolicy({ name: person.name }).restricted) liveUnsafePeople += 1;
  }

  const publicPendingUnsafe = pending2.unsafe.length;
  const publicBannerUnsafe = (
    await Banner.find({ status: 'active' })
      .populate('movie', 'title description tagline genre')
      .populate('tvShow', 'title description tagline genre')
      .lean()
  ).filter((b) => {
    const linked = b.movie || b.tvShow;
    return linked && livePolicy(linked).restricted;
  }).length;

  const remainingPublic =
    liveActiveUnsafeMovies +
    liveActiveUnsafeShows +
    liveUnsafeEpisodesPublic +
    publicPeopleUnsafe +
    liveUnsafePeople +
    publicPendingUnsafe +
    publicBannerUnsafe;

  printSection('FINAL REPORT', [
    `Movies scanned: ${moviesScanned}`,
    `TV shows scanned: ${tvScanned}`,
    `Episodes scanned: ${episodesScanned}`,
    `Actors/people scanned: ${peopleScanned}`,
    `Unsafe records found: ${unsafeRecords.length}`,
    `Unsafe records removed/deactivated: ${
      removed.movies +
      removed.tv +
      removed.episodes +
      removed.peopleDeleted +
      removed.pending +
      removed.banners
    }`,
    `Unsafe URLs removed: ${removed.movies + removed.tv + removed.peopleDeleted} (titles/people no longer public)`,
    `Unsafe sitemap entries removed: ${removed.movies + removed.tv} (inactive titles excluded from sitemap)`,
    `Remaining adult/sexual/porn-related content (public surfaces): ${remainingPublic}`,
    `  - active unsafe movies (live): ${liveActiveUnsafeMovies}`,
    `  - active unsafe TV: ${liveActiveUnsafeShows}`,
    `  - public unsafe episode titles: ${liveUnsafeEpisodesPublic}`,
    `  - flagged people: ${publicPeopleUnsafe}`,
    `  - live unsafe people names: ${liveUnsafePeople}`,
    `  - pending unsafe: ${publicPendingUnsafe}`,
    `  - active unsafe banners: ${publicBannerUnsafe}`,
    `Already-deactivated flagged movies (kept in DB, not public): ${publicMovieUnsafe}`
  ]);

  if (remainingPublic > 0) {
    console.log('\nWARNING: Public surfaces still have unsafe items. Re-run cleanup or inspect manually.');
    process.exitCode = 2;
  } else {
    console.log('\nOK: No remaining adult/sexual/porn-related content on public surfaces.');
  }

  await mongoose.disconnect();
})().catch(async (error) => {
  console.error('AdSense full audit failed:', error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    /* ignore */
  }
  process.exit(1);
});
