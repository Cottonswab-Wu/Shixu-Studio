'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('Desktop renderer is generated from the current web source', () => {
  const web = fs.readFileSync(path.join(root, '..', 'web', 'index.html'), 'utf8');
  assert.equal(JSON.parse(read('app/source.json')).sha256, createHash('sha256').update(web).digest('hex'));
  const renderer = read('app/renderer.js');
  assert.doesNotThrow(() => new vm.Script(renderer));
  assert(renderer.includes('const storage = window.studioDesktop.storage;'));
  assert(!/\blocalStorage\./.test(renderer));
  assert(renderer.includes('storage.setItem(KEY,raw)'));
});

test('Desktop CSP permits local scripts and prohibits network connections', () => {
  const html = read('app/index.html');
  assert(!/<script>([\s\S]*?)<\/script>/.test(html));
  assert(html.includes('script-src \'self\''));
  assert(html.includes('connect-src \'none\''));
  assert(!/<(?:script|link|img)[^>]+(?:src|href)=["']https?:/i.test(html));
  assert(html.includes('id="desktopDataFolder"'));
  assert(!html.includes('無痕模式、清除瀏覽器資料或移動檔案'));
});

test('Windows package includes the application and native storage, without web-folder dependency', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.equal(pkg.main, 'main.cjs');
  assert(pkg.build.files.includes('storage.cjs'));
  assert(pkg.build.files.includes('app/**/*'));
  assert.equal(pkg.build.win.target[0].target, 'dir');
  assert(pkg.build.win.target[0].arch.includes('x64'));
  assert.equal(pkg.build.publish, null);
  assert(!read('main.cjs').includes("'..', 'web'"));
});

test('Generated ICO includes all expected sizes and a 256-pixel entry', () => {
  const buffer = fs.readFileSync(path.join(root, 'assets', 'icon.ico'));
  assert.equal(buffer.readUInt16LE(2), 1);
  assert.equal(buffer.readUInt16LE(4), 7);
  assert.equal(buffer[6 + 6 * 16], 0);
  const offset = buffer.readUInt32LE(6 + 6 * 16 + 12);
  assert.equal(buffer.readInt32LE(offset + 4), 256);
  assert.equal(buffer.readInt32LE(offset + 8), 512);
});
