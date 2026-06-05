const { app, BrowserWindow, Menu, ipcMain, shell, dialog } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const DEFAULT_SERVER_URL = process.env.PROPMANAGERR_SERVER_URL || 'http://192.168.1.177';

let mainWindow;

function getConfigPath() {
  return path.join(app.getPath('userData'), 'config.json');
}

function normaliseServerUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

function readConfig() {
  const configPath = getConfigPath();
  try {
    if (fs.existsSync(configPath)) {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return {
        serverUrl: normaliseServerUrl(parsed.serverUrl) || '',
      };
    }
  } catch (error) {
    console.error('Failed to read config:', error);
  }

  return {
    serverUrl: normaliseServerUrl(DEFAULT_SERVER_URL),
  };
}

function writeConfig(nextConfig) {
  const configPath = getConfigPath();
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  const config = {
    serverUrl: normaliseServerUrl(nextConfig.serverUrl),
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  return config;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'PropManagerr',
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load ${validatedURL}: ${errorCode} ${errorDescription}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadFile(path.join(__dirname, 'settings.html'), {
        query: { error: 'Unable to connect to the PropManagerr server.' },
      });
    }
  });

  loadConfiguredServer();
}

function loadConfiguredServer() {
  const { serverUrl } = readConfig();

  if (!serverUrl) {
    mainWindow.loadFile(path.join(__dirname, 'settings.html'));
    return;
  }

  mainWindow.loadURL(serverUrl);
}

function openSettings() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.loadFile(path.join(__dirname, 'settings.html'));
}

function buildMenu() {
  const template = [
    {
      label: 'PropManagerr',
      submenu: [
        {
          label: 'Open App',
          click: () => loadConfiguredServer(),
        },
        {
          label: 'Server Settings',
          click: () => openSettings(),
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'Ctrl+R',
          click: () => mainWindow?.reload(),
        },
        {
          label: 'Hard Reload',
          accelerator: 'Ctrl+Shift+R',
          click: () => mainWindow?.webContents.reloadIgnoringCache(),
        },
        { type: 'separator' },
        {
          label: 'Exit',
          role: 'quit',
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open Developer Tools',
          accelerator: 'Ctrl+Shift+I',
          click: () => mainWindow?.webContents.openDevTools(),
        },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About PropManagerr',
              message: 'PropManagerr Desktop',
              detail: 'Windows desktop client for your PropManagerr server.',
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

ipcMain.handle('config:get', () => readConfig());

ipcMain.handle('config:save', (_event, nextConfig) => {
  const config = writeConfig(nextConfig);
  if (!config.serverUrl) {
    throw new Error('Enter a valid http:// or https:// server URL.');
  }
  setTimeout(() => loadConfiguredServer(), 150);
  return config;
});

ipcMain.handle('app:open-settings', () => {
  openSettings();
  return true;
});

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
