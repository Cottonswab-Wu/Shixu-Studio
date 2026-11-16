'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');

test('Folder release archive includes runtime files and refuses board data', t => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shixu-archive-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const stage = path.join(tmp, 'stage'), folder = path.join(stage, 'release');
  fs.mkdirSync(path.join(folder, 'resources'), { recursive: true });
  for (const [name, value] of Object.entries({ 'Shixu-Studio.exe': 'exe', 'README.txt': 'readme', 'SHA256SUMS.txt': 'hash', 'resources/app.asar': 'app', 'resources/runtime.dat': 'runtime' })) fs.writeFileSync(path.join(folder, name), value);
  const hash = createHash('sha256').update('exe').digest('hex');
  const run = name => spawnSync('python', [path.join(__dirname, '..', 'scripts', 'archive_release.py'), stage, path.join(tmp, name), 'release', hash], { encoding: 'utf8' });
  assert.equal(run('good.zip').status, 0);
  fs.mkdirSync(path.join(folder, 'ShixuStudioData'));
  fs.writeFileSync(path.join(folder, 'ShixuStudioData', 'board.json'), 'private');
  assert.notEqual(run('bad.zip').status, 0);
});
