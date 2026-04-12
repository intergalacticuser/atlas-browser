// Atlasiant Browser - Browser Chrome UI
const api = window.browserAPI;

// ── State ──────────────────────────────────────────────────
let tabs = [];
let activeTabId = null;
let blockedCounts = {};
let torEnabled = false;
let currentZoom = 100;
let phantomSession = null;
let phantomTimer = null;

// ── DOM Elements ───────────────────────────────────────────
const tabsContainer = document.getElementById('tabs-container');
const newTabBtn = document.getElementById('new-tab-btn');
const addressBar = document.getElementById('address-bar');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const reloadBtn = document.getElementById('reload-btn');
const homeBtn = document.getElementById('home-btn');
const bookmarkStar = document.getElementById('bookmark-star');
const shieldBtn = document.getElementById('shield-btn');
const torBtn = document.getElementById('tor-btn');
const securityBtn = document.getElementById('security-btn');
const downloadsBtn = document.getElementById('downloads-btn');
const mapBtn = document.getElementById('map-btn');
const settingsBtn = document.getElementById('settings-btn');
const blockedCount = document.getElementById('blocked-count');
const sslIndicator = document.getElementById('ssl-indicator');
const sidebar = document.getElementById('security-sidebar');
const closeSidebar = document.getElementById('close-sidebar');
const zoomIn = document.getElementById('zoom-in');
const zoomOut = document.getElementById('zoom-out');
const zoomLevel = document.getElementById('zoom-level');
const bookmarksContainer = document.getElementById('bookmarks-container');
const allBookmarksBtn = document.getElementById('all-bookmarks-btn');
const progressBar = document.getElementById('progress-bar');
const progressFill = document.getElementById('progress-fill');
const contextMenu = document.getElementById('context-menu');

// ── Tab Rendering ──────────────────────────────────────────
function renderTabs() {
  tabsContainer.innerHTML = '';
  tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;
    el.innerHTML = `
      ${tab.isLoading ? '<div class="tab-loading"></div>' : ''}
      <span class="tab-title">${esc(tab.title || 'New Tab')}</span>
      <span class="tab-close" data-id="${tab.id}">&times;</span>
    `;
    el.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('.tab-close');
      if (closeBtn) {
        api?.closeTab(parseInt(closeBtn.dataset.id));
      } else {
        api?.switchTab(tab.id);
      }
    });
    tabsContainer.appendChild(el);
  });
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ── Navigation ─────────────────────────────────────────────
addressBar.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const v = addressBar.value.trim();
    if (v) api?.navigate(v);
    addressBar.blur();
  }
  if (e.key === 'Escape') {
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab) addressBar.value = tab.url || '';
    addressBar.blur();
  }
});

newTabBtn.addEventListener('click', () => api?.newTab());
backBtn.addEventListener('click', () => api?.goBack());
forwardBtn.addEventListener('click', () => api?.goForward());
reloadBtn.addEventListener('click', () => api?.reload());
homeBtn.addEventListener('click', () => api?.goHome());

// ── Bookmark Star ──────────────────────────────────────────
bookmarkStar.addEventListener('click', async () => {
  if (!api) return;
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab) return;
  const isNow = await api.toggleBookmark(tab.title || 'Bookmark', tab.url || '');
  bookmarkStar.innerHTML = isNow ? '&#9733;' : '&#9734;';
  bookmarkStar.classList.toggle('active', isNow);
  loadBookmarksBar();
});

async function checkBookmark(url) {
  if (!api || !url) return;
  const is = await api.isBookmarked(url);
  bookmarkStar.innerHTML = is ? '&#9733;' : '&#9734;';
  bookmarkStar.classList.toggle('active', is);
}

// ── Bookmarks Bar ──────────────────────────────────────────
async function loadBookmarksBar() {
  if (!api) return;
  const bms = await api.getBarBookmarks();
  if (!bms || bms.length === 0) {
    bookmarksContainer.innerHTML = '<span class="bookmarks-empty">Bookmark pages with &#9734; to see them here</span>';
    return;
  }
  bookmarksContainer.innerHTML = '';
  bms.forEach(bm => {
    const el = document.createElement('div');
    el.className = 'bm-item';
    el.innerHTML = `<span>${esc(bm.title.slice(0, 20))}</span>`;
    el.title = bm.url;
    el.addEventListener('click', () => api.navigate(bm.url));
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      api.removeBookmark(bm.id).then(() => {
        loadBookmarksBar();
        showToast('Bookmark removed', 'var(--muted)');
      });
    });
    bookmarksContainer.appendChild(el);
  });
}

allBookmarksBtn.addEventListener('click', () => api?.openPage('bookmarks'));

// ── Shield (blocker) ───────────────────────────────────────
shieldBtn.addEventListener('click', async () => {
  if (!api) return;
  const enabled = await api.toggleBlocker();
  shieldBtn.classList.toggle('shield-active', enabled);
});

// ── Tor Toggle ─────────────────────────────────────────────
torBtn.addEventListener('click', async () => {
  if (!api) return;
  torEnabled = await api.toggleTor();
  torBtn.classList.toggle('tor-active', torEnabled);
  updateTorCircuit();
});

