/**
 * AdSense / Google Publisher content-safety helpers.
 *
 * Goals:
 * - Block sexually explicit / primarily erotic content (Adult: Sexual content)
 * - Keep mainstream romance, action, drama, and mature storytelling
 * - Persist decisions via policyRestricted + adsenseSafe on catalog docs
 * - Exclude thin pages (no overview / no poster) from public indexing
 */

const BLOCKED_GENRE_PATTERNS = [
  /\badult\b/i,
  /\berotica?\b/i,
  /\bpornograph/i,
  /\bporn\b/i,
  /\bhentai\b/i,
  /\bsoftcore\b/i,
  /\bhardcore\b/i,
  /\bxxx\b/i
];

/** Titles that are Vin Diesel xXx franchise — not adult content. */
const TITLE_ALLOWLIST = [/^x\s*x\s*x\b/i, /^xXx\b/, /^xXx:/i];

/**
 * Title-level blocks for sexual / adult entertainment.
 * Prefer precise phrases over single common words where possible.
 */
const BLOCKED_TITLE_PATTERNS = [
  /\bsex\s*education\b/i,
  /\bs[#*x$]+[\s._-]*education\b/i,
  /\bs[e3]x[\s._-]*education\b/i,
  /\bsex\s+(tape|comedy|life|addict|party|slave|worker|shop|toy)/i,
  /\babout\s+sex\b/i,
  /\bsex\s+and\s+the\s+city\b/i,
  /\b(50|fifty)\s+shades?\b/i,
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
  /\bfaster pussycat\b/i,
  /\bmother\s*fucker\b/i,
  /^private\s+(café|cafe|chateau|football|lessons|black\s*label)\b/i,
  /\bprivate\s+black\s*label\b/i,
  /\bbuttwoman\b/i,
  /\binternal\s+cumb?ustion\b/i,
  /\bass\s+worship\b/i,
  /\bteenlicious\b/i,
  /\bflesh\s+for\s+sale\b/i,
  /\bdorcel\b/i,
  /\bfashionistas\b/i,
  /\bpirates\s+ii:\s*stagnetti/i,
  /\bnymphomaniac\b/i,
  /\bshortbus\b/i,
  /\bcaligula\b/i,
  /\bemmanuelle\b/i,
  /\bshowgirls\b/i
];

const BLOCKED_TEXT_PATTERNS = [
  /\b(hentai|x-?rated|onlyfans)\b/i,
  /\b(adult film|adult movie|adult video|adult entertainment|adult only)\b/i,
  /\bpornograph/i,
  /\b(hardcore porn|adult porn)\b/i,
  /\bporn\b/i,
  /\b(sexual fetish|sex shop|sex toy|sexual merchandise)\b/i,
  /\b(escort service|erotic massage|cam ?girl|webcam (?:sex|model))\b/i,
  /\b(sex education|s[#*x$]+\s*education)\b/i,
  /\b(sex tape|sex comedy|sexual entertainment|sexual enhancement)\b/i,
  /\b(graphic nudity|full(?:\s|-)?frontal|softcore|hardcore adult)\b/i,
  /\b(sexually suggestive|sexually gratifying|sexual arousal|sexually explicit)\b/i,
  /\b(revenge porn|deepfake porn|unsimulated sex|graphic sex)\b/i,
  /\b(digital playground|pussy-eating|go-go dancers)\b/i,
  /\b(strip(?:per|tease|club)|brothel|prostitut)\b/i,
  /\b(erotic|nudity|nudist)\b/i,
  /\bmake a porno\b/i,
  /\bbitchcraft\b/i,
  /\b(monique covet|tori black|jesse jane|moana pozzi|cicciolina)\b/i,
  /\bprivate\s+(media|gold|castings|tropical)\b/i,
  /\b(horny friends|wet secrets)\b/i,
  /\b(explicit (?:sex|sexual))\b/i
];

/** Adult-performer / explicit person signals (names, characters, bios). */
const BLOCKED_PERSON_PATTERNS = [
  /\bporn\b/i,
  /\bhentai\b/i,
  /\bonlyfans\b/i,
  /\bx-?rated\b/i,
  /\badult\s+(film|movie|video|entertain|perform|star|actress|actor)\b/i,
  /\b(porn\s*star|porn\s*actor|porn\s*actress|adult\s*star)\b/i,
  /\berotic\b/i,
  /\bfetish\b/i,
  /\bstrip(?:per|tease)\b/i,
  /\bescort\b/i,
  /\bprostitut/i,
  /\bcam\s*girl\b/i,
  /\bjesse\s*jane\b/i,
  /\btori\s*black\b/i,
  /\bmonique\s*covet\b/i,
  /\bmoana\s*pozzi\b/i,
  /\bcicciolina\b/i,
  /\bdorcel\b/i,
  /\bnud(?:e|ity|ist)\b/i,
  /\bsex\s*worker\b/i,
  /\bf+u+c+k/i
];

const MIN_OVERVIEW_CHARS = 40;

const asText = (value) => {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') {
          return entry.name || entry.title || entry.keyword || '';
        }
        return '';
      })
      .filter(Boolean)
      .join(' ');
  }
  if (typeof value === 'object') {
    return value.name || value.title || '';
  }
  return String(value);
};

