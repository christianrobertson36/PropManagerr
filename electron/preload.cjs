const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('propmanagerrLocal', {
  health: () => ipcRenderer.invoke('local:health'),
  login: (email, password) => ipcRenderer.invoke('local:login', { email, password }),
  dashboard: (user) => ipcRenderer.invoke('local:dashboard', user),
  complianceUpdates: () => ipcRenderer.invoke('local:compliance-updates'),
  createProperty: (property) => ipcRenderer.invoke('local:properties:create', property),
  updateProperty: (id, property) => ipcRenderer.invoke('local:properties:update', { id, property }),
  deleteProperty: (id) => ipcRenderer.invoke('local:properties:delete', id),
});
