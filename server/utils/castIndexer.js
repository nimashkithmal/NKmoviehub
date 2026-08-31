const fetch = require('node-fetch');
const Movie = require('../models/Movie');
const TVShow = require('../models/TVShow');
const CastTitleCache = require('../models/CastTitleCache');
const CastPerson = require('../models/CastPerson');
const { applyPublicCatalogFilter } = require('./contentPolicy');
const { extractTmdbId, extractTvTmdbId } = require('./trendingPopular');

const EMBED_API = 'https://api.2embed.cc';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CONCURRENCY = 6;
const FETCH_TIMEOUT_MS = 20000;
const REQUEST_GAP_MS = 80;

const state = {
  running: false,
  total: 0,
  processed: 0,
  failed: 0,
  startedAt: null,
  finishedAt: null,
  currentTitle: ''
};

let runChain = Promise.resolve();
let catalogTotal = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toSlug = (name = '') =>
  String(name)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';

const escapeRegex = (value = '') =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function ensureUniqueSlug(baseSlug, excludeId = null) {
  let slug = baseSlug;
  let suffix = 2;
  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await CastPerson.findOne(query).select('_id').lean();
    if (!existing) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function fetchEmbedCast(type, tmdbId) {
  const path = type === 'tvshow' ? 'tv' : 'movie';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${EMBED_API}/${path}?tmdb_id=${encodeURIComponent(tmdbId)}`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function buildPeopleFromEmbed(data = {}) {
  const mapPerson = (person, role, character = '') => ({
    name: String(person.name || '').trim(),
    character: String(character || person.character || '').trim(),
    profile: String(person.profile || '').trim(),
    role,
    tmdbPersonId: String(person.id || person.tmdb_id || person.cast_id || '').trim()
  });

  const cast = (data.cast || []).map((person) => mapPerson(person, 'cast'));
  const directors = (data.crew || [])
    .filter((person) => String(person.job || '').toLowerCase() === 'director')
    .map((person) => mapPerson(person, 'director', 'Director'));

  const seen = new Set();
  const people = [];

  [...cast, ...directors].forEach((person) => {
    const key = `${person.name.toLowerCase()}::${person.role}`;
    if (!person.name || seen.has(key)) return;
    seen.add(key);
    people.push(person);
  });

  return people;
}

function buildPersonSlug(person) {
  const base = toSlug(person.name);
  if (!base) return 'unknown';
  if (person.tmdbPersonId) return `${base}-${person.tmdbPersonId}`;
  return base;
}

async function resolvePersonSlug(person, existingId = null) {
  const preferred = buildPersonSlug(person);
  if (person.tmdbPersonId) return preferred;
  return ensureUniqueSlug(preferred, existingId);
}

async function applyTitleCredits(title, people) {
  const creditBase = {
    entityId: title.entityId,
    type: title.type,
    title: title.title,
    year: title.year || null,
    imageUrl: title.imageUrl || ''
  };

  for (const person of people) {
    const credit = {
      ...creditBase,
      character: person.character || '',
      role: person.role || 'cast'
    };

    let existing = person.tmdbPersonId
      ? await CastPerson.findOne({ tmdbPersonId: person.tmdbPersonId })
          .select('_id slug profile credits name tmdbPersonId')
          .lean()
      : null;

    if (!existing) {
      const preferredSlug = buildPersonSlug(person);
      existing = await CastPerson.findOne({ slug: preferredSlug })
        .select('_id slug profile credits name tmdbPersonId')
        .lean();
    }

    if (!existing && !person.tmdbPersonId) {
      existing = await CastPerson.findOne({ name: person.name, tmdbPersonId: { $in: ['', null] } })
        .select('_id slug profile credits name tmdbPersonId')
        .lean();
    }

    const slug = existing?.slug || (await resolvePersonSlug(person, existing?._id || null));
    const profile = person.profile || existing?.profile || '';

    if (existing) {
      const credits = (existing.credits || []).filter(
        (item) => String(item.entityId) !== String(title.entityId)
      );
      credits.push(credit);
      await CastPerson.updateOne(
        { _id: existing._id },
        {
          $set: {
            name: person.name,
            slug,
            profile,
            credits,
            creditCount: credits.length,
            ...(person.tmdbPersonId ? { tmdbPersonId: person.tmdbPersonId } : {})
          }
        }
      );
      continue;
    }

    try {
      await CastPerson.create({
        name: person.name,
        slug,
        tmdbPersonId: person.tmdbPersonId || '',
        profile,
        credits: [credit],
        creditCount: 1
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;

      const raced = await CastPerson.findOne({
        $or: [{ slug }, ...(person.tmdbPersonId ? [{ tmdbPersonId: person.tmdbPersonId }] : [])]
      })
        .select('_id credits profile')
        .lean();

      if (!raced) throw err;

      const credits = (raced.credits || []).filter(
        (item) => String(item.entityId) !== String(title.entityId)
      );
      credits.push(credit);
      await CastPerson.updateOne(
        { _id: raced._id },
        {
          $set: {
            profile: profile || raced.profile,
            credits,
            creditCount: credits.length,
            ...(person.tmdbPersonId ? { tmdbPersonId: person.tmdbPersonId } : {})
          }
        }
      );
    }
  }
}

async function removeTitleCredits(entityId) {
  await CastPerson.updateMany(
    { 'credits.entityId': entityId },
    { $pull: { credits: { entityId } } }
  );
  await CastPerson.updateMany({}, [{ $set: { creditCount: { $size: '$credits' } } }]);
  await CastPerson.deleteMany({ creditCount: { $lte: 0 } });
}

async function indexTitle(title) {
  state.currentTitle = title.title;

  const cached = await CastTitleCache.findOne({
    entityId: title.entityId,
    type: title.type
  }).lean();

  const isFresh = cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS;
  let people = [];

  if (isFresh) {
    people = cached.cast || [];
  } else {
    try {
      const data = await fetchEmbedCast(title.type, title.tmdbId);
      people = buildPeopleFromEmbed(data);

      await CastTitleCache.findOneAndUpdate(
        { entityId: title.entityId, type: title.type },
        {
          entityId: title.entityId,
          type: title.type,
          tmdbId: title.tmdbId,
          title: title.title,
          year: title.year || null,
          imageUrl: title.imageUrl || '',
          cast: people,
          fetchedAt: new Date()
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      if (cached) {
        people = cached.cast || [];
      } else {
        state.failed += 1;
        throw err;
      }
    }
  }

  await removeTitleCredits(title.entityId);
  await applyTitleCredits(title, people);
  state.processed += 1;
}

async function rebuildPeopleFromCache() {
  const cachedTitles = await CastTitleCache.find({}).lean();
  if (!cachedTitles.length) return 0;

  await CastPerson.deleteMany({});

  for (const cached of cachedTitles) {
    const title = {
      entityId: cached.entityId,
      type: cached.type,
      title: cached.title,
      year: cached.year,
      imageUrl: cached.imageUrl
    };
    await applyTitleCredits(title, cached.cast || []);
  }

  await CastPerson.updateMany({}, [{ $set: { creditCount: { $size: '$credits' } } }]);
  await CastPerson.deleteMany({ creditCount: { $lte: 0 } });
  return cachedTitles.length;
}

async function getTitlesNeedingIndex(titles) {
  const cached = await CastTitleCache.find({
    fetchedAt: { $gte: new Date(Date.now() - CACHE_TTL_MS) }
  })
    .select('entityId type')
    .lean();

  const freshKeys = new Set(cached.map((item) => `${item.type}:${String(item.entityId)}`));
  return titles.filter((title) => !freshKeys.has(`${title.type}:${String(title.entityId)}`));
}

async function loadCatalogTitles() {
  const catalogFilter = applyPublicCatalogFilter({
    status: { $in: ['active', 'coming_soon'] }
  });

  const [movies, tvShows] = await Promise.all([
    Movie.find(catalogFilter).select('_id title year imageUrl movieUrl').lean(),
    TVShow.find(catalogFilter).select('_id title year imageUrl showUrl episodes.episodeUrl').lean()
  ]);

  const titles = [];

  movies.forEach((movie) => {
    const tmdbId = extractTmdbId(movie.movieUrl);
    if (!tmdbId) return;
    titles.push({
      entityId: movie._id,
      type: 'movie',
      tmdbId,
      title: movie.title,
      year: movie.year,
      imageUrl: movie.imageUrl || ''
    });
  });

  tvShows.forEach((show) => {
    const tmdbId = extractTvTmdbId(show);
    if (!tmdbId) return;
    titles.push({
      entityId: show._id,
      type: 'tvshow',
      tmdbId,
      title: show.title,
      year: show.year,
      imageUrl: show.imageUrl || ''
    });
  });

  return titles;
}

async function runIndexer() {
  if (state.running) return;

  state.running = true;
  state.startedAt = new Date();
  state.finishedAt = null;
  state.processed = 0;
  state.failed = 0;
  state.currentTitle = '';

  try {
    const catalogTitles = await loadCatalogTitles();
    catalogTotal = catalogTitles.length;
    state.total = catalogTitles.length;

    const [peopleCount, cacheCount] = await Promise.all([
      CastPerson.countDocuments(),
      CastTitleCache.countDocuments()
    ]);

    if (peopleCount === 0 && cacheCount > 0) {
      state.currentTitle = 'Restoring cast collection…';
      await rebuildPeopleFromCache();
    }

    const titles = await getTitlesNeedingIndex(catalogTitles);
    if (!titles.length) {
      state.processed = catalogTitles.length;
      return;
    }

    let cursor = 0;

    const worker = async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= titles.length) break;

        const title = titles[index];
        try {
          await indexTitle(title);
        } catch (err) {
          console.warn(`Cast index failed for ${title.title}:`, err.message);
        }

        await sleep(REQUEST_GAP_MS);
      }
    };

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    await Promise.all(workers);

    state.processed = catalogTitles.length;

    await CastPerson.updateMany({}, [{ $set: { creditCount: { $size: '$credits' } } }]);
    await CastPerson.deleteMany({ creditCount: { $lte: 0 } });
  } catch (err) {
    console.error('Cast indexer error:', err.message);
  } finally {
    state.running = false;
    state.finishedAt = new Date();
    state.currentTitle = '';
  }
}

function startCastIndexer() {
  runChain = runChain
    .then(() => CastPerson.syncIndexes())
    .then(() => {
      console.log('✅ CastPerson indexes synced');
    })
    .catch((err) => {
      console.warn('CastPerson index sync warning:', err.message);
    })
    .then(() => runIndexer())
    .catch((err) => {
      console.error('Cast indexer chain error:', err.message);
    });
  return runChain;
}

function getCastIndexerStatus() {
  const percent = state.total > 0
    ? Math.min(100, Math.round((state.processed / state.total) * 100))
    : 0;

  return {
    running: state.running,
    total: state.total,
    processed: state.processed,
    failed: state.failed,
    percent,
    currentTitle: state.currentTitle,
    startedAt: state.startedAt,
    finishedAt: state.finishedAt
  };
}

async function getCastStats() {
  const [people, indexedTitles, totalTitles] = await Promise.all([
    CastPerson.countDocuments(),
    CastTitleCache.countDocuments(),
    catalogTotal > 0
      ? Promise.resolve(catalogTotal)
      : loadCatalogTitles().then((titles) => {
          catalogTotal = titles.length;
          return titles.length;
        })
  ]);

  return {
    people,
    indexedTitles,
    totalTitles
  };
}

async function searchCastPeople({ q = '', page = 1, limit = 48, sort = 'popular' } = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(96, Math.max(12, parseInt(limit, 10) || 48));
  const skip = (safePage - 1) * safeLimit;
  const query = String(q || '').trim();

  const filter = query
    ? { name: { $regex: escapeRegex(query), $options: 'i' } }
    : {};

  const sortSpec = sort === 'name'
    ? { name: 1 }
    : { creditCount: -1, name: 1 };

  const [items, total] = await Promise.all([
    CastPerson.find(filter)
      .select('name slug profile creditCount')
      .sort(sortSpec)
      .skip(skip)
      .limit(safeLimit)
      .lean(),
    CastPerson.countDocuments(filter)
  ]);

  return {
    items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.max(1, Math.ceil(total / safeLimit))
    }
  };
}

async function getCastPersonBySlug(slug) {
  return CastPerson.findOne({ slug }).lean();
}

module.exports = {
  startCastIndexer,
  getCastIndexerStatus,
  getCastStats,
  searchCastPeople,
  getCastPersonBySlug
};
