import { ipcMain, BrowserWindow, shell, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { TabManager } from './tab-manager';
import { Blocker } from './blocker';
import { SecurityAnalyzer } from './security-analyzer';
import { TorManager } from './tor-manager';
import { BookmarkManager } from './bookmark-manager';
import { DownloadManager } from './download-manager';
import { SettingsManager } from './settings-manager';

// ── History Storage ─────────────────────────────────────────
interface HistoryItem {
  id: string;
  title: string;
  url: string;
  timestamp: number;
}

function getHistoryPath(): string {
  try { return path.join(app.getPath('userData'), 'history.json'); }
  catch { return '/tmp/angle-browser-history.json'; }
}

function readHistory(): HistoryItem[] {
  try { return JSON.parse(fs.readFileSync(getHistoryPath(), 'utf8')); }
  catch { return []; }
}

function writeHistory(items: HistoryItem[]): void {
  try { fs.writeFileSync(getHistoryPath(), JSON.stringify(items, null, 2)); }
  catch { /* ignore */ }
}

export function addHistoryItem(title: string, url: string): void {
  if (url.startsWith('file://') || url === 'about:blank') return;
  const items = readHistory();
  items.unshift({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title,
    url,
    timestamp: Date.now(),
  });
  // Keep last 1000 entries
  writeHistory(items.slice(0, 1000));
}

let sidebarOpen = false;
const SIDEBAR_WIDTH = 300;
const BOOKMARKS_BAR_HEIGHT = 28;

export function setupIpcHandlers(
  window: BrowserWindow,
  tabManager: TabManager,
  blocker: Blocker,
  security: SecurityAnalyzer,
  torManager: TorManager,
  bookmarks: BookmarkManager,
  downloads: DownloadManager,
  settings: SettingsManager
): void {
  // ── Tab management ────────────────────────────────────────
  ipcMain.on('new-tab', (_e, url?: string) => tabManager.createTab(url));
  ipcMain.on('close-tab', (_e, tabId: number) => tabManager.closeTab(tabId));
  ipcMain.on('switch-tab', (_e, tabId: number) => tabManager.switchTab(tabId));

  // ── Navigation ────────────────────────────────────────────
  ipcMain.on('navigate', (_e, url: string) => tabManager.navigateTo(url));
  ipcMain.on('go-back', () => tabManager.goBack());
  ipcMain.on('go-forward', () => tabManager.goForward());
  ipcMain.on('reload', () => tabManager.reload());
  ipcMain.on('go-home', () => tabManager.goHome());

  // ── Internal pages (allowlisted to prevent path traversal) ──
  const ALLOWED_PAGES = new Set(['downloads', 'bookmarks', 'settings', 'history', 'internet-map']);
  ipcMain.on('open-page', (_e, page: string) => {
    if (!ALLOWED_PAGES.has(page)) {
      console.warn(`[SECURITY] Blocked open-page for unauthorized page: ${page}`);
      return;
    }
    const pagePath = path.join(__dirname, '..', '..', 'src', 'renderer', `${page}.html`);
    tabManager.createTab(`file://${pagePath}`);
  });

  // ── Blocker ───────────────────────────────────────────────
  ipcMain.handle('toggle-blocker', () => blocker.toggle());
  ipcMain.handle('get-blocker-stats', () => ({
    enabled: blocker.enabled,
    totalBlocked: blocker.blockedTotal,
  }));

  // ── Tor ───────────────────────────────────────────────────
  ipcMain.handle('toggle-tor', async () => {
    const enabled = await torManager.toggle();
    window.webContents.send('tor-status-changed', enabled);
    const tab = tabManager.getActiveTab();
    if (tab) tab.view.webContents.reload();
    return enabled;
  });
  ipcMain.handle('get-tor-status', () => ({ enabled: torManager.enabled }));
  ipcMain.handle('get-tor-circuit', async () => torManager.getCircuitInfo());

  // ── Sidebar ───────────────────────────────────────────────
  ipcMain.on('toggle-sidebar', () => {
    sidebarOpen = !sidebarOpen;
    resizeBrowserView();
    window.webContents.send('sidebar-toggled', sidebarOpen);
  });

  // ── Security ──────────────────────────────────────────────
  ipcMain.handle('get-security-info', async () => {
    const tab = tabManager.getActiveTab();
    if (!tab) return null;
    return security.analyze(tab.view.webContents, tab.url);
  });

  // ── Tabs ──────────────────────────────────────────────────
  ipcMain.handle('get-tabs', () => tabManager.getAllTabs());

  // ── Bookmarks ─────────────────────────────────────────────
  ipcMain.handle('get-bookmarks', () => bookmarks.getAll());
  ipcMain.handle('get-bar-bookmarks', () => bookmarks.getBarBookmarks());
  ipcMain.handle('add-bookmark', (_e, title: string, url: string, favicon: string) => {
    return bookmarks.add(title, url, favicon);
  });
  ipcMain.handle('remove-bookmark', (_e, id: string) => bookmarks.remove(id));
  ipcMain.handle('is-bookmarked', (_e, url: string) => bookmarks.isBookmarked(url));
  ipcMain.handle('toggle-bookmark', (_e, title: string, url: string) => {
    const existing = bookmarks.findByUrl(url);
    if (existing) {
      bookmarks.remove(existing.id);
      return false;
    } else {
      bookmarks.add(title, url);
      return true;
    }
  });

  // ── Downloads ─────────────────────────────────────────────
  ipcMain.handle('get-downloads', () => downloads.getHistory());
  ipcMain.handle('clear-downloads', () => {
    downloads.clearHistory();
    return true;
  });
  ipcMain.on('open-download', (_e, filePath: string) => {
    // Validate path is within Downloads directory to prevent arbitrary file exec
    const downloadsDir = require('electron').app.getPath('downloads');
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(downloadsDir)) {
      console.warn(`[SECURITY] Blocked open-download outside Downloads: ${filePath}`);
      return;
    }
    shell.openPath(resolved);
  });
  ipcMain.on('show-download', (_e, filePath: string) => {
    const downloadsDir = require('electron').app.getPath('downloads');
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(downloadsDir)) {
      console.warn(`[SECURITY] Blocked show-download outside Downloads: ${filePath}`);
      return;
    }
    shell.showItemInFolder(resolved);
  });

  // ── Settings ──────────────────────────────────────────────
  ipcMain.handle('get-settings', () => settings.getAll());
  ipcMain.handle('set-setting', (_e, key: string, value: any) => {
    settings.set(key as any, value);
    return settings.getAll();
  });
  ipcMain.handle('reset-settings', () => {
    settings.reset();
    return settings.getAll();
  });

  // ── Zoom ──────────────────────────────────────────────────
  ipcMain.handle('zoom-in', () => {
    const tab = tabManager.getActiveTab();
    if (!tab) return 100;
    const level = tab.view.webContents.getZoomFactor();
    const newLevel = Math.min(level + 0.1, 3.0);
    tab.view.webContents.setZoomFactor(newLevel);
    return Math.round(newLevel * 100);
  });
  ipcMain.handle('zoom-out', () => {
    const tab = tabManager.getActiveTab();
    if (!tab) return 100;
    const level = tab.view.webContents.getZoomFactor();
    const newLevel = Math.max(level - 0.1, 0.3);
    tab.view.webContents.setZoomFactor(newLevel);
    return Math.round(newLevel * 100);
  });
  ipcMain.handle('zoom-reset', () => {
    const tab = tabManager.getActiveTab();
    if (!tab) return 100;
    tab.view.webContents.setZoomFactor(1.0);
    return 100;
  });
  ipcMain.handle('get-zoom', () => {
    const tab = tabManager.getActiveTab();
    if (!tab) return 100;
    return Math.round(tab.view.webContents.getZoomFactor() * 100);
  });

  // ── History ────────────────────────────────────────────────
  ipcMain.handle('get-history', () => readHistory());
  ipcMain.handle('clear-history', () => { writeHistory([]); return true; });
  ipcMain.handle('delete-history-item', (_e, id: string) => {
    const items = readHistory().filter(i => i.id !== id);
    writeHistory(items);
    return true;
  });

  // Track page visits for history
  // Note: called from tab-manager on did-navigate
  ipcMain.on('add-history', (_e, title: string, url: string) => {
    addHistoryItem(title, url);
  });

  // ── Phantom Mode (ephemeral Docker containers) ────────────
  const PHANTOM_API = 'https://sa.atlasiant.com/api/v1/phantom';
  const http = require('https');

  ipcMain.handle('phantom-start', async () => {
    const fetch = (await import('node:https')).default || require('http');
    return new Promise((resolve, reject) => {
      const req = http.request(`${PHANTOM_API}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error(data)); }
        });
      });
      req.on('error', reject);
      req.end();
    });
  });

  ipcMain.handle('phantom-end', async (_e, sessionId: string) => {
    // Validate sessionId is hex-only to prevent path injection
    if (!/^[a-f0-9]+$/.test(sessionId)) {
      return { status: 'error', message: 'Invalid session ID' };
    }
    return new Promise((resolve, reject) => {
      const req = http.request(`${PHANTOM_API}/end/${sessionId}`, {
        method: 'DELETE',
      }, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve({ status: 'destroyed' }); }
        });
      });
      req.on('error', reject);
      req.end();
    });
  });

  ipcMain.handle('phantom-status', async (_e, sessionId: string) => {
    if (!/^[a-f0-9]+$/.test(sessionId)) return null;
    return new Promise((resolve, reject) => {
      http.get(`${PHANTOM_API}/status/${sessionId}`, (res: any) => {
        let data = '';
        res.on('data', (chunk: string) => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve(null); }
        });
      }).on('error', reject);
    });
  });

  // ── DNS lookup (for Internet Map) ─────────────────────────
  ipcMain.handle('dns-lookup', async (_e, domain: string) => {
    // Validate domain format to prevent internal network recon
    if (!domain || !/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
      return { domain, addresses: [], error: 'Invalid domain format' };
    }
    // Block internal/private hostnames
    const blocked = ['localhost', 'internal', 'local', 'corp', 'intranet'];
    if (blocked.some(b => domain.toLowerCase().includes(b))) {
      return { domain, addresses: [], error: 'Internal domains not allowed' };
    }
    const dns = require('dns').promises;
    try {
      const addresses = await dns.resolve4(domain);
      return { domain, addresses, error: null };
    } catch (err: any) {
      return { domain, addresses: [], error: err.message };
    }
  });

  // ── Window resize ─────────────────────────────────────────
  window.on('resize', () => resizeBrowserView());

  function resizeBrowserView() {
    const tab = tabManager.getActiveTab();
    if (!tab) return;
    const bounds = window.getBounds();
    const showBar = settings.get('showBookmarksBar');
    const chromeH = 82 + (showBar ? BOOKMARKS_BAR_HEIGHT : 0);
    const sidebarW = sidebarOpen ? SIDEBAR_WIDTH : 0;
    tab.view.setBounds({
      x: 0,
      y: chromeH,
      width: bounds.width - sidebarW,
      height: bounds.height - chromeH,
    });
  }
}
