#!/usr/bin/env node

const assert = require('assert');
const {
  applyPublicCatalogFilter,
  applyIndexableCatalogFilter,
  evaluateContentPolicy,
  isAdsenseSafeContent,
  isIndexableContent,
  isPubliclyAccessible,
  policyUpdateFields
} = require('../utils/contentPolicy');

const safeTitle = {
  title: 'The Great Adventure',
  description: 'A family crosses a mountain range and learns to work together on the journey.',
  genre: 'Adventure, Family',
  imageUrl: 'https://example.com/poster.jpg'
};

assert.equal(evaluateContentPolicy(safeTitle).restricted, false);
assert.equal(isAdsenseSafeContent(safeTitle), true);
assert.equal(isIndexableContent(safeTitle), true);

assert.equal(
  evaluateContentPolicy({ ...safeTitle, title: 'xXx: Return of Xander Cage' }).restricted,
  false,
  'The legitimate xXx franchise allow-list must remain available'
);

for (const unsafe of [
  { ...safeTitle, adult: true },
  { ...safeTitle, title: 'Erotic Nights' },
  { ...safeTitle, description: 'A guide to sexual enhancement supplements.' },
  { ...safeTitle, genre: 'Adult' }
]) {
  const result = evaluateContentPolicy(unsafe);
  assert.equal(result.restricted, true, `Expected restricted: ${JSON.stringify(unsafe)}`);
  assert.equal(isAdsenseSafeContent(unsafe), false);
  const fields = policyUpdateFields(result, 'active');
  assert.deepEqual(
    {
      policyRestricted: fields.policyRestricted,
      adsenseSafe: fields.adsenseSafe,
      status: fields.status
    },
    {
      policyRestricted: true,
      adsenseSafe: false,
      status: 'inactive'
    }
  );
}

const matureTitle = { ...safeTitle, matureContent: true };
assert.equal(evaluateContentPolicy(matureTitle).restricted, false);
assert.equal(
  isAdsenseSafeContent(matureTitle),
  false,
  'Mature titles are excluded from AdSense-safe content'
);
assert.equal(
  isPubliclyAccessible(matureTitle),
  true,
  'Certified mature titles remain searchable and open behind the age gate'
);
assert.equal(
  isIndexableContent(matureTitle),
  false,
  'Certified mature titles stay out of search-engine indexing'
);

assert.equal(isAdsenseSafeContent({ ...safeTitle, policyRestricted: true }), false);
assert.equal(isAdsenseSafeContent({ ...safeTitle, adsenseSafe: false }), false);

const publicFilter = applyPublicCatalogFilter({ status: 'active' });
assert.deepEqual(publicFilter.policyRestricted, { $ne: true });
assert.deepEqual(publicFilter.adsenseSafe, { $ne: false });
assert.equal(publicFilter.matureContent, undefined);
assert.equal(publicFilter.description, undefined);
assert.equal(publicFilter.$and, undefined);

const indexableFilter = applyIndexableCatalogFilter({ status: 'active' });
assert.deepEqual(indexableFilter.matureContent, { $ne: true });
assert.ok(indexableFilter.description.$regex.test('x'.repeat(40)));
assert.equal(indexableFilter.$and.length, 1);

assert.equal(
  isAdsenseSafeContent({ ...safeTitle, description: 'Too short' }),
  true,
  'Content safety and content depth are intentionally separate checks'
);
assert.equal(
  isPubliclyAccessible({ ...safeTitle, description: 'Too short' }),
  true,
  'Active safe titles do not disappear from site search due to thin metadata'
);

console.log('Content policy self-test passed.');
