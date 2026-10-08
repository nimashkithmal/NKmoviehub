/**
 * TMDB-based 18+ classification + rating repair for movies and TV shows.
 *
 * A title is 18+ when TMDB flags it `adult`, or when the first country (in
 * PRIORITY order) that has a certification rates it at an adults-only level.
 * Titles with no TMDB match or no certification are left alone — we never
 * label 18+ without evidence.
 *
 * Also fills imdbRating from TMDB vote_average when it is stored as 0.
 */
const { fetchTmdbJson, hasTmdbAuth } = require('./tmdb');
const { extractTmdbId, extractTvTmdbId } = require('./trendingPopular');

/** Adults-only certifications per country (movies + TV). Compared upper-case, spaces stripped. */
const ADULT_CERTS = {
  US: ['NC-17', 'X', 'TV-MA'],
  GB: ['18', 'R18'],
  AU: ['R18+', 'X18+'],
  IN: ['A'],
  IE: ['18'],
  NZ: ['R18'],
  DE: ['18'],
  FR: ['18'],
  NL: ['18'],
  ES: ['18'],
  BR: ['18'],
  KR: ['18', '19', '청소년관람불가']
};
const PRIORITY = Object.keys(ADULT_CERTS);

const BACKFILL_STARTUP_DELAY_MS = 90 * 1000;
const BACKFILL_INTERVAL_MS = 30 * 60 * 1000;
const BACKFILL_BATCH = 40;
const CONCURRENCY = 4;
/** Below this many TMDB votes the score is too noisy to show (stays N/A). */
const MIN_VOTES_FOR_RATING = 5;

const normCert = (value) => String(value || '').toUpperCase().replace(/\s+/g, '');

/** @param {Array<{country: string, certs: string[]}>} byCountry */
function decideFromCertifications(byCountry) {
  for (const country of PRIORITY) {
    const row = byCountry.find((r) => r.country === country);
    const certs = (row?.certs || []).map(normCert).filter(Boolean);
    if (!certs.length) continue;
    const adultSet = new Set(ADULT_CERTS[country].map(normCert));
    const hit = certs.find((c) => adultSet.has(c));
    return { mature: Boolean(hit), certification: `${country}:${hit || certs[0]}` };
  }
  return { mature: false, certification: '' };
}

function movieCertifications(details) {
  return (details?.release_dates?.results || []).map((r) => ({
    country: r.iso_3166_1,
    certs: (r.release_dates || []).map((d) => d.certification)
  }));
}

function tvCertifications(details) {
  return (details?.content_ratings?.results || []).map((r) => ({
    country: r.iso_3166_1,
    certs: [r.rating]
  }));
}

const normTitle = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

/** Exact title + year match only — avoids tagging the wrong title. */
async function searchTmdbId(kind, title, year) {
  if (!title) return '';
  const isTv = kind === 'tv';
  const data = await fetchTmdbJson(isTv ? '/search/tv' : '/search/movie', {
    query: title,
    include_adult: 'true',
    ...(year ? { [isTv ? 'first_air_date_year' : 'year']: year } : {})
  });
  const wanted = normTitle(title);
  const match = (data?.results || []).find((row) => {
    const names = [row.title, row.name, row.original_title, row.original_name].map(normTitle);
    const date = String((isTv ? row.first_air_date : row.release_date) || '');
    return names.includes(wanted) && (!year || date.startsWith(String(year)));
  });
  return match?.id != null ? String(match.id) : '';
}

async function resolveTmdbId(kind, doc) {
  const direct =
    kind === 'tv'
      ? String(doc.tmdbId || '').trim() || extractTvTmdbId(doc)
      : String(doc.tmdbId || '').trim() || extractTmdbId(doc.movieUrl);
  if (direct) return String(direct);

  const urls = kind === 'tv' ? [doc.showUrl] : [doc.movieUrl, doc.manualPlayUrl];
  const imdbId = urls.map((u) => String(u || '').match(/tt\d{5,}/i)?.[0]).find(Boolean);
  if (imdbId) {
    const found = await fetchTmdbJson(`/find/${imdbId}`, { external_source: 'imdb_id' });
    const row = (kind === 'tv' ? found?.tv_results : found?.movie_results)?.[0];
    if (row?.id != null) return String(row.id);
  }

  return searchTmdbId(kind, doc.title, doc.year);
}

/**
 * Classify one title against TMDB.
 * @returns {Promise<null | {tmdbId: string, mature: boolean, adult: boolean, certification: string, voteAverage: number, voteCount: number}>}
 *   null when no TMDB match was found.
 */
