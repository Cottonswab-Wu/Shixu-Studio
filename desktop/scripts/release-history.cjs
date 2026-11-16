'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const HISTORY_LIMIT = 3;
const zipName = version => `Shixu-Studio-${version}-Portable-win-x64.zip`;
const digest = filename => createHash('sha256').update(fs.readFileSync(filename)).digest('hex');

function compareVersions(a, b) {
  if (!VERSION.test(a) || !VERSION.test(b)) throw new Error('版本號必須是 major.minor.patch');
  const left = a.split('.').map(BigInt), right = b.split('.').map(BigInt);
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  return 0;
}

function nextVersion(current, bump = 'patch') {
  compareVersions(current, current);
  const index = ['major', 'minor', 'patch'].indexOf(bump);
  if (index < 0) {
    if (!VERSION.test(bump) || compareVersions(bump, current) <= 0) throw new Error('請指定 patch、minor、major 或更高的正式版本號');
    return bump;
  }
  const parts = current.split('.').map(BigInt);
  parts[index]++;
  for (let i = index + 1; i < 3; i++) parts[i] = 0n;
  return parts.join('.');
}

function isFile(filename) {
  return fs.existsSync(filename) && fs.lstatSync(filename).isFile();
}

function releasesIn(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory).flatMap(name => {
    const version = name.match(/^Shixu-Studio-(\d+\.\d+\.\d+)-Portable-win-x64\.zip$/)?.[1];
    return version && VERSION.test(version) && isFile(path.join(directory, name)) ? [version] : [];
  });
}

function checkTarget(directory, version) {
  compareVersions(version, version);
  const history = path.join(directory, 'history');
  for (const folder of [directory, history]) {
    if (fs.existsSync(folder) && !fs.lstatSync(folder).isDirectory()) throw new Error('發行目錄不可是連結或一般檔案：' + folder);
  }
  const known = [...releasesIn(directory), ...(fs.existsSync(history) ? fs.readdirSync(history).filter(name => VERSION.test(name)) : [])];
  if (known.some(previous => compareVersions(version, previous) <= 0)) throw new Error('發行版本必須高於所有現存版本；不可覆寫或降版');
  for (const previous of releasesIn(directory)) {
    if (!isFile(path.join(directory, zipName(previous) + '.sha256'))) throw new Error('舊發行包缺少校驗檔：' + previous);
  }
}

function withReleaseLock(root, operation) {
  const filename = path.join(root, '.release.lock');
  const descriptor = fs.openSync(filename, 'wx');
  fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  return Promise.resolve().then(operation).finally(() => { fs.closeSync(descriptor); fs.unlinkSync(filename); });
}

// Stage and validate the entire package before touching the previous release.
// Roll back every rename if publication fails; pruning happens only after commit.
function publishRelease(directory, version, stagedZip, options = {}) {
  checkTarget(directory, version);
  const name = zipName(version), checksum = stagedZip + '.sha256';
  if (!isFile(stagedZip) || !isFile(checksum)) throw new Error('缺少完整的新發行包');
  if (fs.readFileSync(checksum, 'utf8').trim() !== `${digest(stagedZip)}  ${name}`) throw new Error('新發行包 SHA-256 不符');
  fs.mkdirSync(directory, { recursive: true });
  const moves = [], created = [];
  const rename = options.rename || fs.renameSync;
  const move = (source, destination) => {
    if (fs.existsSync(destination)) throw new Error('發行檔案已存在：' + destination);
    rename(source, destination);
    moves.push([source, destination]);
  };
  try {
    for (const previous of releasesIn(directory)) {
      const folder = path.join(directory, 'history', previous);
      fs.mkdirSync(path.dirname(folder), { recursive: true });
      fs.mkdirSync(folder); created.push(folder);
      for (const suffix of ['', '.sha256']) move(path.join(directory, zipName(previous) + suffix), path.join(folder, zipName(previous) + suffix));
    }
    move(stagedZip, path.join(directory, name));
    move(checksum, path.join(directory, name + '.sha256'));
  } catch (error) {
    // Use the real rename for recovery even when a fault is injected in tests.
    for (const [source, destination] of moves.reverse()) fs.renameSync(destination, source);
    for (const folder of created.reverse()) fs.rmdirSync(folder);
    throw error;
  }
  const history = path.join(directory, 'history');
  try {
    if (!fs.existsSync(history)) return path.join(directory, name);
    const versions = fs.readdirSync(history).filter(name => VERSION.test(name)).sort((a, b) => compareVersions(b, a));
    for (const previous of versions.slice(HISTORY_LIMIT)) {
      // Resolve and validate every cleanup target. Unknown contents and links are preserved.
      const folder = path.resolve(history, previous);
      const expected = [zipName(previous), zipName(previous) + '.sha256'];
      try {
        if (path.dirname(folder) !== path.resolve(history) || !fs.lstatSync(folder).isDirectory()) continue;
        const contents = fs.readdirSync(folder);
        if (contents.length !== 2 || !expected.every(name => contents.includes(name) && isFile(path.join(folder, name)))) continue;
        for (const name of expected) fs.unlinkSync(path.join(folder, name));
        fs.rmdirSync(folder);
      } catch (error) {
        console.warn(`已發布 ${version}，但歷史 ${previous} 暫時無法清理：${error.message}`);
      }
    }
  } catch (error) {
    console.warn(`已發布 ${version}，但歷史目錄暫時無法清理：${error.message}`);
  }
  return path.join(directory, name);
}

module.exports = { nextVersion, compareVersions, checkTarget, publishRelease, withReleaseLock, HISTORY_LIMIT };
