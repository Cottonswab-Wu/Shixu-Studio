'use strict';
const fs = require('node:fs');
const path = require('node:path');

const KEY = 'shixu.studio.board.v1';
const FILES = new Map([[KEY, 'board.json'], [KEY + '.previous', 'board.previous.json'], [KEY + '.probe', '.write-probe'], ['shixu.studio.theme', 'theme.txt']]);
const MAX_BYTES = 24 * 1024 * 1024;

// Write and flush a sibling temporary file before atomically replacing the
// destination. A failed write never truncates the last successful board.
function atomicWrite(filename, value, io = fs) {
  const temporary = filename + '.tmp';
  let descriptor;
  try {
    descriptor = io.openSync(temporary, 'w', 0o600);
    io.writeFileSync(descriptor, value, 'utf8');
    io.fsyncSync(descriptor);
    io.closeSync(descriptor);
    descriptor = undefined;
    io.renameSync(temporary, filename);
  } catch (error) {
    if (descriptor !== undefined) { try { io.closeSync(descriptor); } catch {} }
    try { io.unlinkSync(temporary); } catch {}
    throw error;
  }
}

function createStore(directory, io = fs) {
  const root = path.resolve(directory);
  io.mkdirSync(root, { recursive: true });
  const filenameFor = key => {
    if (!FILES.has(key)) throw new Error('不允許存取此資料項目');
    return path.join(root, FILES.get(key));
  };
  return {
    directory: root,
    getItem(key) {
      const filename = filenameFor(key);
      try {
        if (io.statSync(filename).size > MAX_BYTES) throw new Error('資料檔案過大，請從備份還原');
        return io.readFileSync(filename, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
    },
    setItem(key, value) {
      const filename = filenameFor(key);
      if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > MAX_BYTES) throw new Error('資料格式或大小不符');
      atomicWrite(filename, value, io);
    },
    removeItem(key) {
      // The renderer only needs to remove its write probe. Board deletion is
      // represented by a validated board, never by deleting arbitrary files.
      if (key !== KEY + '.probe') throw new Error('不允許移除此資料項目');
      try { io.unlinkSync(filenameFor(key)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  };
}

module.exports = { createStore, atomicWrite, KEY, MAX_BYTES };