async function classifyTitle(kind, doc) {
  const tmdbId = await resolveTmdbId(kind, doc);
  if (!tmdbId) return null;

  const isTv = kind === 'tv';
  let details;
  try {
    details = await fetchTmdbJson(`/${isTv ? 'tv' : 'movie'}/${tmdbId}`, {
      append_to_response: isTv ? 'content_ratings' : 'release_dates'
    });
  } catch (err) {
    if (/HTTP 404/.test(err.message)) return null;
    throw err;
  }

  const adult = details?.adult === true;
  const decision = decideFromCertifications(
    isTv ? tvCertifications(details) : movieCertifications(details)
  );
  return {
    tmdbId,
    adult,
    mature: adult || decision.mature,
    certification: decision.certification,
    voteAverage: Number(details?.vote_average) || 0,
    voteCount: Number(details?.vote_count) || 0
  };
}

/** Classify + persist. Never clears an 18+ flag an admin set; only repairs 0 ratings. */
async function classifyAndSave(Model, kind, id) {
  const doc = await Model.findById(id).lean();
  if (!doc) return false;

  const result = await classifyTitle(kind, doc);
  const update = { ageCheckedAt: new Date() };
  if (result) {
    update.ageCertification = result.certification;
    if (result.mature && !doc.matureContent) update.matureContent = true;
    if (!doc.tmdbId) update.tmdbId = result.tmdbId;
    const stored = Number(doc.imdbRating) || 0;
    if (stored <= 0 && result.voteCount >= MIN_VOTES_FOR_RATING && result.voteAverage > 0) {
      update.imdbRating = Math.round(Math.min(10, result.voteAverage) * 10) / 10;
    }
  }
  await Model.updateOne({ _id: id }, { $set: update });
  return Boolean(update.matureContent || update.imdbRating);
}

const targets = () => [
  { Model: require('../models/Movie'), kind: 'movie' },
  { Model: require('../models/TVShow'), kind: 'tv' }
];

let running = false;

/** Process titles never checked against TMDB (existing catalog + anything new). */
async function runBackfill() {
  if (running || !hasTmdbAuth()) return;
  running = true;
  let checked = 0;
  let changed = 0;
  try {
    for (const { Model, kind } of targets()) {
      const failed = new Set();
      for (;;) {
        const batch = await Model.find({
          ageCheckedAt: null,
          _id: { $nin: [...failed] }
        })
          .select('_id')
          .limit(BACKFILL_BATCH)
          .lean();
        if (!batch.length) break;

        for (let i = 0; i < batch.length; i += CONCURRENCY) {
          const slice = batch.slice(i, i + CONCURRENCY);
          const results = await Promise.allSettled(
            slice.map((d) => classifyAndSave(Model, kind, d._id))
          );
          results.forEach((r, idx) => {
            if (r.status === 'fulfilled') {
              checked += 1;
              if (r.value) changed += 1;
            } else {
              // Network / TMDB error: retry on the next scheduled run
              failed.add(slice[idx]._id);
            }
          });
        }
      }
    }
  } catch (err) {
    console.error('Age classification backfill error:', err.message || err);
  } finally {
    running = false;
  }

  if (changed > 0) {
    require('./publicCatalogCache').invalidatePublicCatalogCaches();
  }
  if (checked > 0) {
    console.log(`🔞 TMDB age/rating check: ${checked} titles checked, ${changed} updated`);
  }
}

/** Fire-and-forget check for a newly added title. */
function scheduleTitleCheck(Model, kind, id) {
  if (!hasTmdbAuth()) return;
  setTimeout(() => {
    classifyAndSave(Model, kind, id)
      .then((changed) => {
        if (changed) require('./publicCatalogCache').invalidatePublicCatalogCaches();
      })
      .catch((err) => {
        // Left unchecked — the periodic backfill retries it
        console.warn('TMDB age check failed:', err.message || err);
      });
  }, 0);
}

/** Mongoose plugin: check every newly created title against TMDB. */
function ageClassificationPlugin(schema, { kind }) {
  schema.pre('save', function markNew(next) {
    this.$locals.wasNew = this.isNew;
    next();
  });
  schema.post('save', function checkNew(doc) {
    if (doc.$locals.wasNew) scheduleTitleCheck(doc.constructor, kind, doc._id);
  });
}

function startAgeClassificationIndexer() {
  setTimeout(runBackfill, BACKFILL_STARTUP_DELAY_MS);
  setInterval(runBackfill, BACKFILL_INTERVAL_MS);
  console.log('🔞 TMDB 18+ / rating check scheduled (first run in 90s, then every 30 min)');
}

module.exports = {
  ADULT_CERTS,
  decideFromCertifications,
  classifyTitle,
  classifyAndSave,
  runBackfill,
  ageClassificationPlugin,
  startAgeClassificationIndexer
};
