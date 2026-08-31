const BLOCKED_GENRE_PATTERNS = [
  /\badult\b/i,
  /\berotica?\b/i,
  /\bpornograph/i,
  /\bporn\b/i,
  /\bhentai\b/i,
  /\bsoftcore\b/i,
  /\bhardcore\b/i
];

const BLOCKED_TEXT_PATTERNS = [
  /\b(porn|hentai|x-?rated|onlyfans)\b/i,
  /\b(adult film|adult movie|adult video|adult entertainment|adult only)\b/i,
  /\b(pornographic|sexually explicit|graphic sex|hardcore porn)\b/i,
  /\b(sexual fetish|sex shop|sex toy)\b/i,
  /\b(strip club|brothel|prostitut|escort service)\b/i,
  /\b(erotic massage|cam girl|camgirl)\b/i,
  /\bmake a porno\b/i,
  /\bbitchcraft\b/i
];

const TITLE_ALLOWLIST = [
  /^x\s*x\s*x\b/i,
  /^xXx\b/,
  /^xXx:/i
];

const ALLOWED_CONTEXT_PATTERNS = [
  /\bsex and the city\b/i,
  /\bsex education\b/i,
  /\bs## education\b/i,
  /\bsex tape\b/i,
  /\bsex comedy\b/i,
  /\bsex life\b/i
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
    const live = evaluateContentPolicy({ ...item, policyRestricted: false });
    if (!live.restricted) {
      return { restricted: false, reason: '' };
    }
    return {
      restricted: true,
      reason: item.policyRestrictedReason || live.reason || 'Marked as policy restricted'
    };
  }

  if (!text) {
    return { restricted: false, reason: '' };
  }

  if (matchesAny(text, ALLOWED_CONTEXT_PATTERNS)) {
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
    return { restricted: true, reason: 'Blocked keywords for AdSense compliance' };
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
