const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('propmanagerr', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (config) => ipcRenderer.invoke('config:save', config),
  openSettings: () => ipcRenderer.invoke('app:open-settings'),
});
