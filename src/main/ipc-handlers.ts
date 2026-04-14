import { ipcMain, BrowserWindow, shell, app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'url';
import { TabManager } from './tab-manager';
import { Blocker } from './blocker';
import { SecurityAnalyzer } from './security-analyzer';
import { TorManager } from './tor-manager';
import { BookmarkManager } from './bookmark-manager';
import { DownloadManager } from './download-manager';
import { SettingsManager } from './settings-manager';
import { SecurityHistoryManager } from './security-history';

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
const SIDEBAR_WIDTH = 340;
const BOOKMARKS_BAR_HEIGHT = 28;

export function setupIpcHandlers(
  window: BrowserWindow,
  tabManager: TabManager,
  blocker: Blocker,
  security: SecurityAnalyzer,
  torManager: TorManager,
  bookmarks: BookmarkManager,
  downloads: DownloadManager,
  settings: SettingsManager,
  securityHistory: SecurityHistoryManager
): void {
  const dns = require('dns').promises;

  function getTargetTab(requestedTabId?: number) {
    if (typeof requestedTabId === 'number' && Number.isInteger(requestedTabId)) {
      const requestedTab = tabManager.getTab(requestedTabId);
      if (requestedTab && /^https?:\/\//i.test(requestedTab.url)) {
        return requestedTab;
      }
      return tabManager.getPreferredContentTab() || requestedTab;
    }
    return tabManager.getPreferredContentTab() || tabManager.getActiveTab();
  }

  function sanitizeDomain(input?: string): string | null {
    if (!input) return null;
    const normalized = input.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(normalized)) return null;
    const blockedNames = ['localhost', 'internal', 'local', 'corp', 'intranet'];
    if (blockedNames.some(name => normalized.includes(name))) return null;
    return normalized;
  }

  async function resolveAddresses(domain?: string): Promise<string[]> {
    const normalized = sanitizeDomain(domain);
    if (!normalized) return [];
    try {
      return (await dns.resolve4(normalized)).slice(0, 3);
    } catch {
      return [];
    }
  }

  async function buildTrackerIntel(requestedTabId?: number) {
    const tab = getTargetTab(requestedTabId);
    if (!tab) return null;

    const securityInfo = await security.analyze(tab.view.webContents, tab.url);
    const requests = blocker.getBlockedDetails(tab.view.webContents.id);
    const domainMap = new Map<string, {
      domain: string;
      blockedCount: number;
      resourceTypes: string[];
      lastSeen: number;
      sampleUrl: string;
      matched: string[];
    }>();

    for (const request of requests) {
      const existing = domainMap.get(request.domain);
      if (existing) {
        existing.blockedCount += 1;
        existing.lastSeen = Math.max(existing.lastSeen, request.timestamp);
        if (!existing.resourceTypes.includes(request.resourceType)) {
          existing.resourceTypes.push(request.resourceType);
        }
        if (!existing.matched.includes(request.matched)) {
          existing.matched.push(request.matched);
        }
      } else {
        domainMap.set(request.domain, {
          domain: request.domain,
          blockedCount: 1,
          resourceTypes: [request.resourceType],
          lastSeen: request.timestamp,
          sampleUrl: request.url,
          matched: [request.matched],
        });
      }
    }

    const domains = Array.from(domainMap.values()).sort((a, b) => b.blockedCount - a.blockedCount);

    return {
      tabId: tab.id,
      title: tab.title,
      url: tab.url,
      sourceDomain: securityInfo.domain,
      isSecure: securityInfo.isSecure,
      protocol: securityInfo.protocol,
      privacyScore: securityInfo.privacyScore,
      cookieCount: securityInfo.cookieCount,
      trackerCount: securityInfo.trackerCount,
      thirdPartyDomains: securityInfo.thirdPartyDomains,
      pageBlocked: requests.length,
      totalBlocked: blocker.blockedTotal,
      domains,
      requests,
    };
  }

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
  const ALLOWED_PAGES = new Set(['downloads', 'bookmarks', 'settings', 'history', 'internet-map', 'security-overview']);
  ipcMain.on('open-page', (_e, page: string, context?: { sourceTabId?: number; focus?: string; view?: string }) => {
    if (!ALLOWED_PAGES.has(page)) {
      console.warn(`[SECURITY] Blocked open-page for unauthorized page: ${page}`);
      return;
    }
    const pagePath = path.join(__dirname, '..', '..', 'src', 'renderer', `${page}.html`);
    const pageUrl = pathToFileURL(pagePath);

    if (page === 'internet-map') {
      const sourceTabId = typeof context?.sourceTabId === 'number' && Number.isInteger(context.sourceTabId)
        ? context.sourceTabId
        : tabManager.getPreferredContentTab()?.id;
      if (typeof sourceTabId === 'number') {
        pageUrl.searchParams.set('sourceTabId', String(sourceTabId));
      }
      if (typeof context?.view === 'string' && /^[a-z-]{1,24}$/i.test(context.view)) {
        pageUrl.searchParams.set('view', context.view);
      }
      if (typeof context?.focus === 'string' && context.focus.length <= 120) {
        pageUrl.searchParams.set('focus', context.focus);
      }
    }

    tabManager.createTab(pageUrl.toString());
  });

  // ── Blocker ───────────────────────────────────────────────
  ipcMain.handle('toggle-blocker', () => {
    const enabled = blocker.toggle();
    settings.set('blockTrackers', enabled);
    window.webContents.send('settings-changed', settings.getAll());
    return enabled;
  });
  ipcMain.handle('get-blocker-stats', () => ({
    enabled: blocker.enabled,
    totalBlocked: blocker.blockedTotal,
  }));
  ipcMain.handle('get-tracker-intel', async (_e, requestedTabId?: number) => {
    return buildTrackerIntel(requestedTabId);
  });
  ipcMain.handle('get-network-map-data', async (_e, requestedTabId?: number, lookupDomain?: string) => {
    const intel = await buildTrackerIntel(requestedTabId);
    const sourceDomain = sanitizeDomain(lookupDomain) || intel?.sourceDomain || '';
    const sourceAddresses = await resolveAddresses(sourceDomain);
    const topDomains = intel?.domains.slice(0, 6) || [];
    const trackers = await Promise.all(
      topDomains.map(async tracker => ({
        ...tracker,
        addresses: await resolveAddresses(tracker.domain),
      }))
    );

    return {
      generatedAt: Date.now(),
      routeMode: torManager.enabled ? 'tor' : 'direct',
      sourceTabId: intel?.tabId ?? null,
      sourceUrl: intel?.url ?? '',
      sourceDomain,
      sourceAddresses,
      privacyScore: intel?.privacyScore ?? 100,
      cookieCount: intel?.cookieCount ?? 0,
      pageBlocked: intel?.pageBlocked ?? 0,
      totalBlocked: intel?.totalBlocked ?? blocker.blockedTotal,
      trackerCount: intel?.trackerCount ?? 0,
      thirdPartyDomains: intel?.thirdPartyDomains ?? [],
      trackers,
      dnsResolvers: ['1.1.1.1', '8.8.8.8'],
    };
  });
  ipcMain.handle('get-security-overview', () => securityHistory.getOverview());
  ipcMain.handle('clear-security-overview', () => {
    securityHistory.clear();
    return true;
  });

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
    if (key === 'blockTrackers') {
      blocker.setEnabled(Boolean(value));
    }
    if (key === 'defaultZoom') {
      const activeTab = tabManager.getActiveTab();
      if (activeTab) {
        const zoomFactor = Math.max(0.3, Math.min(3, (Number(value) || 100) / 100));
        activeTab.view.webContents.setZoomFactor(zoomFactor);
      }
    }
    if (key === 'showBookmarksBar') {
      resizeBrowserView();
    }
    window.webContents.send('settings-changed', settings.getAll());
    return settings.getAll();
  });
  ipcMain.handle('reset-settings', () => {
    settings.reset();
    blocker.setEnabled(settings.get('blockTrackers'));
    resizeBrowserView();
    window.webContents.send('settings-changed', settings.getAll());
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
    if (!sanitizeDomain(domain)) {
      return { domain, addresses: [], error: 'Invalid domain format' };
    }
    try {
      const addresses = await dns.resolve4(domain);
      return { domain, addresses, error: null };
    } catch (err: any) {
      return { domain, addresses: [], error: err.message };
    }
  });

  // ── Window resize ─────────────────────────────────────────
  window.on('resize', () => resizeBrowserView());
  tabManager.setViewBoundsResolver(() => getViewBounds());

  function getViewBounds() {
    const bounds = window.getBounds();
    const showBar = settings.get('showBookmarksBar');
    const chromeH = 82 + (showBar ? BOOKMARKS_BAR_HEIGHT : 0);
    const sidebarW = sidebarOpen ? SIDEBAR_WIDTH : 0;
    return {
      x: 0,
      y: chromeH,
      width: bounds.width - sidebarW,
      height: bounds.height - chromeH,
    };
  }

  function resizeBrowserView() {
    tabManager.resizeActiveTab();
  }
}
