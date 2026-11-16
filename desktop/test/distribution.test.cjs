'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { distributionProfile } = require('../distribution.cjs');
const { createStore, KEY } = require('../storage.cjs');
const metadata = { studioDistribution: { portable: true, initialBoard: 'empty' } };
const options = { packaged: true, metadata, appData: path.resolve('mock-appdata'), executablePath: path.resolve('mock-extracted', 'Shixu Studio.exe'), portableDirectory: path.resolve('mock-portable') };

test('Development ignores release flags and keeps the existing data location', () => {
  const profile = distributionProfile({ ...options, packaged: false });
  assert.equal(profile.dataRoot, path.join(options.appData, 'ShixuStudio'));
  assert.equal(profile.initialBoard, 'demo');
  assert.equal(profile.applicationId, 'studio.shixu.board');
});

test('Existing standard desktop builds retain their data location and initial content', () => {
  const profile = distributionProfile({ ...options, metadata: {} });
  assert.equal(profile.portable, false); assert.equal(profile.initialBoard, 'demo');
  assert.equal(profile.dataRoot, path.join(options.appData, 'ShixuStudio'));
});

test('Portable release uses the original launcher folder, not its extraction directory', () => {
  const profile = distributionProfile(options);
  assert.equal(profile.dataRoot, path.join(options.portableDirectory, 'ShixuStudioData'));
  assert.equal(profile.initialBoard, 'empty');
  assert.equal(profile.applicationId, 'studio.shixu.board.portable');
  assert.notEqual(profile.dataRoot, path.join(options.appData, 'ShixuStudio'));
});

test('An unpacked portable release stores data beside its executable', () => {
  const profile = distributionProfile({ ...options, portableDirectory: undefined });
  assert.equal(profile.dataRoot, path.join(path.dirname(options.executablePath), 'ShixuStudioData'));
});

test('Separate release folders receive separate data profiles', () => {
  const a = distributionProfile({ ...options, portableDirectory: path.resolve('copy-a') });
  const b = distributionProfile({ ...options, portableDirectory: path.resolve('copy-b') });
  assert.notEqual(a.dataRoot, b.dataRoot);
});

test('Portable writes do not affect development; copying the folder carries its data', t => {
  const base = path.resolve(__dirname, '..', '.test-data'); fs.mkdirSync(base, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(base, 'shixu-distribution-test-'));
  t.after(() => { const absolute = path.resolve(temporary); if (path.dirname(absolute) !== base || !path.basename(absolute).startsWith('shixu-distribution-test-')) throw new Error('Unexpected cleanup path'); fs.rmSync(absolute, { recursive: true, force: true }); });
  const appData = path.join(temporary, 'appdata'), folder = path.join(temporary, 'portable-a'), destination = path.join(temporary, 'portable-b');
  const development = distributionProfile({ ...options, packaged: false, appData });
  const portable = distributionProfile({ ...options, appData, portableDirectory: folder });
  const devStore = createStore(development.dataRoot); devStore.setItem(KEY, 'development sentinel');
  const a = createStore(portable.dataRoot); assert.equal(a.getItem(KEY), null);
  a.setItem(KEY, 'portable work'); assert.equal(devStore.getItem(KEY), 'development sentinel');
  fs.cpSync(folder, destination, { recursive: true });
  const moved = distributionProfile({ ...options, appData, portableDirectory: destination });
  assert.equal(createStore(moved.dataRoot).getItem(KEY), 'portable work');
  createStore(moved.dataRoot).setItem(KEY, 'new copy');
  assert.equal(a.getItem(KEY), 'portable work'); assert.equal(devStore.getItem(KEY), 'development sentinel');
});