async function updateTorCircuit() {
  if (!api) return;
  const circuit = await api.getTorCircuit();
  const el = document.getElementById('tor-circuit');
  if (!circuit || !circuit.isActive) {
    el.innerHTML = '<span class="tor-disabled">Tor is disabled</span>';
  } else {
    el.innerHTML = circuit.nodes.map(n => `<div class="tor-node">${esc(n)}</div>`).join('');
  }
}

// ── Zoom ───────────────────────────────────────────────────
zoomIn.addEventListener('click', async () => {
  if (!api) return;
  currentZoom = await api.zoomIn();
  zoomLevel.textContent = currentZoom + '%';
});
zoomOut.addEventListener('click', async () => {
  if (!api) return;
  currentZoom = await api.zoomOut();
  zoomLevel.textContent = currentZoom + '%';
});
zoomLevel.addEventListener('click', async () => {
  if (!api) return;
  currentZoom = await api.zoomReset();
  zoomLevel.textContent = currentZoom + '%';
});

// ── Toolbar buttons ────────────────────────────────────────
downloadsBtn.addEventListener('click', () => api?.openPage('downloads'));
mapBtn.addEventListener('click', () => api?.openPage('internet-map'));
settingsBtn.addEventListener('click', () => api?.openPage('settings'));

// ── Security Sidebar ───────────────────────────────────────
securityBtn.addEventListener('click', () => api?.toggleSidebar());
closeSidebar.addEventListener('click', () => api?.toggleSidebar());

async function updateSecurityInfo() {
  if (!api) return;
  const info = await api.getSecurityInfo();
  if (!info) return;

  const scoreEl = document.getElementById('privacy-score');
  scoreEl.textContent = info.privacyScore;
  scoreEl.style.color = info.privacyScore >= 80 ? 'var(--green)' :
                         info.privacyScore >= 50 ? 'var(--amber)' : 'var(--red)';

  document.getElementById('proto-val').textContent = info.isSecure ? 'HTTPS (Secure)' : 'HTTP (Insecure)';
  document.getElementById('proto-val').className = `value ${info.isSecure ? 'badge-green' : 'badge-red'}`;
  document.getElementById('cert-val').textContent = info.certificate ? info.certificate.issuer : 'None';
  document.getElementById('cookies-count').textContent = info.cookieCount;

  const stats = await api.getBlockerStats();
  document.getElementById('trackers-total').textContent = stats.totalBlocked;
}

// ── SSL Indicator ──────────────────────────────────────────
function updateSslIndicator(url) {
  try {
    const isSecure = url.startsWith('https://');
    sslIndicator.textContent = isSecure ? '\u{1f512}' : '\u{1f513}';
    sslIndicator.className = `ssl-indicator ${isSecure ? 'ssl-secure' : 'ssl-insecure'}`;
  } catch {}
}

// ── Notification Toast ─────────────────────────────────────
function showToast(msg, color = 'var(--accent)') {
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = `
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    background: rgba(0,0,0,0.8); border: 1px solid ${color};
    color: ${color}; padding: 8px 20px; border-radius: 10px;
    font-size: 12px; z-index: 9999; backdrop-filter: blur(8px);
  `;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── IPC Event Listeners ────────────────────────────────────
if (api) {
  api.onTabCreated((data) => {
    tabs.push({ ...data, isLoading: true });
    renderTabs();
  });

  api.onTabUpdated((data) => {
    const idx = tabs.findIndex(t => t.id === data.id);
    if (idx >= 0) { tabs[idx] = { ...tabs[idx], ...data }; renderTabs(); }
  });

  api.onTabActivated((tabId) => {
    activeTabId = tabId;
    renderTabs();
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      addressBar.value = tab.url || '';
      updateSslIndicator(tab.url || '');
      checkBookmark(tab.url);
    }
  });

  api.onTabClosed((tabId) => {
    tabs = tabs.filter(t => t.id !== tabId);
    delete blockedCounts[tabId];
    renderTabs();
  });

  api.onUrlChanged((data) => {
    const tab = tabs.find(t => t.id === data.tabId);
    if (tab) {
      tab.url = data.url;
      if (data.tabId === activeTabId) {
        addressBar.value = data.url;
        updateSslIndicator(data.url);
        backBtn.disabled = !data.canGoBack;
        forwardBtn.disabled = !data.canGoForward;
        checkBookmark(data.url);
      }
    }
  });

  api.onBlockedCountUpdate((data) => {
    blockedCounts[data.tabId] = data.count;
    if (data.tabId === activeTabId) {
      blockedCount.textContent = data.count;
      // Pop animation
      blockedCount.classList.remove('pop');
      void blockedCount.offsetWidth; // force reflow
      blockedCount.classList.add('pop');
    }
  });

  api.onFocusAddressBar(() => { addressBar.focus(); addressBar.select(); });

  api.onSidebarToggled((isOpen) => {
    if (isOpen) { sidebar.classList.remove('hidden'); updateSecurityInfo(); }
    else { sidebar.classList.add('hidden'); }
  });

  api.onTorStatusChanged((enabled) => {
    torEnabled = enabled;
    torBtn.classList.toggle('tor-active', enabled);
    updateTorCircuit();
    showToast(
      enabled ? 'Tor enabled - traffic routed through Tor network' : 'Tor disabled - direct connection',
      enabled ? 'var(--purple)' : 'var(--muted)'
    );
  });

  api.onDownloadStarted((d) => showToast(`Downloading: ${d.filename}`, 'var(--green)'));
  api.onDownloadDone((d) => showToast(
    d.state === 'completed' ? `Downloaded: ${d.filename}` : `Download failed: ${d.filename}`,
    d.state === 'completed' ? 'var(--green)' : 'var(--red)'
  ));

  // Load initial data
  loadBookmarksBar();
}

