'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { nextVersion, checkTarget, withReleaseLock } = require('./release-history.cjs');

async function updateAndRelease(root, bump, build) {
  const filenames = ['package.json', 'package-lock.json'].map(name => path.join(root, name));
  const originals = filenames.map(name => fs.readFileSync(name));
  const [pkg, lock] = originals.map(raw => JSON.parse(raw));
  if (lock.version !== pkg.version || lock.packages[''].version !== pkg.version) throw new Error('版本檔不同步，請先修正');
  const version = nextVersion(pkg.version, bump);
  checkTarget(path.resolve(root, '..', 'releases'), version);
  pkg.version = lock.version = lock.packages[''].version = version;
  try {
    [pkg, lock].forEach((value, index) => fs.writeFileSync(filenames[index], JSON.stringify(value, null, 2) + '\n'));
    await build();
  } catch (error) {
    filenames.forEach((name, index) => fs.writeFileSync(name, originals[index]));
    throw error;
  }
  return version;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  if (process.argv.length > 3) throw new Error('用法：npm run release -- [patch|minor|major|版本號]');
  withReleaseLock(root, () => updateAndRelease(root, process.argv[2] || 'patch', () => require('./release-portable.cjs').releasePortable()))
    .then(version => console.log(`已發布 ${version}；歷史保留最近 3 版。`))
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
      process.on('exit', () => { process.exitCode = 1; });
    });
}
module.exports = { updateAndRelease };
