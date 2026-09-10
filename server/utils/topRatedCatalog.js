/**
 * Shared Top Rated catalog ranking — filters sync junk / fake 9–10 IMDb scores.
 */
const WEAK_TOP_RATED_TITLE =
  /live at|live in|concert|greatest (video )?hits|video hits|unplugged|\btour\b|festival|stand-?up|comedy special|behind the scenes|making of|karaoke|music video|tribute to|best of|video show|video capture|songs from|top \d+ cars|in space$/i;

const TOP_RATED_TITLE_BOOST =
  /\b(lord of the rings|hobbit|interstellar|inception|the matrix|godfather|dark knight|pulp fiction|fight club|forrest gump|gladiator|avengers|spider-?man|star wars|harry potter|jurassic|terminator|alien\b|joker|parasite|whiplash|the prestige|the departed|goodfellas|shawshank|schindler|saving private|spirited away|princess mononoke|deadpool|iron man|batman|superman|wonder woman|justice league|john wick|mission:? impossible|indiana jones|back to the future|die hard|silence of the lambs|\bse7en\b|\bseven\b|django|mad max|blade runner|\bdune\b|oppenheimer|jaws|rocky|titanic|avatar|casablanca|psycho|vertigo|gone with the wind|12 angry men|good will hunting|the green mile|american history x|the usual suspects|no country for old men|there will be blood|the social network|la la land|get out|knives out|everything everywhere|top gun|guardians of the galaxy|black panther|doctor strange|captain america|thor\b|wolverine|x-men|fantastic four|transformers|pirates of the caribbean)\b/i;

const hasPoster = (doc = {}) =>
  Boolean(
    (doc.imageUrl && String(doc.imageUrl).trim()) ||
      (Array.isArray(doc.images) && doc.images.some(Boolean))
  );

const isCatalogJunk = (doc = {}) => {
  if (!hasPoster(doc)) return true;
  const rating = Number(doc.imdbRating) || 0;
  const siteVotes = Number(doc.totalRatings) || 0;
  if (rating <= 0) return true;
  if (rating >= 9.7 && siteVotes === 0) return true;
  return false;
};

const isCredibleRating = (doc = {}) => {
  const rating = Number(doc.imdbRating) || 0;
  return rating >= 5.8 && rating <= 9.3;
};

const isWeakTopRatedGenre = (genre = '') => {
  const raw = String(genre || '').trim();
  if (/^documentary\b/i.test(raw)) return true;
  const parts = raw
    .split(/[,/|]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) return false;
  return parts.every((part) =>
    /^(music|documentary|tv movie|reality)$/i.test(part)
  );
};

const isTopRatedCandidate = (doc = {}) => {
  if (isCatalogJunk(doc) || !isCredibleRating(doc) || !hasPoster(doc)) return false;
  const rating = Number(doc.imdbRating) || 0;
  const siteVotes = Number(doc.totalRatings) || 0;
  const year = Number(doc.year) || 0;
  const currentYear = new Date().getFullYear();
  if (year >= currentYear || year < 1970) return false;
  if (doc.releaseDate) {
    const iso = String(doc.releaseDate).trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    const todayStr = new Date().toISOString().slice(0, 10);
    if (iso && iso > todayStr) return false;
  }
  if (siteVotes === 0 && rating >= 8.8) return false;
  if (rating < 7) return false;
  if (WEAK_TOP_RATED_TITLE.test(String(doc.title || ''))) return false;
  if (isWeakTopRatedGenre(doc.genre)) return false;
  return true;
};

const topRatedSortScore = (doc = {}) => {
  const rating = Number(doc.imdbRating) || 0;
  const boost = TOP_RATED_TITLE_BOOST.test(String(doc.title || '')) ? 100 : 0;
  const votes = Number(doc.totalRatings) || 0;
  return boost + rating + Math.min(votes, 50) / 100;
};

const buildTopRatedMongoFilter = (baseFilter = {}) => {
  const currentYear = new Date().getFullYear();
  return {
    ...baseFilter,
    year: { $lte: currentYear - 1, $gte: 1970 },
    $or: [
      { imdbRating: { $gte: 7, $lt: 8.8 } },
      { imdbRating: { $gte: 7, $lte: 9.3 }, totalRatings: { $gt: 0 } }
    ]
  };
};

const rankTopRatedDocs = (docs = []) =>
  [...docs]
    .filter(isTopRatedCandidate)
    .sort((a, b) => {
      const score = topRatedSortScore(b) - topRatedSortScore(a);
      if (score) return score;
      return String(a.title || '').localeCompare(String(b.title || ''));
    });

module.exports = {
  hasPoster,
  isCatalogJunk,
  isCredibleRating,
  isTopRatedCandidate,
  topRatedSortScore,
  buildTopRatedMongoFilter,
  rankTopRatedDocs
};
