'use strict';
const { contextBridge, ipcRenderer } = require('electron');

function storageRequest(operation, key, value) {
  const response = ipcRenderer.sendSync('studio:storage', { operation, key, value });
  if (!response || !response.ok) throw new Error(response?.error || '無法存取本機資料');
  return response.value;
}

// Expose narrowly scoped methods; Node.js and raw IPC stay outside the page.
contextBridge.exposeInMainWorld('studioDesktop', {
  storage: {
    getItem: key => storageRequest('get', key),
    setItem: (key, value) => storageRequest('set', key, value),
    removeItem: key => storageRequest('remove', key)
  },
  getDataDirectory: () => storageRequest('directory'),
  getInitialBoardMode: () => storageRequest('initial-mode'),
  openDataFolder: () => ipcRenderer.invoke('studio:open-data-folder')
});
