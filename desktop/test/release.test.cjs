'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { nextVersion, checkTarget, publishRelease, withReleaseLock } = require('../scripts/release-history.cjs');
const { updateAndRelease } = require('../scripts/release.cjs');
const filename = version => `Shixu-Studio-${version}-Portable-win-x64.zip`;

function fixture(t) {
  const base = path.resolve(__dirname, '..', '.test-data');
  fs.mkdirSync(base, { recursive: true });
  const root = fs.mkdtempSync(path.join(base, 'release-test-'));
  t.after(() => {
    if (path.dirname(root) !== base || !path.basename(root).startsWith('release-test-')) throw new Error('Unexpected cleanup path');
    fs.rmSync(root, { recursive: true, force: true });
  });
  return root;
}

function stage(root, version) {
  const file = path.join(root, version + '.zip');
  fs.writeFileSync(file, 'test artifact ' + version);
  const hash = createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  fs.writeFileSync(file + '.sha256', hash + '  ' + filename(version) + '\n');
  return file;
}

test('Release numbers increment by change type and reject invalid or lower versions', () => {
  assert.equal(nextVersion('1.2.9'), '1.2.10');
  assert.equal(nextVersion('1.2.9', 'minor'), '1.3.0');
  assert.equal(nextVersion('1.2.9', 'major'), '2.0.0');
  assert.equal(nextVersion('1.2.9', '2.3.0'), '2.3.0');
  for (const bump of ['1.2.9', '1.2.8', '01.3.0', 'v2.0.0', '../other', '2.0.0-beta']) assert.throws(() => nextVersion('1.2.9', bump));
});

test('Publication keeps latest plus three historical versions, sorted numerically', t => {
  const root = fixture(t), releases = path.join(root, 'releases');
  for (const version of ['1.0.0', '1.0.1', '1.0.2', '1.0.9', '1.0.10', '1.1.0']) publishRelease(releases, version, stage(root, version));
  assert.deepEqual(fs.readdirSync(releases).sort(), [filename('1.1.0'), filename('1.1.0') + '.sha256', 'history'].sort());
  assert.deepEqual(fs.readdirSync(path.join(releases, 'history')).sort(), ['1.0.10', '1.0.2', '1.0.9']);
  assert.equal(fs.readFileSync(path.join(releases, 'history', '1.0.10', filename('1.0.10')), 'utf8'), 'test artifact 1.0.10');
  assert.throws(() => checkTarget(releases, '1.0.10'), /不可覆寫或降版/);
  assert.throws(() => checkTarget(releases, '1.1.0'), /不可覆寫或降版/);
});

test('Checksum failure leaves the current release and history untouched', t => {
  const root = fixture(t), releases = path.join(root, 'releases');
  publishRelease(releases, '1.0.0', stage(root, '1.0.0'));
  const staged = stage(root, '1.0.1'); fs.appendFileSync(staged, 'corruption');
  assert.throws(() => publishRelease(releases, '1.0.1', staged), /SHA-256/);
  assert.equal(fs.readFileSync(path.join(releases, filename('1.0.0')), 'utf8'), 'test artifact 1.0.0');
  assert(!fs.existsSync(path.join(releases, 'history')));
});

test('Publication failure restores the previous ZIP, checksum and staged files', t => {
  const root = fixture(t), releases = path.join(root, 'releases');
  publishRelease(releases, '1.0.0', stage(root, '1.0.0'));
  const staged = stage(root, '1.0.1'); let count = 0;
  assert.throws(() => publishRelease(releases, '1.0.1', staged, { rename(source, destination) {
    if (++count === 4) throw new Error('simulated disk failure');
    fs.renameSync(source, destination);
  } }), /simulated disk failure/);
  assert(fs.existsSync(path.join(releases, filename('1.0.0'))));
  assert(fs.existsSync(path.join(releases, filename('1.0.0') + '.sha256')));
  assert(fs.existsSync(staged)); assert(fs.existsSync(staged + '.sha256'));
  assert(!fs.existsSync(path.join(releases, filename('1.0.1'))));
  assert.deepEqual(fs.readdirSync(path.join(releases, 'history')), []);
});

test('History cleanup preserves folders with unrecognized files and all unrelated files', t => {
  const root = fixture(t), releases = path.join(root, 'releases');
  publishRelease(releases, '1.0.0', stage(root, '1.0.0'));
  publishRelease(releases, '1.0.1', stage(root, '1.0.1'));
  const data = path.join(releases, 'history', '1.0.0', 'board.json');
  fs.writeFileSync(data, 'user data');
  fs.writeFileSync(path.join(releases, 'notes.txt'), 'keep');
  for (const version of ['1.0.2', '1.0.3', '1.0.4', '1.0.5']) publishRelease(releases, version, stage(root, version));
  assert.equal(fs.readFileSync(data, 'utf8'), 'user data');
  assert(fs.existsSync(path.join(releases, 'notes.txt')));
  assert(!fs.existsSync(path.join(releases, 'history', '1.0.1')));
});

test('History enumeration failure after commit keeps the successful new release', t => {
  const root = fixture(t), releases = path.join(root, 'releases');
  publishRelease(releases, '1.0.0', stage(root, '1.0.0'));
  const read = fs.readdirSync;
  t.mock.method(fs, 'readdirSync', (folder, ...args) => {
    if (folder === path.join(releases, 'history') && fs.existsSync(path.join(releases, filename('1.0.1')))) throw new Error('history unavailable');
    return read(folder, ...args);
  });
  const warning = t.mock.method(console, 'warn', () => {});
  assert.doesNotThrow(() => publishRelease(releases, '1.0.1', stage(root, '1.0.1')));
  assert(fs.existsSync(path.join(releases, filename('1.0.1'))));
  assert(fs.existsSync(path.join(releases, 'history', '1.0.0', filename('1.0.0'))));
  assert.equal(warning.mock.callCount(), 1);
});

test('Version update synchronizes both files and restores their exact bytes on build failure', async t => {
  const root = fixture(t), desktop = path.join(root, 'desktop'); fs.mkdirSync(desktop);
  const pkg = '{"version":"1.0.0"}\r\n', lock = '{"version":"1.0.0","packages":{"":{"version":"1.0.0"}}}\r\n';
  fs.writeFileSync(path.join(desktop, 'package.json'), pkg);
  fs.writeFileSync(path.join(desktop, 'package-lock.json'), lock);
  await assert.rejects(updateAndRelease(desktop, 'patch', async () => {
    assert.equal(JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'))).version, '1.0.1');
    const currentLock = JSON.parse(fs.readFileSync(path.join(desktop, 'package-lock.json')));
    assert.equal(currentLock.version, '1.0.1'); assert.equal(currentLock.packages[''].version, '1.0.1');
    throw new Error('build failed');
  }), /build failed/);
  assert.equal(fs.readFileSync(path.join(desktop, 'package.json'), 'utf8'), pkg);
  assert.equal(fs.readFileSync(path.join(desktop, 'package-lock.json'), 'utf8'), lock);
  await updateAndRelease(desktop, 'minor', async () => {});
  assert.equal(JSON.parse(fs.readFileSync(path.join(desktop, 'package.json'))).version, '1.1.0');
});

test('Concurrent releases are rejected and a failed operation releases the lock', async t => {
  const root = fixture(t);
  await assert.rejects(withReleaseLock(root, async () => {
    assert.throws(() => withReleaseLock(root, async () => {}), /EEXIST/);
    throw new Error('failed');
  }), /failed/);
  await withReleaseLock(root, async () => {});
  assert(!fs.existsSync(path.join(root, '.release.lock')));
});