// ── Progress Bar (loading indicator) ───────────────────────
if (api) {
  api.onTabUpdated((data) => {
    if (data.id !== activeTabId) return;
    if (data.isLoading) {
      progressBar.classList.remove('hidden');
      progressFill.style.width = '15%';
      setTimeout(() => { progressFill.style.width = '45%'; }, 300);
      setTimeout(() => { progressFill.style.width = '75%'; }, 800);
    } else {
      progressFill.style.width = '100%';
      setTimeout(() => {
        progressBar.classList.add('hidden');
        progressFill.style.width = '0%';
      }, 300);
    }
  });
}

// ── Context Menu ───────────────────────────────────────────
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  contextMenu.classList.remove('hidden');
  contextMenu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
  contextMenu.style.top = Math.min(e.clientY, window.innerHeight - 200) + 'px';
});

document.addEventListener('click', () => {
  contextMenu.classList.add('hidden');
});

contextMenu.querySelectorAll('.ctx-item').forEach(item => {
  item.addEventListener('click', () => {
    const action = item.dataset.action;
    if (action === 'back') api?.goBack();
    if (action === 'forward') api?.goForward();
    if (action === 'reload') api?.reload();
    if (action === 'newtab') api?.newTab();
    if (action === 'copyurl') {
      const tab = tabs.find(t => t.id === activeTabId);
      if (tab) navigator.clipboard.writeText(tab.url);
    }
    if (action === 'devtools') {
      // DevTools handled by menu Cmd+Option+I
    }
    contextMenu.classList.add('hidden');
  });
});

// ── Phantom Mode ───────────────────────────────────────────
const phantomBtn = document.getElementById('phantom-btn');
const phantomBar = document.getElementById('phantom-bar');
const phantomInfo = document.getElementById('phantom-info');
const phantomTimerEl = document.getElementById('phantom-timer');
const phantomDestroyBtn = document.getElementById('phantom-destroy');

function formatPhantomTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function startPhantom() {
  if (!api || phantomSession) return;
  phantomBtn.classList.add('phantom-active');
  showToast('Creating phantom container...', 'var(--purple)');

  try {
    const result = await api.phantomStart();
    if (result && result.session_id) {
      phantomSession = result;
      phantomBar.classList.remove('hidden');
      phantomInfo.textContent = `Container phantom_${result.session_id.slice(0, 8)} | Port ${result.port}`;

      // Start countdown
      let remaining = 1800;
      phantomTimer = setInterval(() => {
        remaining--;
        phantomTimerEl.textContent = formatPhantomTime(remaining);
        // Warning colors as time runs out
        if (remaining <= 60) phantomTimerEl.style.color = 'var(--red)';
        else if (remaining <= 300) phantomTimerEl.style.color = 'var(--amber)';
        if (remaining <= 0) endPhantom();
      }, 1000);

      showToast('Phantom Mode active - all searches isolated in Docker container', 'var(--purple)');
    }
  } catch (err) {
    showToast('Failed to start phantom: ' + (err.message || err), 'var(--red)');
    phantomBtn.classList.remove('phantom-active');
  }
}

async function endPhantom() {
  if (!api || !phantomSession) return;

  try {
    await api.phantomEnd(phantomSession.session_id);
  } catch {}

  phantomSession = null;
  phantomBar.classList.add('hidden');
  phantomBtn.classList.remove('phantom-active');
  if (phantomTimer) { clearInterval(phantomTimer); phantomTimer = null; }
  showToast('Phantom container destroyed. Zero trace remains.', 'var(--green)');
}

if (phantomBtn) {
  phantomBtn.addEventListener('click', () => {
    if (phantomSession) {
      endPhantom();
    } else {
      startPhantom();
    }
  });
}

if (phantomDestroyBtn) {
  phantomDestroyBtn.addEventListener('click', endPhantom);
}

// ── Keyboard Shortcuts ─────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.metaKey && e.key === 'l') { e.preventDefault(); addressBar.focus(); addressBar.select(); }
  if (e.metaKey && e.key === 'd') { e.preventDefault(); bookmarkStar.click(); }
  if (e.metaKey && e.key === 'j') { e.preventDefault(); api?.openPage('downloads'); }
  if (e.metaKey && e.key === 'y') { e.preventDefault(); api?.openPage('history'); }
});
