import { app, BrowserWindow, session } from 'electron';
import * as path from 'path';
import { TabManager } from './tab-manager';
import { Blocker } from './blocker';
import { SecurityAnalyzer } from './security-analyzer';
import { TorManager } from './tor-manager';
import { BookmarkManager } from './bookmark-manager';
import { DownloadManager } from './download-manager';
import { SettingsManager } from './settings-manager';
import { setupMenu } from './menu';
import { setupIpcHandlers } from './ipc-handlers';

const settingsManager = new SettingsManager();
const SEARCH_ANGEL_URL = settingsManager.get('homepage');

let mainWindow: BrowserWindow | null = null;
let tabManager: TabManager | null = null;
let blocker: Blocker | null = null;
let securityAnalyzer: SecurityAnalyzer | null = null;
let torManager: TorManager | null = null;
let bookmarkManager: BookmarkManager | null = null;
let downloadManager: DownloadManager | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Angle Browser',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '..', '..', 'src', 'renderer', 'index.html'));

  // Initialize all components
  blocker = new Blocker();
  securityAnalyzer = new SecurityAnalyzer();
  torManager = new TorManager();
  bookmarkManager = new BookmarkManager();
  downloadManager = new DownloadManager(mainWindow);
  tabManager = new TabManager(mainWindow, SEARCH_ANGEL_URL, blocker, securityAnalyzer);

  // Setup
  setupIpcHandlers(mainWindow, tabManager, blocker, securityAnalyzer, torManager, bookmarkManager, downloadManager, settingsManager);
  setupMenu(mainWindow, tabManager);
  blocker.setup(session.defaultSession);
  downloadManager.setup(session.defaultSession);

  // First tab
  mainWindow.webContents.once('did-finish-load', () => {
    tabManager!.createTab(SEARCH_ANGEL_URL);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    tabManager = null;
  });
}

// Privacy flags
app.commandLine.appendSwitch('disable-features', 'SpareRendererForSitePerProcess');
app.commandLine.appendSwitch('disable-client-side-phishing-detection');
app.commandLine.appendSwitch('disable-component-update');

app.whenReady().then(() => {
  session.defaultSession.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  );
  session.defaultSession.cookies.flushStore();
  createWindow();
});

app.on('window-all-closed', () => {
  if (settingsManager.get('clearDataOnExit')) {
    session.defaultSession.clearStorageData({
      storages: ['cookies', 'localstorage', 'cachestorage'],
    });
  }
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
