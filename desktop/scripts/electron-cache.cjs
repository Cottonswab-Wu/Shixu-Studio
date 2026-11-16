'use strict';
const fs = require('node:fs');
const path = require('node:path');

// electron-builder's downloader needs an explicit cache path. Seed official
// checksums from the pinned Electron npm package for offline cache validation.
function prepareElectronCache(root) {
  const cache = process.env.ELECTRON_CACHE || path.join(root, '.cache', 'electron');
  const version = require('electron/package.json').version;
  const checksums = require('electron/checksums.json');
  fs.mkdirSync(cache, { recursive: true });
  fs.writeFileSync(path.join(cache, `SHASUMS256.txt-${version}`), Object.entries(checksums).map(([name, hash]) => `${hash}  ${name}`).join('\n') + '\n');
  return cache;
}
module.exports = { prepareElectronCache };
