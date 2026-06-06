const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('propmanagerrLocal', {
  health: () => ipcRenderer.invoke('local:health'),
  login: (email, password) => ipcRenderer.invoke('local:login', { email, password }),
  dashboard: (user) => ipcRenderer.invoke('local:dashboard', user),
});
