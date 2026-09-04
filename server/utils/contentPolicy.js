/**
 * AdSense / Google Publisher policy helpers.
 * Tuned for Adult: Sexual content restrictions — block sexually explicit,
 * sexually suggestive entertainment, and titles that previously slipped through
 * via allowlists (e.g. "Sex Education" / "S## Education").
 */

const BLOCKED_GENRE_PATTERNS = [
  /\badult\b/i,
  /\berotica?\b/i,
  /\bpornograph/i,
  /\bporn\b/i,
  /\bhentai\b/i,
  /\bsoftcore\b/i,
  /\bhardcore\b/i
];

/** Titles that are Vin Diesel xXx franchise — not adult content. */
const TITLE_ALLOWLIST = [
  /^x\s*x\s*x\b/i,
  /^xXx\b/,
  /^xXx:/i
];

/**
 * Title-only blocks for sexual / adult entertainment that AdSense flags.
 * Includes obfuscations of "Sex Education" (S## Education, etc.).
 */
const BLOCKED_TITLE_PATTERNS = [
  /\bsex\s*education\b/i,
  /\bs[#*x$]+[\s._-]*education\b/i,
  /\bs[e3]x[\s._-]*education\b/i,
  /\bsex\b/i,
  /\berotic/i,
  /\bnud(?:e|ity|ist)\b/i,
  /\bporn/i,
  /\bhentai\b/i,
  /\bonlyfans\b/i,
  /\bx-?rated\b/i,
  /\bsoftcore\b/i,
  /\bfetish\b/i,
  /\bescort\b/i,
  /\bprostitut/i,
  /\bharlots?\b/i,
  /\bstrip(?:per|tease|club)\b/i,
  /\bbrothel\b/i,
  /\bvoluptuous\b/i,
  /\basslicious\b/i,
  /\bbitchcraft\b/i,
  /\bisland fever\b/i,
  /\bjesse\s*jane\b/i,
  /\bmake a porno\b/i,
  /\bnaughty days\b/i,
  /\bsin island\b/i,
  /\bdream girls in\b/i,
  /\bafter school special\b/i,
  /\beuphoria\b/i,
  /\bblue is the warmest\b/i,
  /\bthe dreamers\b/i,
  /\bnotorious bettie page\b/i,
  /\blove exposure\b/i,
  /\bborn 2 b bad\b/i,
  /\bvirtualia\b/i,
  /\bf+u+c+k/i,
  /\bf\*{2,}/i,
  /\blesbian hospital\b/i,
  /\bjunior college lesbians?\b/i,
  /\bbad girls\b/i,
  /\bfaster pussycat\b/i,
  /\bmother\s*fucker\b/i
];

const BLOCKED_TEXT_PATTERNS = [
  /\b(porn|hentai|x-?rated|onlyfans)\b/i,
  /\b(adult film|adult movie|adult video|adult entertainment|adult only)\b/i,
  /\b(pornographic|sexually explicit|graphic sex|hardcore porn)\b/i,
  /\b(sexual fetish|sex shop|sex toy)\b/i,
  /\b(strip club|brothel|prostitut|escort service)\b/i,
  /\b(erotic massage|cam girl|camgirl)\b/i,
  /\b(sex education|s[#*x$]+\s*education)\b/i,
  /\b(sex tape|sex comedy|sex life|sexual entertainment)\b/i,
  /\b(graphic nudity|full(?:\s|-)?frontal|softcore|hardcore adult)\b/i,
  /\b(sexually suggestive|sexually gratifying|sexual arousal)\b/i,
  /\b(revenge porn|deepfake porn)\b/i,
  /\b(digital playground|pussy-eating|go-go dancers)\b/i,
  /\bmake a porno\b/i,
  /\bbitchcraft\b/i
];

const getSearchText = (item = {}) =>
  [item.title, item.description, item.tagline, item.genre]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const matchesAny = (text, patterns) => patterns.some((pattern) => pattern.test(text));

const evaluateContentPolicy = (item = {}) => {
  const title = String(item.title || '').trim();
  const text = getSearchText(item);

  if (title && matchesAny(title, TITLE_ALLOWLIST)) {
    return { restricted: false, reason: '' };
  }

  if (item.policyRestricted === true) {
    // Avoid spreading Mongoose docs (loses schema fields); re-check live fields only.
    const live = evaluateContentPolicy({
      title: item.title,
      description: item.description,
      tagline: item.tagline,
      genre: item.genre,
      policyRestricted: false
    });
    if (!live.restricted) {
      return { restricted: false, reason: '' };
    }
    return {
      restricted: true,
      reason: item.policyRestrictedReason || live.reason || 'Marked as policy restricted'
    };
  }

  if (title && matchesAny(title, BLOCKED_TITLE_PATTERNS)) {
    return {
      restricted: true,
      reason: 'Blocked title for AdSense adult/sexual content policy'
    };
  }

  if (!text) {
    return { restricted: false, reason: '' };
  }

  if (matchesAny(item.genre || '', BLOCKED_GENRE_PATTERNS)) {
    return { restricted: true, reason: 'Blocked genre for AdSense compliance' };
  }

  if (/\bxxx\b/i.test(text) && !matchesAny(title, TITLE_ALLOWLIST)) {
    return { restricted: true, reason: 'Blocked keywords for AdSense compliance' };
  }

  const blocked = BLOCKED_TEXT_PATTERNS.find((pattern) => pattern.test(text));
  if (blocked) {
    return { restricted: true, reason: 'Blocked keywords for AdSense adult/sexual content policy' };
  }

  return { restricted: false, reason: '' };
};

const applyPublicCatalogFilter = (filter = {}) => ({
  ...filter,
  policyRestricted: { $ne: true }
});

const filterPublicItems = (items = []) =>
  items.filter((item) => !evaluateContentPolicy(item).restricted);

const isPubliclyAccessible = (item) => !evaluateContentPolicy(item).restricted;

module.exports = {
  evaluateContentPolicy,
  applyPublicCatalogFilter,
  filterPublicItems,
  isPubliclyAccessible
};
