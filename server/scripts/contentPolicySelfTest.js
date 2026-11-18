#!/usr/bin/env node

const assert = require('assert');
const {
  applyPublicCatalogFilter,
  evaluateContentPolicy,
  isAdsenseSafeContent,
  isIndexableContent,
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
  { ...safeTitle, matureContent: true },
  { ...safeTitle, title: 'Erotic Nights' },
  { ...safeTitle, description: 'A guide to sexual enhancement supplements.' },
  { ...safeTitle, genre: 'Adult' }
]) {
  const result = evaluateContentPolicy(unsafe);
  assert.equal(result.restricted, true, `Expected restricted: ${JSON.stringify(unsafe)}`);
  assert.equal(isAdsenseSafeContent(unsafe), false);
  const fields = policyUpdateFields(result);
  assert.deepEqual(
    {
      policyRestricted: fields.policyRestricted,
      adsenseSafe: fields.adsenseSafe,
      matureContent: fields.matureContent,
      status: fields.status
    },
    {
      policyRestricted: true,
      adsenseSafe: false,
      matureContent: true,
      status: 'inactive'
    }
  );
}

assert.equal(isAdsenseSafeContent({ ...safeTitle, policyRestricted: true }), false);
assert.equal(isAdsenseSafeContent({ ...safeTitle, adsenseSafe: false }), false);

const publicFilter = applyPublicCatalogFilter({ status: 'active' });
assert.deepEqual(publicFilter.policyRestricted, { $ne: true });
assert.deepEqual(publicFilter.adsenseSafe, { $ne: false });
assert.deepEqual(publicFilter.matureContent, { $ne: true });
assert.ok(publicFilter.description.$regex.test('x'.repeat(40)));
assert.equal(publicFilter.$and.length, 1);

assert.equal(
  isAdsenseSafeContent({ ...safeTitle, description: 'Too short' }),
  true,
  'Content safety and content depth are intentionally separate checks'
);

console.log('Content policy self-test passed.');
