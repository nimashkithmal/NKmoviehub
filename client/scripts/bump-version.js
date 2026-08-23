#!/usr/bin/env node
/**
 * Move the build counter up by one: 1.0.0.1 -> 1.0.0.2 -> 1.0.0.3 ...
 *
 * Run once per deploy. The number lives in src/version.js, which is what the
 * menu displays, so bumping it and shipping the build is all that is needed.
 *
 * Usage:
 *   npm run bump             # 1.0.0.1 -> 1.0.0.2
 *   npm run bump -- --print  # report the current version without changing it
 */
const fs = require('fs');
const path = require('path');

const VERSION_FILE = path.join(__dirname, '..', 'src', 'version.js');
const PATTERN = /(export const APP_VERSION = ')(\d+(?:\.\d+)+)(';)/;

const source = fs.readFileSync(VERSION_FILE, 'utf8');
const match = source.match(PATTERN);

if (!match) {
  console.error(`Could not find an APP_VERSION line in ${VERSION_FILE}`);
  process.exit(1);
}

const current = match[2];

if (process.argv.includes('--print')) {
  console.log(current);
  process.exit(0);
}

// Only the last segment moves; 1.0.0 stays the release the build belongs to
const parts = current.split('.');
parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1);
const next = parts.join('.');

fs.writeFileSync(VERSION_FILE, source.replace(PATTERN, `$1${next}$3`));
console.log(`v${current} -> v${next}`);
