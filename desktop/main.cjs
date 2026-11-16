'use strict';
const { app, BrowserWindow, ipcMain, Menu, dialog, shell, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createStore, atomicWrite } = require('./storage.cjs');
const { distributionProfile } = require('./distribution.cjs');

const appDirectory = path.join(__dirname, 'app');
const entry = path.join(appDirectory, 'index.html');
const entryURL = pathToFileURL(entry).href;
const profile = distributionProfile({ packaged: app.isPackaged, metadata: require('./package.json'),
  appData: app.getPath('appData'), executablePath: app.getPath('exe'),
  portableDirectory: process.env.PORTABLE_EXECUTABLE_DIR });
const dataRoot = profile.dataRoot;
const dataDirectory = path.join(dataRoot, 'data');
app.setName('Shixu Studio');
let startupError;
try {
  fs.mkdirSync(dataRoot, { recursive: true });
  app.setPath('userData', dataRoot);
} catch (error) { startupError = error; }
app.setAppUserModelId(profile.applicationId);

let mainWindow = null;
let store;
let boundsTimer;
const trusted = event => Boolean(mainWindow && !mainWindow.isDestroyed() &&
  event.sender === mainWindow.webContents && event.senderFrame === mainWindow.webContents.mainFrame &&
  event.senderFrame.url === entryURL);

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
  try {
    atomicWrite(path.join(dataRoot, 'window.json'), JSON.stringify({
      ...mainWindow.getNormalBounds(), maximized: mainWindow.isMaximized()
    }));
  } catch { /* Board persistence reports its own failures; bounds are optional. */ }
}

function windowOptions() {
  const area = screen.getPrimaryDisplay().workArea;
  const fallback = { width: Math.min(1440, area.width), height: Math.min(940, area.height) };
  try {
    const saved = JSON.parse(fs.readFileSync(path.join(dataRoot, 'window.json'), 'utf8'));
    if (!['x', 'y', 'width', 'height'].every(key => Number.isFinite(saved[key])) || saved.width < 640 || saved.height < 480) return fallback;
    const display = screen.getDisplayMatching(saved).workArea;
    const width = Math.min(Math.round(saved.width), display.width);
    const height = Math.min(Math.round(saved.height), display.height);
    return { width, height, x: Math.max(display.x, Math.min(saved.x, display.x + display.width - width)),
      y: Math.max(display.y, Math.min(saved.y, display.y + display.height - height)), maximized: saved.maximized === true };
  } catch { return fallback; }
}

function createWindow() {
  const options = windowOptions();
  const { maximized, ...bounds } = options;
  const win = new BrowserWindow({
    ...bounds, minWidth: 760, minHeight: 560, title: '拾序 Studio', show: false,
    backgroundColor: '#f7f8fa', icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false,
      contextIsolation: true, sandbox: true, webSecurity: true, spellcheck: false,
      webviewTag: false, navigateOnDragDrop: false, backgroundThrottling: false
    }
  });
  mainWindow = win;
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => { if (url !== entryURL) event.preventDefault(); });
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  const allowedFiles = new Set(['index.html', 'renderer.js', 'styles.css'].map(name => pathToFileURL(path.join(appDirectory, name)).href));
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url.split('#')[0];
    callback({ cancel: !(allowedFiles.has(url) || url.startsWith('blob:') || url.startsWith('data:')) });
  });
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.session.setPermissionCheckHandler(() => false);
  win.webContents.session.on('will-download', (_event, item, contents) => {
    if (contents !== win.webContents || !item.getURL().startsWith('blob:')) { item.cancel(); return; }
    item.setSaveDialogOptions({ title: '儲存拾序備份', defaultPath: path.join(app.getPath('downloads'), path.basename(item.getFilename())),
      filters: [{ name: 'JSON 備份', extensions: ['json'] }], properties: ['createDirectory', 'showOverwriteConfirmation'] });
  });
  win.webContents.on('will-prevent-unload', event => {
    const choice = dialog.showMessageBoxSync(win, { type: 'warning', title: '還有尚未儲存的資料',
      message: '部分變更尚未成功儲存。', detail: '請先回到看板匯出備份；直接關閉會失去尚未儲存的變更。',
      buttons: ['返回匯出備份', '仍要關閉'], defaultId: 0, cancelId: 0, noLink: true });
    if (choice === 1) event.preventDefault();
  });
  win.once('ready-to-show', () => { if (maximized) win.maximize(); win.show(); });
  for (const event of ['resize', 'move']) win.on(event, () => { clearTimeout(boundsTimer); boundsTimer = setTimeout(saveWindowState, 300); });
  win.on('close', saveWindowState);
  win.on('closed', () => { clearTimeout(boundsTimer); mainWindow = null; });
  win.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason !== 'clean-exit') dialog.showErrorBox('拾序視窗意外停止', '已成功儲存的資料仍在本機。請重新開啟應用程式；未成功儲存的最後變更可能無法還原。');
  });
  win.loadFile(entry).catch(error => { dialog.showErrorBox('無法開啟看板', error.message); app.quit(); });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus(); } });
  app.whenReady().then(() => {
    try { if (startupError) throw startupError; store = createStore(dataDirectory); }
    catch (error) { dialog.showErrorBox('無法開啟資料資料夾', '無法建立本機資料儲存位置：\n' + dataDirectory + '\n\n' + error.message); app.quit(); return; }
    ipcMain.on('studio:storage', (event, request) => {
      try {
        if (!trusted(event) || !request || typeof request !== 'object') throw new Error('不允許的資料請求');
        let value;
        switch (request.operation) {
          case 'get': value = store.getItem(request.key); break;
          case 'set': store.setItem(request.key, request.value); break;
          case 'remove': store.removeItem(request.key); break;
          case 'directory': value = store.directory; break;
          case 'initial-mode': value = profile.initialBoard; break;
          default: throw new Error('不允許的儲存操作');
        }
        event.returnValue = { ok: true, value };
      } catch (error) { event.returnValue = { ok: false, error: error.message }; }
    });
    ipcMain.handle('studio:open-data-folder', async event => {
      if (!trusted(event)) throw new Error('不允許的請求');
      const error = await shell.openPath(dataDirectory);
      if (error) throw new Error(error);
    });
    // Keep standard edit shortcuts available without adding chrome to the UI.
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: '編輯', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
      { label: '檢視', submenu: [{ role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] }
    ]));
    createWindow();
  }).catch(error => { dialog.showErrorBox('啟動失敗', error.message); app.quit(); });
  app.on('activate', () => { if (!mainWindow && store) createWindow(); });
  app.on('window-all-closed', () => app.quit());
}