/** Normalize API / DB / TMDB-shaped records into one shape for policy checks. */
const normalizeContentFields = (item = {}) => {
  const title = String(
    item.title || item.name || item.original_title || item.original_name || ''
  ).trim();
  const description = String(
    item.description || item.overview || item.plot || ''
  ).trim();
  const tagline = String(item.tagline || '').trim();
  const genre = String(
    item.genre || asText(item.genres) || asText(item.genre_ids) || ''
  ).trim();
  const keywords = asText(item.keywords || item.keyword_list || item.tags).trim();
  const certification = String(
    item.certification || item.rating || item.contentRating || ''
  ).trim();

  return {
    title,
    description,
    tagline,
    genre,
    keywords,
    certification,
    adult: item.adult === true || item.isAdult === true || item.is_adult === true,
    policyRestricted: item.policyRestricted === true,
    policyRestrictedReason: item.policyRestrictedReason || '',
    imageUrl: item.imageUrl || item.poster || item.poster_path || '',
    status: item.status
  };
};

const getSearchText = (fields) =>
  [fields.title, fields.description, fields.tagline, fields.genre, fields.keywords, fields.certification]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const matchesAny = (text, patterns) =>
  Boolean(text) && patterns.some((pattern) => pattern.test(text));

/**
 * Primary AdSense safety check.
 * @returns {boolean} true when content is safe to show publicly for AdSense
 */
const isAdsenseSafeContent = (item = {}) => !evaluateContentPolicy(item).restricted;

/**
 * Thin / low-value page detection (missing overview or poster).
 * Does not treat short-but-present overviews under MIN as indexable.
 */
const isThinContent = (item = {}) => {
  const fields = normalizeContentFields(item);
  const overview = fields.description;
  const hasPoster = Boolean(
    fields.imageUrl ||
      (Array.isArray(item.images) && item.images.length > 0) ||
      item.bannerUrl
  );
  if (!overview || overview.length < MIN_OVERVIEW_CHARS) return true;
  if (!hasPoster) return true;
  return false;
};

/** Safe for public catalogs + sitemap (policy + quality). */
const isIndexableContent = (item = {}) =>
  isAdsenseSafeContent(item) && !isThinContent(item);

const evaluateContentPolicy = (item = {}) => {
  const fields = normalizeContentFields(item);
  const { title } = fields;
  const text = getSearchText(fields);

  if (fields.adult) {
    return {
      restricted: true,
      adsenseSafe: false,
      reason: 'Blocked adult-flagged title for AdSense compliance'
    };
  }

  if (title && matchesAny(title, TITLE_ALLOWLIST)) {
    return { restricted: false, adsenseSafe: true, reason: '' };
  }

  // Persist flag from DB — still re-check live text so cleaned titles can recover
  if (fields.policyRestricted) {
    const live = evaluateContentPolicy({
      ...item,
      policyRestricted: false,
      adult: false,
      isAdult: false,
      is_adult: false
    });
    if (!live.restricted) {
      return { restricted: false, adsenseSafe: true, reason: '' };
    }
    return {
      restricted: true,
      adsenseSafe: false,
      reason:
        fields.policyRestrictedReason ||
        live.reason ||
        'Marked as policy restricted'
    };
  }

  if (title && matchesAny(title, BLOCKED_TITLE_PATTERNS)) {
    return {
      restricted: true,
      adsenseSafe: false,
      reason: 'Blocked title for AdSense adult/sexual content policy'
    };
  }

  if (matchesAny(fields.genre, BLOCKED_GENRE_PATTERNS)) {
    return {
      restricted: true,
      adsenseSafe: false,
      reason: 'Blocked genre for AdSense compliance'
    };
  }

  if (/\bxxx\b/i.test(text) && !matchesAny(title, TITLE_ALLOWLIST)) {
    return {
      restricted: true,
      adsenseSafe: false,
      reason: 'Blocked keywords for AdSense compliance'
    };
  }

  if (text) {
    const blocked = BLOCKED_TEXT_PATTERNS.find((pattern) => pattern.test(text));
    if (blocked) {
      return {
        restricted: true,
        adsenseSafe: false,
        reason: 'Blocked keywords for AdSense adult/sexual content policy'
      };
    }
  }

  return { restricted: false, adsenseSafe: true, reason: '' };
};

/** Mongo filter for public listings (adult / policy). */
const applyPublicCatalogFilter = (filter = {}) => ({
  ...filter,
  policyRestricted: { $ne: true },
  adsenseSafe: { $ne: false }
});

/** Mongo filter for sitemap / SEO indexable pages. */
const applyIndexableCatalogFilter = (filter = {}) => {
  const base = applyPublicCatalogFilter(filter);
  return {
    ...base,
    description: { $exists: true, $type: 'string', $regex: /[\s\S]{40,}/ },
    $and: [
      ...(base.$and ? (Array.isArray(base.$and) ? base.$and : [base.$and]) : []),
      {
        $or: [
          { imageUrl: { $exists: true, $type: 'string', $ne: '' } },
          { 'images.0': { $exists: true } }
        ]
      }
    ]
  };
};

