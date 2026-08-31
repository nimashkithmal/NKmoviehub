/** Curated languages for browse filters (Sri Lankan + regional focus). */
const CURATED_LANGUAGES = [
  { id: 'sinhala', label: 'Sinhala' },
  { id: 'tamil', label: 'Tamil' },
  { id: 'english', label: 'English' },
  { id: 'hindi', label: 'Hindi' },
  { id: 'telugu', label: 'Telugu' },
  { id: 'malayalam', label: 'Malayalam' },
  { id: 'kannada', label: 'Kannada' },
  { id: 'bengali', label: 'Bengali' },
  { id: 'japanese', label: 'Japanese' },
  { id: 'korean', label: 'Korean' },
  { id: 'chinese', label: 'Chinese' },
  { id: 'spanish', label: 'Spanish' },
  { id: 'french', label: 'French' }
];

const ALIAS_TO_ID = new Map();
for (const entry of CURATED_LANGUAGES) {
  ALIAS_TO_ID.set(entry.id, entry.id);
  ALIAS_TO_ID.set(entry.label.toLowerCase(), entry.id);
}

const EXTRA_ALIASES = {
  sinhala: ['sinhalese', 'si'],
  tamil: ['ta'],
  english: ['en', 'eng'],
  hindi: ['hi'],
  telugu: ['te'],
  malayalam: ['ml'],
  kannada: ['kn'],
  bengali: ['bangla', 'bn'],
  japanese: ['ja', 'jp'],
  korean: ['ko', 'kr'],
  chinese: ['mandarin', 'zh', 'cn'],
  spanish: ['es'],
  french: ['fr']
};

for (const [id, aliases] of Object.entries(EXTRA_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_ID.set(alias.toLowerCase(), id);
  }
}

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeLanguageId = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  return ALIAS_TO_ID.get(raw) || raw;
};

const getLanguageLabel = (id) => {
  const normalized = normalizeLanguageId(id);
  const curated = CURATED_LANGUAGES.find((item) => item.id === normalized);
  if (curated) return curated.label;
  if (!normalized) return '';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

/** Build a MongoDB clause for spoken-language filter. */
const buildLanguageClause = (languageParam) => {
  const id = normalizeLanguageId(languageParam);
  if (!id) return null;

  const aliases = new Set([id, getLanguageLabel(id).toLowerCase()]);
  for (const [alias, mappedId] of ALIAS_TO_ID.entries()) {
    if (mappedId === id) aliases.add(alias);
  }

  const patterns = [...aliases].map(
    (alias) => new RegExp(`^${escapeRegex(alias)}$`, 'i')
  );

  if (patterns.length === 1) return { language: patterns[0] };
  return { language: { $in: patterns } };
};

/** Merge language clause into an existing filter (handles existing $or from search). */
const applyLanguageFilter = (filter, languageParam) => {
  const clause = buildLanguageClause(languageParam);
  if (!clause) return filter;

  if (filter.$or) {
    const searchOr = filter.$or;
    delete filter.$or;
    filter.$and = [...(filter.$and || []), { $or: searchOr }, clause];
  } else {
    Object.assign(filter, clause);
  }

  return filter;
};

/** Collect normalized language options from raw DB values. */
const collectLanguageOptions = (rawValues = []) => {
  const counts = new Map();

  for (const value of rawValues) {
    const raw = String(value || '').trim();
    if (!raw) continue;
    const id = normalizeLanguageId(raw);
    const label = getLanguageLabel(id || raw);
    const key = id || raw.toLowerCase();
    const existing = counts.get(key);
    if (existing) existing.count += 1;
    else counts.set(key, { id: key, label, count: 1 });
  }

  const curated = [];
  const seen = new Set();
  for (const item of CURATED_LANGUAGES) {
    const match = counts.get(item.id);
    if (match) {
      curated.push({ id: item.id, label: item.label, count: match.count });
      seen.add(item.id);
    }
  }

  const rest = [...counts.values()]
    .filter((item) => !seen.has(item.id))
    .sort((a, b) => a.label.localeCompare(b.label));

  return [...curated, ...rest];
};

module.exports = {
  CURATED_LANGUAGES,
  normalizeLanguageId,
  getLanguageLabel,
  buildLanguageClause,
  applyLanguageFilter,
  collectLanguageOptions
};
