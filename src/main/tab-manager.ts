import { BrowserWindow, BrowserView } from 'electron';
import { Blocker } from './blocker';
import { SecurityAnalyzer } from './security-analyzer';
import { SecurityHistoryManager } from './security-history';
import { addHistoryItem } from './ipc-handlers';

interface Tab {
  id: number;
  view: BrowserView;
  title: string;
  url: string;
  isLoading: boolean;
  blockedCount: number;
}

const CHROME_HEIGHT = 82; // Tab bar + address bar height
type ViewBounds = { x: number; y: number; width: number; height: number };

export class TabManager {
  private tabs: Map<number, Tab> = new Map();
  private activeTabId: number = 0;
  private nextId: number = 1;
  private window: BrowserWindow;
  private homeUrl: string;
  private blocker: Blocker;
  private security: SecurityAnalyzer;
  private securityHistory: SecurityHistoryManager;
  private defaultZoomFactor: number;
  private boundsResolver?: () => ViewBounds;
  private lastContentTabId: number | null = null;

  constructor(
    window: BrowserWindow,
    homeUrl: string,
    blocker: Blocker,
    security: SecurityAnalyzer,
    securityHistory: SecurityHistoryManager,
    defaultZoomPercent: number = 100
  ) {
    this.window = window;
    this.homeUrl = homeUrl;
    this.blocker = blocker;
    this.security = security;
    this.securityHistory = securityHistory;
    this.defaultZoomFactor = Math.max(0.3, Math.min(3, defaultZoomPercent / 100));
  }

  private isContentUrl(url: string): boolean {
    return /^https?:\/\//i.test(url);
  }

  private updateContentContext(tab: Tab): void {
    if (this.isContentUrl(tab.url)) {
      this.lastContentTabId = tab.id;
    }
  }