const filterPublicItems = (items = []) =>
  items.filter((item) => isAdsenseSafeContent(item));

const filterIndexableItems = (items = []) =>
  items.filter((item) => isIndexableContent(item));

const isPubliclyAccessible = (item) => isAdsenseSafeContent(item);

/**
 * Person / cast / crew AdSense safety.
 * Blocks adult performers and people whose name/character/bio signals adult content.
 */
const evaluatePersonPolicy = (person = {}) => {
  if (person.adult === true || person.isAdult === true || person.is_adult === true) {
    return {
      restricted: true,
      adsenseSafe: false,
      reason: 'Blocked adult-flagged person for AdSense compliance'
    };
  }

  if (person.policyRestricted === true || person.adsenseSafe === false) {
    return {
      restricted: true,
      adsenseSafe: false,
      reason: person.policyRestrictedReason || 'Person marked as policy restricted'
    };
  }

  const text = [
    person.name,
    person.character,
    person.biography,
    person.bio,
    person.known_for_department,
    asText(person.known_for)
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return { restricted: false, adsenseSafe: true, reason: '' };
  }

  if (matchesAny(text, BLOCKED_PERSON_PATTERNS) || matchesAny(text, BLOCKED_TEXT_PATTERNS)) {
    return {
      restricted: true,
      adsenseSafe: false,
      reason: 'Blocked person/cast metadata for AdSense adult content policy'
    };
  }

  return { restricted: false, adsenseSafe: true, reason: '' };
};

const isAdsenseSafePerson = (person = {}) => !evaluatePersonPolicy(person).restricted;

const applyPublicPersonFilter = (filter = {}) => ({
  ...filter,
  policyRestricted: { $ne: true },
  adsenseSafe: { $ne: false }
});

const filterSafePeople = (people = []) =>
  people.filter((person) => isAdsenseSafePerson(person));

/** Episode title / label safety (TV episode names stored on TVShow). */
const isAdsenseSafeEpisodeTitle = (title = '') => {
  const text = String(title || '').trim();
  if (!text) return true;
  if (matchesAny(text, BLOCKED_TITLE_PATTERNS) || matchesAny(text, BLOCKED_TEXT_PATTERNS)) {
    return false;
  }
  return true;
};

/**
 * Strip unsafe cast/crew from live embed metadata before API responses.
 */
const sanitizeEmbedMetadata = (data = {}) => {
  if (!data || typeof data !== 'object') return data;
  const next = { ...data };

  if (Array.isArray(next.cast)) {
    next.cast = filterSafePeople(next.cast);
  }

  if (next.cast_crew && typeof next.cast_crew === 'object') {
    next.cast_crew = { ...next.cast_crew };
    if (Array.isArray(next.cast_crew.cast)) {
      next.cast_crew.cast = filterSafePeople(next.cast_crew.cast);
    }
    if (Array.isArray(next.cast_crew.crew)) {
      next.cast_crew.crew = filterSafePeople(next.cast_crew.crew);
    }
  }

  if (Array.isArray(next.crew)) {
    next.crew = filterSafePeople(next.crew);
  }

  // If the title itself is adult-flagged, callers should already 404; still blank adult flag exposure
  if (next.adult === true || next.is_adult === true) {
    next.adult = false;
    next.is_adult = false;
  }

  return next;
};

/**
 * Build Mongo update fields after a policy evaluation.
 * Restricted titles are deactivated so they leave public surfaces.
 */
const policyUpdateFields = (policyCheck, currentStatus) => {
  if (policyCheck.restricted) {
    const next = {
      policyRestricted: true,
      policyRestrictedReason: policyCheck.reason || 'Blocked by content policy',
      adsenseSafe: false
    };
    if (['active', 'coming_soon'].includes(currentStatus)) {
      next.status = 'inactive';
    }
    return next;
  }
  return {
    policyRestricted: false,
    policyRestrictedReason: '',
    adsenseSafe: true
  };
};

const personPolicyUpdateFields = (policyCheck) => {
  if (policyCheck.restricted) {
    return {
      policyRestricted: true,
      policyRestrictedReason: policyCheck.reason || 'Blocked by content policy',
      adsenseSafe: false
    };
  }
  return {
    policyRestricted: false,
    policyRestrictedReason: '',
    adsenseSafe: true
  };
};

module.exports = {
  MIN_OVERVIEW_CHARS,
  normalizeContentFields,
  evaluateContentPolicy,
  isAdsenseSafeContent,
  evaluatePersonPolicy,
  isAdsenseSafePerson,
  isAdsenseSafeEpisodeTitle,
  isThinContent,
  isIndexableContent,
  applyPublicCatalogFilter,
  applyIndexableCatalogFilter,
  applyPublicPersonFilter,
  filterPublicItems,
  filterIndexableItems,
  filterSafePeople,
  sanitizeEmbedMetadata,
  isPubliclyAccessible,
  policyUpdateFields,
  personPolicyUpdateFields
};
