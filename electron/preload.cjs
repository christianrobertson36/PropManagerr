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

  createExpense: (expense) => ipcRenderer.invoke('local:expenses:create', expense),
  updateExpense: (id, expense) => ipcRenderer.invoke('local:expenses:update', { id, expense }),
  deleteExpense: (id) => ipcRenderer.invoke('local:expenses:delete', id),

  createTicket: (ticket) => ipcRenderer.invoke('local:maintenance:create', ticket),
  updateMaintenanceTicket: (id, ticket) => ipcRenderer.invoke('local:maintenance:update', { id, ticket }),
  deleteMaintenanceTicket: (id) => ipcRenderer.invoke('local:maintenance:delete', id),

  uploadDocument: (payload) => ipcRenderer.invoke('local:documents:upload', payload),
  createDocument: (document) => ipcRenderer.invoke('local:documents:create', document),
  updateDocument: (id, document) => ipcRenderer.invoke('local:documents:update', { id, document }),
  deleteDocument: (id) => ipcRenderer.invoke('local:documents:delete', id),

  listAdminAccounts: () => ipcRenderer.invoke('local:admin-accounts:list'),
  createAdminAccount: (account) => ipcRenderer.invoke('local:admin-accounts:create', account),
  updateAdminAccount: (id, account) => ipcRenderer.invoke('local:admin-accounts:update', { id, account }),
deleteAdminAccount: (id) => ipcRenderer.invoke('local:admin-accounts:delete', id), });