  createTab(url?: string): number {
    const id = this.nextId++;
    const targetUrl = url || this.homeUrl;

    const view = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false,
      },
    });

    view.webContents.setZoomFactor(this.defaultZoomFactor);

    const tab: Tab = {
      id,
      view,
      title: 'New Tab',
      url: targetUrl,
      isLoading: true,
      blockedCount: 0,
    };

    this.tabs.set(id, tab);
    this.updateContentContext(tab);

    // Setup view event listeners
    view.webContents.on('did-start-loading', () => {
      tab.isLoading = true;
      this.notifyTabUpdate(tab);
    });

    view.webContents.on('did-stop-loading', () => {
      tab.isLoading = false;
      this.notifyTabUpdate(tab);
    });

    view.webContents.on('page-title-updated', (_e, title) => {
      tab.title = title;
      this.notifyTabUpdate(tab);
    });

    view.webContents.on('did-navigate', (_e, url) => {
      tab.url = url;
      tab.blockedCount = 0;
      this.blocker.clearForWebContents(view.webContents.id);
      this.updateContentContext(tab);
      this.notifyUrlChange(tab);
      addHistoryItem(tab.title, url);
      // Analyze security for new page
      this.security.analyze(view.webContents, url).then(info => {
        this.window.webContents.send('security-update', info);
        this.securityHistory.recordSnapshot({
          tabId: tab.id,
          title: tab.title,
          url,
          domain: info.domain,
          privacyScore: info.privacyScore,
          isSecure: info.isSecure,
          cookieCount: info.cookieCount,
          trackerCount: info.trackerCount,
          thirdPartyCount: info.thirdPartyDomains.length,
          blockedDomains: info.trackerDomains,
        });
      });
    });

    view.webContents.on('did-navigate-in-page', (_e, url) => {
      tab.url = url;
      this.updateContentContext(tab);
      this.notifyUrlChange(tab);
    });

    // Track blocked requests for this tab
    this.blocker.onBlocked(view.webContents.id, (detail) => {
      tab.blockedCount++;
      this.securityHistory.recordBlockedRequest(tab.id, detail);
      this.window.webContents.send('blocked-count-update', {
        tabId: id,
        count: tab.blockedCount,
        detail,
      });
    });

    // Open links in new tab instead of new window
    view.webContents.setWindowOpenHandler(({ url }) => {
      this.createTab(url);
      return { action: 'deny' };
    });

    // Load the URL
    view.webContents.loadURL(targetUrl);

    // Switch to this tab
    this.switchTab(id);

    // Notify renderer about new tab
    this.window.webContents.send('tab-created', {
      id,
      title: tab.title,
      url: tab.url,
    });

    return id;
  }

  switchTab(id: number): void {
    const tab = this.tabs.get(id);
    if (!tab) return;

    // Remove current BrowserView
    const currentViews = this.window.getBrowserViews();
    for (const v of currentViews) {
      this.window.removeBrowserView(v);
    }

    // Add new view
    this.window.addBrowserView(tab.view);
    this.activeTabId = id;
    this.updateContentContext(tab);

    // Resize to fit
    this.resizeActiveTab();

    // Notify renderer
    this.window.webContents.send('tab-activated', id);
    this.notifyUrlChange(tab);
  }

  closeTab(id: number): void {
    const tab = this.tabs.get(id);
    if (!tab) return;

    // Destroy the view
    this.blocker.removeWebContents(tab.view.webContents.id);
    tab.view.webContents.close();
    this.tabs.delete(id);
    if (this.lastContentTabId === id) {
      const replacement = Array.from(this.tabs.values()).reverse().find(candidate => this.isContentUrl(candidate.url));
      this.lastContentTabId = replacement?.id ?? null;
    }

    // If we closed the active tab, switch to another
    if (id === this.activeTabId) {
      const remaining = Array.from(this.tabs.keys());
      if (remaining.length > 0) {
        this.switchTab(remaining[remaining.length - 1]);
      } else {
        // No tabs left, create a new one
        this.createTab();
      }
    }

    this.window.webContents.send('tab-closed', id);
  }

  navigateTo(url: string): void {
    const tab = this.tabs.get(this.activeTabId);
    if (!tab) return;

    // If not a URL, search with Search Angel
    if (!url.includes('://') && !url.includes('.')) {
      url = `${this.homeUrl}/search?q=${encodeURIComponent(url)}&mode=standard`;
    } else if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    tab.url = url;
    tab.blockedCount = 0;
    this.blocker.clearForWebContents(tab.view.webContents.id);
    this.updateContentContext(tab);
    tab.view.webContents.loadURL(url);
  }

  goBack(): void {
    const tab = this.tabs.get(this.activeTabId);
    if (tab?.view.webContents.canGoBack()) {
      tab.view.webContents.goBack();
    }
  }

  goForward(): void {
    const tab = this.tabs.get(this.activeTabId);
    if (tab?.view.webContents.canGoForward()) {
      tab.view.webContents.goForward();
    }
  }

  reload(): void {
    const tab = this.tabs.get(this.activeTabId);
    tab?.view.webContents.reload();
  }

  goHome(): void {
    this.navigateTo(this.homeUrl);
  }

  resizeActiveTab(): void {
    const tab = this.tabs.get(this.activeTabId);
    if (!tab) return;
    const fallbackBounds = this.window.getBounds();
    const nextBounds = this.boundsResolver
      ? this.boundsResolver()
      : {
          x: 0,
          y: CHROME_HEIGHT,
          width: fallbackBounds.width,
          height: fallbackBounds.height - CHROME_HEIGHT,
        };
    tab.view.setBounds(nextBounds);
  }

  getActiveTab(): Tab | undefined {
    return this.tabs.get(this.activeTabId);
  }

  getTab(id: number): Tab | undefined {
    return this.tabs.get(id);
  }

  getPreferredContentTab(): Tab | undefined {
    const activeTab = this.getActiveTab();
    if (activeTab && this.isContentUrl(activeTab.url)) {
      return activeTab;
    }
    if (this.lastContentTabId != null) {
      return this.tabs.get(this.lastContentTabId);
    }
    return Array.from(this.tabs.values()).reverse().find(tab => this.isContentUrl(tab.url));
  }

  setViewBoundsResolver(resolver: () => ViewBounds): void {
    this.boundsResolver = resolver;
    this.resizeActiveTab();
  }

  getAllTabs(): Array<{ id: number; title: string; url: string; isActive: boolean }> {
    return Array.from(this.tabs.values()).map(t => ({
      id: t.id,
      title: t.title,
      url: t.url,
      isActive: t.id === this.activeTabId,
    }));
  }

  private notifyTabUpdate(tab: Tab): void {
    this.window.webContents.send('tab-updated', {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      isLoading: tab.isLoading,
    });
  }

  private notifyUrlChange(tab: Tab): void {
    this.window.webContents.send('url-changed', {
      tabId: tab.id,
      url: tab.url,
      canGoBack: tab.view.webContents.canGoBack(),
      canGoForward: tab.view.webContents.canGoForward(),
    });
  }
}
