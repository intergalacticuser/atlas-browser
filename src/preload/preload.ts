import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('browserAPI', {
  // ── Tab management ────────────────────────────────────────
  newTab: (url?: string) => ipcRenderer.send('new-tab', url),
  closeTab: (tabId: number) => ipcRenderer.send('close-tab', tabId),
  switchTab: (tabId: number) => ipcRenderer.send('switch-tab', tabId),
  getTabs: () => ipcRenderer.invoke('get-tabs'),

  // ── Navigation ────────────────────────────────────────────
  navigate: (url: string) => ipcRenderer.send('navigate', url),
  goBack: () => ipcRenderer.send('go-back'),
  goForward: () => ipcRenderer.send('go-forward'),
  reload: () => ipcRenderer.send('reload'),
  goHome: () => ipcRenderer.send('go-home'),
  openPage: (page: string) => ipcRenderer.send('open-page', page),

  // ── Blocker ───────────────────────────────────────────────
  toggleBlocker: () => ipcRenderer.invoke('toggle-blocker'),
  getBlockerStats: () => ipcRenderer.invoke('get-blocker-stats'),

  // ── Tor ───────────────────────────────────────────────────
  toggleTor: () => ipcRenderer.invoke('toggle-tor'),
  getTorStatus: () => ipcRenderer.invoke('get-tor-status'),
  getTorCircuit: () => ipcRenderer.invoke('get-tor-circuit'),

  // ── Sidebar ───────────────────────────────────────────────
  toggleSidebar: () => ipcRenderer.send('toggle-sidebar'),
  getSecurityInfo: () => ipcRenderer.invoke('get-security-info'),

  // ── Bookmarks ─────────────────────────────────────────────
  getBookmarks: () => ipcRenderer.invoke('get-bookmarks'),
  getBarBookmarks: () => ipcRenderer.invoke('get-bar-bookmarks'),
  addBookmark: (title: string, url: string, favicon: string) =>
    ipcRenderer.invoke('add-bookmark', title, url, favicon),
  removeBookmark: (id: string) => ipcRenderer.invoke('remove-bookmark', id),
  isBookmarked: (url: string) => ipcRenderer.invoke('is-bookmarked', url),
  toggleBookmark: (title: string, url: string) =>
    ipcRenderer.invoke('toggle-bookmark', title, url),

  // ── Downloads ─────────────────────────────────────────────
  getDownloads: () => ipcRenderer.invoke('get-downloads'),
  clearDownloads: () => ipcRenderer.invoke('clear-downloads'),
  openDownload: (path: string) => ipcRenderer.send('open-download', path),
  showDownload: (path: string) => ipcRenderer.send('show-download', path),

  // ── Settings ──────────────────────────────────────────────
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key: string, value: any) => ipcRenderer.invoke('set-setting', key, value),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),

  // ── Zoom ──────────────────────────────────────────────────
  zoomIn: () => ipcRenderer.invoke('zoom-in'),
  zoomOut: () => ipcRenderer.invoke('zoom-out'),
  zoomReset: () => ipcRenderer.invoke('zoom-reset'),
  getZoom: () => ipcRenderer.invoke('get-zoom'),

  // ── History ────────────────────────────────────────────────
  getHistory: () => ipcRenderer.invoke('get-history'),
  clearHistory: () => ipcRenderer.invoke('clear-history'),
  deleteHistoryItem: (id: string) => ipcRenderer.invoke('delete-history-item', id),

  // ── Phantom Mode ──────────────────────────────────────────
  phantomStart: () => ipcRenderer.invoke('phantom-start'),
  phantomEnd: (sessionId: string) => ipcRenderer.invoke('phantom-end', sessionId),
  phantomStatus: (sessionId: string) => ipcRenderer.invoke('phantom-status', sessionId),

  // ── DNS / Internet Map ────────────────────────────────────
  dnsLookup: (domain: string) => ipcRenderer.invoke('dns-lookup', domain),

  // ── Events ────────────────────────────────────────────────
  onTabCreated: (cb: Function) => ipcRenderer.on('tab-created', (_e, d) => cb(d)),
  onTabUpdated: (cb: Function) => ipcRenderer.on('tab-updated', (_e, d) => cb(d)),
  onTabActivated: (cb: Function) => ipcRenderer.on('tab-activated', (_e, id) => cb(id)),
  onTabClosed: (cb: Function) => ipcRenderer.on('tab-closed', (_e, id) => cb(id)),
  onUrlChanged: (cb: Function) => ipcRenderer.on('url-changed', (_e, d) => cb(d)),
  onBlockedCountUpdate: (cb: Function) => ipcRenderer.on('blocked-count-update', (_e, d) => cb(d)),
  onSecurityUpdate: (cb: Function) => ipcRenderer.on('security-update', (_e, d) => cb(d)),
  onFocusAddressBar: (cb: Function) => ipcRenderer.on('focus-address-bar', () => cb()),
  onSidebarToggled: (cb: Function) => ipcRenderer.on('sidebar-toggled', (_e, v) => cb(v)),
  onTorStatusChanged: (cb: Function) => ipcRenderer.on('tor-status-changed', (_e, v) => cb(v)),
  onDownloadStarted: (cb: Function) => ipcRenderer.on('download-started', (_e, d) => cb(d)),
  onDownloadProgress: (cb: Function) => ipcRenderer.on('download-progress', (_e, d) => cb(d)),
  onDownloadDone: (cb: Function) => ipcRenderer.on('download-done', (_e, d) => cb(d)),
});
