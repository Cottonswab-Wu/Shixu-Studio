'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { pathToFileURL } = require('node:url');

test('Main startup creates user data, restricts IPC to its main frame and blocks external navigation', async t => {
  const base = path.resolve(__dirname, '..', '.test-data'); fs.mkdirSync(base, { recursive: true });
  const temporary = fs.mkdtempSync(path.join(base, 'shixu-main-test-'));
  t.after(() => { const absolute = path.resolve(temporary); if (path.dirname(absolute) !== base || !path.basename(absolute).startsWith('shixu-main-test-')) throw new Error('Unexpected cleanup path'); fs.rmSync(absolute, { recursive: true, force: true }); });
  const root = path.resolve(__dirname, '..'), app = new EventEmitter(), ipcMain = new EventEmitter(), dialogs = [];
  let window, choice = 0;
  Object.assign(app, {
    getPath: () => temporary, setName() {}, setAppUserModelId() {},
    setPath: (_name, directory) => { assert(fs.statSync(directory).isDirectory(), 'userData must exist before app.setPath'); },
    requestSingleInstanceLock: () => true, whenReady: () => Promise.resolve(), quit() { assert.fail('App should not quit during normal startup'); }
  });
  class Window extends EventEmitter {
    constructor(options) {
      super(); window = this; this.options = options;
      const session = new EventEmitter();
      Object.assign(session, { webRequest: { onBeforeRequest: fn => session.request = fn }, setPermissionRequestHandler: fn => session.permission = fn, setPermissionCheckHandler: fn => session.permissionCheck = fn });
      this.webContents = new EventEmitter();
      Object.assign(this.webContents, { session, mainFrame: { url: pathToFileURL(path.join(root, 'app', 'index.html')).href }, setWindowOpenHandler: fn => this.webContents.openWindow = fn });
    }
    removeMenu() {} isDestroyed() { return false; } loadFile() { return Promise.resolve(); }
  }
  ipcMain.handle = (name, handler) => { ipcMain[name] = handler; };
  const electron = { app, ipcMain, BrowserWindow: Window, Menu: { buildFromTemplate: x => x, setApplicationMenu() {} },
    dialog: { showErrorBox: (...args) => dialogs.push(args), showMessageBoxSync: () => choice }, shell: { openPath: async () => '' },
    screen: { getPrimaryDisplay: () => ({ workArea: { width: 1440, height: 1000 } }) } };
  const context = { __dirname: root, setTimeout, clearTimeout, process: { env: {} }, require: name => name === 'electron' ? electron : name.startsWith('./') ? require(path.join(root, name)) : require(name) };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'main.cjs'), 'utf8'), context);
  await Promise.resolve(); await Promise.resolve();
  assert(window); assert.deepEqual(dialogs, []);
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.options.webPreferences.contextIsolation, true); assert.equal(window.options.webPreferences.sandbox, true);
  const event = () => ({ sender: window.webContents, senderFrame: window.webContents.mainFrame });
  const write = event(); ipcMain.emit('studio:storage', write, { operation: 'set', key: 'shixu.studio.board.v1', value: '{"title":"stored"}' });
  assert.equal(write.returnValue.ok, true);
  const read = event(); ipcMain.emit('studio:storage', read, { operation: 'get', key: 'shixu.studio.board.v1' }); assert.equal(read.returnValue.value, '{"title":"stored"}');
  const spoofed = { sender: window.webContents, senderFrame: { url: window.webContents.mainFrame.url } };
  ipcMain.emit('studio:storage', spoofed, { operation: 'get', key: 'shixu.studio.board.v1' }); assert.equal(spoofed.returnValue.ok, false);
  const arbitrary = event(); ipcMain.emit('studio:storage', arbitrary, { operation: 'get', key: '../../secret' }); assert.equal(arbitrary.returnValue.ok, false);
  let prevented = false; window.webContents.emit('will-navigate', { preventDefault: () => prevented = true }, 'https://example.com'); assert(prevented);
  assert.equal(window.webContents.openWindow().action, 'deny');
  let canceled; window.webContents.session.request({ url: 'https://example.com/' }, result => canceled = result.cancel); assert.equal(canceled, true);
  window.webContents.session.request({ url: window.webContents.mainFrame.url }, result => canceled = result.cancel); assert.equal(canceled, false);
  let ignoredUnload = false; const unload = { preventDefault: () => ignoredUnload = true };
  window.webContents.emit('will-prevent-unload', unload); assert.equal(ignoredUnload, false);
  choice = 1; window.webContents.emit('will-prevent-unload', unload); assert.equal(ignoredUnload, true);
});
