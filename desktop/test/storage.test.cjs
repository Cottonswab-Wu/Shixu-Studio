'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createStore, atomicWrite, KEY, MAX_BYTES } = require('../storage.cjs');

function temporaryDirectory(t) {
  const base = path.resolve(__dirname, '..', '.test-data');
  fs.mkdirSync(base, { recursive: true });
  const directory = fs.mkdtempSync(path.join(base, 'shixu-storage-test-'));
  t.after(() => {
    const absolute = path.resolve(directory);
    if (path.dirname(absolute) !== base || !path.basename(absolute).startsWith('shixu-storage-test-')) throw new Error('Unexpected cleanup path');
    fs.rmSync(absolute, { recursive: true, force: true });
  });
  return directory;
}

test('Native data survives store recreation with exact Unicode content', t => {
  const directory = temporaryDirectory(t);
  const value = JSON.stringify({ title: '關機後還在 🌿', lists: [{ cards: [{ todos: [{ title: '完成', done: true }], labels: ['purple'] }] }] });
  const first = createStore(directory);
  assert.equal(first.getItem(KEY), null);
  first.setItem(KEY, value);
  assert.equal(createStore(directory).getItem(KEY), value);
  assert.equal(fs.readFileSync(path.join(directory, 'board.json'), 'utf8'), value);
});

test('Primary, previous and write probe have isolated allowlisted paths', t => {
  const directory = temporaryDirectory(t), store = createStore(directory);
  store.setItem(KEY, 'primary'); store.setItem(KEY + '.previous', 'previous');
  store.setItem(KEY + '.probe', '1'); store.removeItem(KEY + '.probe');
  assert.equal(store.getItem(KEY), 'primary'); assert.equal(store.getItem(KEY + '.previous'), 'previous');
  assert.equal(store.getItem(KEY + '.probe'), null);
  for (const key of ['../../outside', 'window.json', KEY + '.tmp']) {
    assert.throws(() => store.getItem(key)); assert.throws(() => store.setItem(key, 'bad')); assert.throws(() => store.removeItem(key));
  }
  assert.throws(() => store.removeItem(KEY));
});

test('Write failures keep the last successful board intact', t => {
  const directory = temporaryDirectory(t), store = createStore(directory);
  store.setItem(KEY, 'old');
  const io = Object.create(fs); io.writeFileSync = () => { throw Object.assign(new Error('Disk full'), { code: 'ENOSPC' }); };
  assert.throws(() => createStore(directory, io).setItem(KEY, 'new'), /Disk full/);
  assert.equal(store.getItem(KEY), 'old'); assert.equal(fs.existsSync(path.join(directory, 'board.json.tmp')), false);
});

test('Appearance preferences survive reopening in their own file', t => {
  const directory = temporaryDirectory(t), themeKey = 'shixu.studio.theme';
  const store = createStore(directory);
  assert.equal(store.getItem(themeKey), null);
  store.setItem(KEY, 'board');
  store.setItem(themeKey, 'whale');
  const reopened = createStore(directory);
  assert.equal(reopened.getItem(themeKey), 'whale');
  assert.equal(reopened.getItem(KEY), 'board');
});

test('Failed rename preserves old file and removes temporary content', t => {
  const directory = temporaryDirectory(t), store = createStore(directory);
  store.setItem(KEY, 'old');
  const io = Object.create(fs); io.renameSync = () => { throw new Error('File locked'); };
  assert.throws(() => createStore(directory, io).setItem(KEY, 'new'), /File locked/);
  assert.equal(store.getItem(KEY), 'old'); assert.equal(fs.existsSync(path.join(directory, 'board.json.tmp')), false);
});

test('Atomic write flushes before closing and replacing the file', () => {
  const order = [];
  const io = { openSync: () => (order.push('open'), 7), writeFileSync: () => order.push('write'), fsyncSync: () => order.push('flush'), closeSync: () => order.push('close'), renameSync: () => order.push('replace') };
  atomicWrite('board.json', '{}', io);
  assert.deepEqual(order, ['open', 'write', 'flush', 'close', 'replace']);
});

test('Malformed values and oversized files are rejected', t => {
  const directory = temporaryDirectory(t), store = createStore(directory);
  assert.throws(() => store.setItem(KEY, { title: 'not a string' }));
  assert.throws(() => store.setItem(KEY, 'x'.repeat(MAX_BYTES + 1)));
  fs.writeFileSync(path.join(directory, 'board.json'), '');
  fs.truncateSync(path.join(directory, 'board.json'), MAX_BYTES + 1);
  assert.throws(() => store.getItem(KEY), /過大/);
});

test('Preload exposes only scoped methods and propagates write failures', () => {
  const calls = [], exposed = {};
  const electron = {
    contextBridge: { exposeInMainWorld: (name, value) => exposed[name] = value },
    ipcRenderer: { sendSync: (channel, request) => { calls.push({ channel, request }); return request.operation === 'set' ? { ok: false, error: 'Disk full' } : { ok: true, value: 'stored' }; }, invoke: async () => undefined }
  };
  const context = vm.createContext({ require: name => { assert.equal(name, 'electron'); return electron; } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'preload.cjs'), 'utf8'), context);
  const api = exposed.studioDesktop;
  assert.deepEqual(Object.keys(api).sort(), ['getDataDirectory', 'getInitialBoardMode', 'openDataFolder', 'storage']);
  assert.equal(api.storage.getItem(KEY), 'stored');
  assert.throws(() => api.storage.setItem(KEY, '{}'), /Disk full/);
  assert.equal(calls[0].channel, 'studio:storage');
  assert.equal(api.send, undefined); assert.equal(api.require, undefined);
});
