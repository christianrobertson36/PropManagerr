const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('node:path');
const localDb = require('./local-db.cjs');

let mainWindow;

function appEntryPath() {
  return path.join(__dirname, '..', 'dist', 'index.html');
}

function createMainWindow() {
  localDb.openDatabase(app);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'PropManagerr Local Desktop',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.loadFile(appEntryPath()).catch((error) => {
    console.error('Failed to load local app:', error);
    mainWindow.loadFile(path.join(__dirname, 'local-status.html'));
  });
}

function openLocalApp() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadFile(appEntryPath()).catch(() => openLocalStatus());
}

function openLocalStatus() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadFile(path.join(__dirname, 'local-status.html'));
}

function buildMenu() {
  const template = [
    {
      label: 'PropManagerr Local',
      submenu: [
        { label: 'Open App', click: () => openLocalApp() },
        { label: 'Local Database Status', click: () => openLocalStatus() },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'Ctrl+R', click: () => mainWindow?.reload() },
        {
          label: 'Open Developer Tools',
          accelerator: 'Ctrl+Shift+I',
          click: () => mainWindow?.webContents.openDevTools(),
        },
        { type: 'separator' },
        { label: 'Exit', role: 'quit' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About PropManagerr Local Desktop',
              message: 'PropManagerr Local Desktop',
              detail: 'Offline Windows desktop edition using a local SQLite database.',
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('local:health', () => localDb.health());
ipcMain.handle('local:login', (_event, { email, password }) => localDb.login(email, password));
ipcMain.handle('local:dashboard', (_event, user) => localDb.dashboard(user));
ipcMain.handle('local:compliance-updates', () => localDb.complianceUpdates());
ipcMain.handle('local:properties:create', (_event, property) => localDb.createProperty(property));
ipcMain.handle('local:properties:update', (_event, { id, property }) =>
  localDb.updateProperty(id, property)
);
ipcMain.handle('local:properties:delete', (_event, id) => localDb.deleteProperty(id));

app.whenReady().then(() => {
  buildMenu();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
