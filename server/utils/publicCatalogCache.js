const { invalidateComingSoonCache } = require('./comingSoon');

/** Reset hooks registered by routes that keep in-memory public catalog caches. */
const resetHooks = new Set();

function onPublicCatalogChange(fn) {
  resetHooks.add(fn);
}

/** Call after an admin adds, edits, deletes or hides a title so home rows refresh immediately. */
function invalidatePublicCatalogCaches() {
  invalidateComingSoonCache();
  for (const fn of resetHooks) {
    try {
      fn();
    } catch (err) {
      console.error('Public catalog cache reset error:', err.message || err);
    }
  }
}

const USER_ACTION_PATH = /\/(rate|ask|questions)(\/|$)/;

/**
 * Router middleware: after a successful admin write (create / edit / delete / status),
 * drop cached home rows so removed titles stop appearing.
 */
function invalidateOnCatalogWrite(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD' && !USER_ACTION_PATH.test(req.path)) {
    res.on('finish', () => {
      if (res.statusCode < 400) invalidatePublicCatalogCaches();
    });
  }
  next();
}

module.exports = {
  onPublicCatalogChange,
  invalidatePublicCatalogCaches,
  invalidateOnCatalogWrite
};
