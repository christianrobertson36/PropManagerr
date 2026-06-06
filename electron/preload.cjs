const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('propmanagerrLocal', {
  health: () => ipcRenderer.invoke('local:health'),
  login: (email, password) => ipcRenderer.invoke('local:login', { email, password }),
  dashboard: (user) => ipcRenderer.invoke('local:dashboard', user),
  complianceUpdates: () => ipcRenderer.invoke('local:compliance-updates'),

  createProperty: (property) => ipcRenderer.invoke('local:properties:create', property),
  updateProperty: (id, property) => ipcRenderer.invoke('local:properties:update', { id, property }),
  deleteProperty: (id) => ipcRenderer.invoke('local:properties:delete', id),

  createTenant: (tenant) => ipcRenderer.invoke('local:tenants:create', tenant),
  updateTenant: (id, tenant) => ipcRenderer.invoke('local:tenants:update', { id, tenant }),
  deleteTenant: (id) => ipcRenderer.invoke('local:tenants:delete', id),

  createPayment: (payment) => ipcRenderer.invoke('local:rent-payments:create', payment),
  updatePayment: (id, payment) => ipcRenderer.invoke('local:rent-payments:update', { id, payment }),
  deleteRentPayment: (id) => ipcRenderer.invoke('local:rent-payments:delete', id),
});
