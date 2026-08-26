/**
 * Move coming_soon titles to active once their release date has passed.
 */
function isReleased(doc, todayArg) {
  const today = todayArg instanceof Date ? todayArg : new Date();
  const todayStr = today.toISOString().slice(0, 10);

  if (doc.releaseDate) {
    const raw = String(doc.releaseDate).trim();
    const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (iso) return iso <= todayStr;

    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) {
      return parsed <= today.getTime();
    }
  }

  // No exact date: treat past calendar years as already released
  const year = Number(doc.year);
  if (Number.isFinite(year) && year > 1900 && year < today.getFullYear()) {
    return true;
  }

  return false;
}

function releaseSortKey(doc) {
  if (doc.releaseDate) {
    const iso = String(doc.releaseDate).trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (iso) return iso;
    const parsed = Date.parse(doc.releaseDate);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
  }
  if (doc.year) return `${doc.year}-12-31`;
  return '9999-12-31';
}

function isUpcomingDoc(doc, todayArg) {
  const today = todayArg instanceof Date ? todayArg : new Date();
  const todayStr = today.toISOString().slice(0, 10);

  if (doc.releaseDate) {
    const iso = String(doc.releaseDate).trim().match(/^(\d{4}-\d{2}-\d{2})/)?.[1];
    if (iso) return iso > todayStr;
    const parsed = Date.parse(doc.releaseDate);
    if (!Number.isNaN(parsed)) return parsed > today.getTime();
  }

  const year = Number(doc.year);
  if (Number.isFinite(year) && year > today.getFullYear()) return true;

  return false;
}

async function promoteReleasedComingSoon(Model) {
  const docs = await Model.find({ status: 'coming_soon' })
    .select('_id releaseDate year')
    .lean();

  const ids = docs.filter((doc) => isReleased(doc)).map((doc) => doc._id);
  if (!ids.length) return 0;

  await Model.updateMany(
    { _id: { $in: ids } },
    { $set: { status: 'active' } }
  );
  return ids.length;
}

function sortComingSoon(docs) {
  return [...docs].sort((a, b) => {
    const ka = releaseSortKey(a);
    const kb = releaseSortKey(b);
    if (ka !== kb) return ka.localeCompare(kb);
    return String(a.title || '').localeCompare(String(b.title || ''));
  });
}

/** Public Coming Soon list: only titles still truly upcoming. */
function filterUpcomingOnly(docs) {
  return sortComingSoon(docs.filter((doc) => isUpcomingDoc(doc)));
}

module.exports = {
  isReleased,
  isUpcomingDoc,
  releaseSortKey,
  promoteReleasedComingSoon,
  sortComingSoon,
  filterUpcomingOnly
};
