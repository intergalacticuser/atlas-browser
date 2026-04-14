const api = window.browserAPI;

const STAR_OUTLINE = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 3.8l2.6 5.2 5.7.8-4.1 4 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.1-4 5.7-.8L12 3.8z"></path>
  </svg>
`;

const STAR_FILLED = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" stroke="none" d="M12 3.8l2.6 5.2 5.7.8-4.1 4 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.1-4 5.7-.8L12 3.8z"></path>
  </svg>
`;

const LOCK_SECURE = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
    <rect x="6" y="10" width="12" height="10" rx="2"></rect>
  </svg>
`;

const LOCK_INSECURE = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M8 10V7a4 4 0 0 1 7 2.6"></path>
    <rect x="6" y="10" width="12" height="10" rx="2"></rect>
    <path d="M14.8 7.2l5 5"></path>
  </svg>
`;

let tabs = [];
let activeTabId = null;
let blockedCounts = {};
let torEnabled = false;
let currentZoom = 100;
let phantomSession = null;
let phantomTimer = null;
let activeTrackerIntel = null;
let currentSettings = { showBookmarksBar: true };
let blockerEnabled = true;

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
const historyBtn = document.getElementById('history-btn');
const mapBtn = document.getElementById('map-btn');
const overviewBtn = document.getElementById('overview-btn');
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
const phantomBtn = document.getElementById('phantom-btn');
const phantomBar = document.getElementById('phantom-bar');
const phantomInfo = document.getElementById('phantom-info');
const phantomTimerEl = document.getElementById('phantom-timer');
const phantomDestroyBtn = document.getElementById('phantom-destroy');
const shieldPopover = document.getElementById('shield-popover');
const shieldToggleBtn = document.getElementById('shield-toggle-btn');
const shieldPageCount = document.getElementById('shield-page-count');
const shieldSessionCount = document.getElementById('shield-session-count');
const shieldStatusCopy = document.getElementById('shield-status-copy');
const shieldDomainList = document.getElementById('shield-domain-list');
const shieldOpenMap = document.getElementById('shield-open-map');
const shieldOpenOverview = document.getElementById('shield-open-overview');
const trackersPageBtn = document.getElementById('trackers-page-btn');
const trackersTotalBtn = document.getElementById('trackers-total-btn');
const trackersPage = document.getElementById('trackers-page');
const trackersTotal = document.getElementById('trackers-total');
const trackerSummary = document.getElementById('tracker-summary');
const trackerDomainList = document.getElementById('tracker-domain-list');
const trackerEmpty = document.getElementById('tracker-empty');
const trackerSection = document.getElementById('tracker-section');
const openMapInsight = document.getElementById('open-map-insight');
const openSessionOverview = document.getElementById('open-session-overview');
const domainVal = document.getElementById('domain-val');
const thirdPartyCount = document.getElementById('third-party-count');

function esc(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function activeTab() {
  return tabs.find(tab => tab.id === activeTabId);
}

function hasSidebarOpen() {
  return !sidebar.classList.contains('hidden');
}

function setBookmarkState(isActive) {
  bookmarkStar.innerHTML = isActive ? STAR_FILLED : STAR_OUTLINE;
  bookmarkStar.classList.toggle('active', isActive);
}

function updateSslIndicator(url) {
  let isSecure = false;

  try {
    isSecure = new URL(url).protocol === 'https:';
  } catch {
    isSecure = typeof url === 'string' && url.startsWith('https://');
  }

  sslIndicator.innerHTML = isSecure ? LOCK_SECURE : LOCK_INSECURE;
  sslIndicator.classList.toggle('ssl-secure', isSecure);
  sslIndicator.classList.toggle('ssl-insecure', !isSecure);
  sslIndicator.title = isSecure ? 'Secure HTTPS connection' : 'Insecure or local connection';
}

function applySettings(settings) {
  currentSettings = settings || currentSettings;
  document.body.classList.toggle('bookmarks-hidden', !currentSettings.showBookmarksBar);
  blockerEnabled = currentSettings.blockTrackers ?? blockerEnabled;
}

function renderTabs() {
  tabsContainer.innerHTML = '';

  tabs.forEach(tab => {
    const element = document.createElement('div');
    element.className = `tab ${tab.id === activeTabId ? 'active' : ''}`;
    element.innerHTML = `
      ${tab.isLoading ? '<div class="tab-loading"></div>' : ''}
      <span class="tab-title">${esc(tab.title || 'New Tab')}</span>
      <span class="tab-close" data-id="${tab.id}">&times;</span>
    `;

    element.addEventListener('click', (event) => {
      const closeButton = event.target.closest('.tab-close');
      if (closeButton) {
        api?.closeTab(Number(closeButton.dataset.id));
        return;
      }

      api?.switchTab(tab.id);
    });

    tabsContainer.appendChild(element);
  });
}

function showToast(message, color = 'var(--accent)') {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    left: 50%;
    bottom: 22px;
    transform: translateX(-50%);
    padding: 10px 16px;
    border-radius: 14px;
    border: 1px solid ${color};
    background: rgba(7, 10, 16, 0.9);
    color: ${color};
    font-size: 12px;
    z-index: 9999;
    backdrop-filter: blur(16px);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.36);
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2800);
}

function openSecurityOverview() {
  api?.openPage('security-overview');
}

async function checkBookmark(url) {
  if (!api || !url) return;
  setBookmarkState(await api.isBookmarked(url));
}

async function loadBookmarksBar() {
  if (!api) return;

  const bookmarks = await api.getBarBookmarks();
  if (!bookmarks || bookmarks.length === 0) {
    bookmarksContainer.innerHTML = '<span class="bookmarks-empty">Bookmark pages to pin your high-signal workflow here.</span>';
    return;
  }

  bookmarksContainer.innerHTML = '';
  bookmarks.forEach((bookmark) => {
    const element = document.createElement('button');
    element.className = 'bm-item';
    element.title = bookmark.url;
    element.innerHTML = `<span>${esc((bookmark.title || bookmark.url).slice(0, 28))}</span>`;
    element.addEventListener('click', () => api.navigate(bookmark.url));
    element.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      api.removeBookmark(bookmark.id).then(() => {
        loadBookmarksBar();
        showToast('Bookmark removed', 'var(--muted)');
      });
    });
    bookmarksContainer.appendChild(element);
  });
}

function renderTrackerIntel(intel) {
  activeTrackerIntel = intel;

  const pageBlocked = intel?.pageBlocked ?? blockedCounts[activeTabId] ?? 0;
  const totalBlocked = intel?.totalBlocked ?? 0;
  const domains = intel?.domains || [];
  const trackerDomainCount = domains.length;
  const sourceDomain = intel?.sourceDomain || '-';
  const thirdParty = intel?.thirdPartyDomains?.length || 0;

  blockedCount.textContent = String(pageBlocked);
  trackersPage.textContent = String(pageBlocked);
  trackersTotal.textContent = String(totalBlocked);
  domainVal.textContent = sourceDomain;
  thirdPartyCount.textContent = String(thirdParty);

  if (!intel) {
    trackerSummary.textContent = 'Open a page to see live privacy telemetry and blocked tracker detail.';
    trackerDomainList.innerHTML = '';
    trackerEmpty.classList.remove('hidden');
    return;
  }

  if (pageBlocked === 0) {
    trackerSummary.textContent = `No blocked trackers detected on ${sourceDomain} yet. The shield is standing by.`;
    trackerDomainList.innerHTML = '';
    trackerEmpty.classList.remove('hidden');
    return;
  }

  const headline = `${pageBlocked} blocked requests across ${trackerDomainCount} tracker domain${trackerDomainCount === 1 ? '' : 's'} on ${sourceDomain}.`;
  const supporting = thirdParty > 0
    ? ` ${thirdParty} third-party surfaces detected. Click any domain to inspect it in Internet Map.`
    : ' Click any domain to inspect it in Internet Map.';
  trackerSummary.textContent = headline + supporting;

  trackerDomainList.innerHTML = '';
  trackerEmpty.classList.add('hidden');

  domains.slice(0, 8).forEach((domain) => {
    const button = document.createElement('button');
    button.className = 'tracker-chip';
    button.dataset.domain = domain.domain;
    button.innerHTML = `
      <span class="tracker-chip-main">
        <span class="tracker-chip-domain">${esc(domain.domain)}</span>
        <span class="tracker-chip-meta">${esc(domain.resourceTypes.slice(0, 2).join(' • ') || 'request')}</span>
      </span>
      <span class="tracker-chip-count">${domain.blockedCount}</span>
    `;
    button.addEventListener('click', () => openInternetMap(domain.domain, 'trackers'));
    trackerDomainList.appendChild(button);
  });

  window.dispatchEvent(new CustomEvent('angle:tracker-intel', { detail: intel }));
  renderShieldPopover(intel);
}

async function refreshTrackerIntel(tabId = activeTabId) {
  if (!api || tabId == null) return null;

  const intel = await api.getTrackerIntel(tabId);
  if (tabId !== activeTabId) return intel;
  renderTrackerIntel(intel);
  return intel;
}

function renderShieldPopover(intel = activeTrackerIntel) {
  const pageBlocked = intel?.pageBlocked ?? blockedCounts[activeTabId] ?? 0;
  const sessionBlocked = intel?.totalBlocked ?? 0;
  const topDomains = intel?.domains?.slice(0, 4) || [];

  shieldPageCount.textContent = String(pageBlocked);
  shieldSessionCount.textContent = String(sessionBlocked);
  shieldToggleBtn.textContent = blockerEnabled ? 'Pause' : 'Resume';
  shieldToggleBtn.classList.toggle('is-paused', !blockerEnabled);
  shieldStatusCopy.textContent = blockerEnabled
    ? `The shield is actively filtering tracker and ad requests${intel?.sourceDomain ? ` on ${intel.sourceDomain}` : ''}.`
    : 'The shield is paused. Tracker and ad requests are currently allowed through.';

  if (topDomains.length === 0) {
    shieldDomainList.innerHTML = '<div class="tracker-empty">No blocked domains to inspect yet.</div>';
    return;
  }

  shieldDomainList.innerHTML = '';
  topDomains.forEach((domain) => {
    const button = document.createElement('button');
    button.className = 'shield-domain-item';
    button.innerHTML = `
      <span class="shield-domain-main">
        <span class="shield-domain-name">${esc(domain.domain)}</span>
        <span class="shield-domain-meta">${esc(domain.resourceTypes.slice(0, 2).join(' • ') || 'request')}</span>
      </span>
      <span class="shield-domain-count">${domain.blockedCount}</span>
    `;
    button.addEventListener('click', () => {
      setShieldPopoverOpen(false);
      openInternetMap(domain.domain, 'trackers');
    });
    shieldDomainList.appendChild(button);
  });
}

function setShieldPopoverOpen(isOpen) {
  shieldPopover.classList.toggle('hidden', !isOpen);
}

async function updateSecurityInfo() {
  if (!api || activeTabId == null) return;

  const requestedTabId = activeTabId;
  const [info, trackerIntel] = await Promise.all([
    api.getSecurityInfo(),
    api.getTrackerIntel(requestedTabId),
  ]);

  if (requestedTabId !== activeTabId || !info) return;

  const scoreEl = document.getElementById('privacy-score');
  scoreEl.textContent = info.privacyScore;
  scoreEl.style.color = info.privacyScore >= 80
    ? 'var(--green)'
    : info.privacyScore >= 55
      ? 'var(--amber)'
      : 'var(--red)';

  domainVal.textContent = info.domain || '-';
  document.getElementById('proto-val').textContent = info.isSecure ? 'HTTPS (Secure)' : 'HTTP / local';
  document.getElementById('proto-val').className = `value ${info.isSecure ? 'badge-green' : 'badge-red'}`;
  document.getElementById('cert-val').textContent = info.certificate ? info.certificate.issuer : 'No certificate';
  document.getElementById('cookies-count').textContent = String(info.cookieCount);
  thirdPartyCount.textContent = String(info.thirdPartyDomains.length);

  renderTrackerIntel(trackerIntel);
}

function animateBlockedBadge() {
  blockedCount.classList.remove('pop');
  void blockedCount.offsetWidth;
  blockedCount.classList.add('pop');
}

function openInternetMap(focus = '', view = 'overview') {
  if (!api) return;
  api.openPage('internet-map', {
    sourceTabId: activeTrackerIntel?.tabId || activeTabId || undefined,
    focus,
    view,
  });
}

function focusTrackerSection() {
  if (!hasSidebarOpen()) {
    api?.toggleSidebar();
    setTimeout(() => trackerSection.scrollIntoView({ block: 'start', behavior: 'smooth' }), 180);
    return;
  }

  trackerSection.scrollIntoView({ block: 'start', behavior: 'smooth' });
}

function formatPhantomTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

async function updateTorCircuit() {
  if (!api) return;

  const circuit = await api.getTorCircuit();
  const circuitEl = document.getElementById('tor-circuit');

  if (!circuit || !circuit.isActive) {
    circuitEl.innerHTML = '<span class="tor-disabled">Tor is disabled</span>';
    return;
  }

  circuitEl.innerHTML = circuit.nodes.map((node) => `<div class="tor-node">${esc(node)}</div>`).join('');
}

async function startPhantom() {
  if (!api || phantomSession) return;

  phantomBtn.classList.add('phantom-active');
  showToast('Creating isolated phantom container...', 'var(--purple)');

  try {
    const result = await api.phantomStart();
    if (!result || !result.session_id) {
      throw new Error('No session returned');
    }

    phantomSession = result;
    phantomBar.classList.remove('hidden');
    phantomInfo.textContent = `Container phantom_${result.session_id.slice(0, 8)} • Port ${result.port}`;
    phantomTimerEl.style.color = '#dcc7ff';
    phantomTimerEl.textContent = '30:00';

    let remaining = 1800;
    phantomTimer = setInterval(() => {
      remaining -= 1;
      phantomTimerEl.textContent = formatPhantomTime(remaining);

      if (remaining <= 60) {
        phantomTimerEl.style.color = 'var(--red)';
      } else if (remaining <= 300) {
        phantomTimerEl.style.color = 'var(--amber)';
      }

      if (remaining <= 0) endPhantom();
    }, 1000);

    showToast('Phantom Mode active. Searches now run inside an isolated container.', 'var(--purple)');
  } catch (error) {
    phantomBtn.classList.remove('phantom-active');
    showToast(`Failed to start Phantom Mode: ${error.message || error}`, 'var(--red)');
  }
}

async function endPhantom() {
  if (!api || !phantomSession) return;

  try {
    await api.phantomEnd(phantomSession.session_id);
  } catch {
    // Best effort cleanup
  }

  phantomSession = null;
  phantomBar.classList.add('hidden');
  phantomBtn.classList.remove('phantom-active');

  if (phantomTimer) {
    clearInterval(phantomTimer);
    phantomTimer = null;
  }

  showToast('Phantom container destroyed. Session residue cleared.', 'var(--green)');
}

addressBar.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    const value = addressBar.value.trim();
    if (value) api?.navigate(value);
    addressBar.blur();
  }

  if (event.key === 'Escape') {
    const tab = activeTab();
    if (tab) addressBar.value = tab.url || '';
    addressBar.blur();
  }
});

newTabBtn.addEventListener('click', () => api?.newTab());
backBtn.addEventListener('click', () => api?.goBack());
forwardBtn.addEventListener('click', () => api?.goForward());
reloadBtn.addEventListener('click', () => api?.reload());
homeBtn.addEventListener('click', () => api?.goHome());

bookmarkStar.addEventListener('click', async () => {
  if (!api) return;
  const tab = activeTab();
  if (!tab) return;

  const nextState = await api.toggleBookmark(tab.title || 'Bookmark', tab.url || '');
  setBookmarkState(nextState);
  loadBookmarksBar();
});

allBookmarksBtn.addEventListener('click', () => api?.openPage('bookmarks'));

shieldBtn.addEventListener('click', async (event) => {
  event.stopPropagation();
  const willOpen = shieldPopover.classList.contains('hidden');
  if (willOpen) {
    await refreshTrackerIntel(activeTabId);
  }
  setShieldPopoverOpen(willOpen);
});

shieldPopover.addEventListener('click', (event) => {
  event.stopPropagation();
});

shieldToggleBtn.addEventListener('click', async () => {
  if (!api) return;
  blockerEnabled = await api.toggleBlocker();
  shieldBtn.classList.toggle('shield-active', blockerEnabled);
  renderShieldPopover();
  showToast(blockerEnabled ? 'Tracker blocker enabled' : 'Tracker blocker paused', blockerEnabled ? 'var(--green)' : 'var(--amber)');
  updateSecurityInfo();
});

shieldOpenMap.addEventListener('click', () => {
  setShieldPopoverOpen(false);
  openInternetMap(activeTrackerIntel?.sourceDomain || '', 'page');
});

shieldOpenOverview.addEventListener('click', () => {
  setShieldPopoverOpen(false);
  openSecurityOverview();
});

torBtn.addEventListener('click', async () => {
  if (!api) return;
  torEnabled = await api.toggleTor();
  torBtn.classList.toggle('tor-active', torEnabled);
  window.dispatchEvent(new CustomEvent('angle:tor-status', { detail: torEnabled }));
  updateTorCircuit();
});

zoomIn.addEventListener('click', async () => {
  if (!api) return;
  currentZoom = await api.zoomIn();
  zoomLevel.textContent = `${currentZoom}%`;
});

zoomOut.addEventListener('click', async () => {
  if (!api) return;
  currentZoom = await api.zoomOut();
  zoomLevel.textContent = `${currentZoom}%`;
});

zoomLevel.addEventListener('click', async () => {
  if (!api) return;
  currentZoom = await api.zoomReset();
  zoomLevel.textContent = `${currentZoom}%`;
});

downloadsBtn.addEventListener('click', () => api?.openPage('downloads'));
historyBtn.addEventListener('click', () => api?.openPage('history'));
mapBtn.addEventListener('click', () => openInternetMap(activeTrackerIntel?.sourceDomain || '', 'overview'));
overviewBtn.addEventListener('click', () => openSecurityOverview());
settingsBtn.addEventListener('click', () => api?.openPage('settings'));
securityBtn.addEventListener('click', () => api?.toggleSidebar());
closeSidebar.addEventListener('click', () => api?.toggleSidebar());

trackersPageBtn.addEventListener('click', () => {
  openInternetMap(activeTrackerIntel?.sourceDomain || '', 'page');
});

trackersTotalBtn.addEventListener('click', () => {
  openSecurityOverview();
});

openMapInsight.addEventListener('click', () => {
  openInternetMap(activeTrackerIntel?.sourceDomain || '', 'overview');
});

openSessionOverview.addEventListener('click', () => {
  openSecurityOverview();
});

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

document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
  contextMenu.classList.remove('hidden');
  contextMenu.style.left = `${Math.min(event.clientX, window.innerWidth - 210)}px`;
  contextMenu.style.top = `${Math.min(event.clientY, window.innerHeight - 220)}px`;
});

document.addEventListener('click', () => {
  contextMenu.classList.add('hidden');
  setShieldPopoverOpen(false);
});

contextMenu.querySelectorAll('.ctx-item').forEach((item) => {
  item.addEventListener('click', async () => {
    const action = item.dataset.action;
    if (action === 'back') api?.goBack();
    if (action === 'forward') api?.goForward();
    if (action === 'reload') api?.reload();
    if (action === 'newtab') api?.newTab();
    if (action === 'copyurl') {
      const tab = activeTab();
      if (tab?.url) {
        try {
          await navigator.clipboard.writeText(tab.url);
          showToast('Page URL copied', 'var(--accent)');
        } catch {
          showToast('Clipboard unavailable', 'var(--amber)');
        }
      }
    }
    contextMenu.classList.add('hidden');
  });
});

document.addEventListener('keydown', (event) => {
  const command = event.metaKey || event.ctrlKey;
  if (command && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    addressBar.focus();
    addressBar.select();
  }
  if (command && event.key.toLowerCase() === 'd') {
    event.preventDefault();
    bookmarkStar.click();
  }
  if (command && event.key.toLowerCase() === 'j') {
    event.preventDefault();
    api?.openPage('downloads');
  }
  if (command && event.key.toLowerCase() === 'y') {
    event.preventDefault();
    api?.openPage('history');
  }
});

window.addEventListener('angle:refresh-security', () => {
  if (hasSidebarOpen()) updateSecurityInfo();
});

if (api) {
  api.onTabCreated((data) => {
    tabs.push({ ...data, isLoading: true });
    renderTabs();
  });

  api.onTabUpdated((data) => {
    const index = tabs.findIndex(tab => tab.id === data.id);
    if (index >= 0) {
      tabs[index] = { ...tabs[index], ...data };
      renderTabs();
    }

    if (data.id !== activeTabId) return;

    if (data.isLoading) {
      progressBar.classList.remove('hidden');
      progressFill.style.width = '12%';
      setTimeout(() => { progressFill.style.width = '42%'; }, 220);
      setTimeout(() => { progressFill.style.width = '72%'; }, 720);
    } else {
      progressFill.style.width = '100%';
      setTimeout(() => {
        progressBar.classList.add('hidden');
        progressFill.style.width = '0%';
      }, 260);
    }
  });

  api.onTabActivated(async (tabId) => {
    activeTabId = tabId;
    setShieldPopoverOpen(false);
    renderTabs();

    const tab = activeTab();
    if (tab) {
      addressBar.value = tab.url || '';
      blockedCount.textContent = String(blockedCounts[tabId] || 0);
      updateSslIndicator(tab.url || '');
      await Promise.all([
        checkBookmark(tab.url),
        refreshTrackerIntel(tabId),
      ]);
    }

    currentZoom = await api.getZoom();
    zoomLevel.textContent = `${currentZoom}%`;
  });

  api.onTabClosed((tabId) => {
    tabs = tabs.filter(tab => tab.id !== tabId);
    delete blockedCounts[tabId];
    if (activeTabId === tabId) {
      activeTabId = tabs[0]?.id ?? null;
    }
    renderTabs();
  });

  api.onUrlChanged((data) => {
    const tab = tabs.find(entry => entry.id === data.tabId);
    if (!tab) return;

    tab.url = data.url;

    if (data.tabId === activeTabId) {
      addressBar.value = data.url;
      updateSslIndicator(data.url);
      backBtn.disabled = !data.canGoBack;
      forwardBtn.disabled = !data.canGoForward;
      checkBookmark(data.url);
      refreshTrackerIntel(activeTabId);
      if (hasSidebarOpen()) updateSecurityInfo();
    }
  });

  api.onBlockedCountUpdate((data) => {
    blockedCounts[data.tabId] = data.count;
    if (data.tabId === activeTabId) {
      blockedCount.textContent = String(data.count);
      animateBlockedBadge();
      refreshTrackerIntel(activeTabId);
      if (!shieldPopover.classList.contains('hidden')) renderShieldPopover();
    }
  });

  api.onFocusAddressBar(() => {
    addressBar.focus();
    addressBar.select();
  });

  api.onSidebarToggled((isOpen) => {
    if (isOpen) {
      sidebar.classList.remove('hidden');
      updateSecurityInfo();
    } else {
      sidebar.classList.add('hidden');
    }
  });

  api.onTorStatusChanged((enabled) => {
    torEnabled = enabled;
    torBtn.classList.toggle('tor-active', enabled);
    window.dispatchEvent(new CustomEvent('angle:tor-status', { detail: torEnabled }));
    updateTorCircuit();
    showToast(
      enabled ? 'Tor enabled. Traffic now routes through the Tor network.' : 'Tor disabled. Traffic is direct again.',
      enabled ? 'var(--purple)' : 'var(--muted)'
    );
  });

  api.onDownloadStarted((download) => showToast(`Downloading ${download.filename}`, 'var(--green)'));
  api.onDownloadDone((download) => showToast(
    download.state === 'completed' ? `Downloaded ${download.filename}` : `Download failed: ${download.filename}`,
    download.state === 'completed' ? 'var(--green)' : 'var(--red)'
  ));

  api.onSettingsChanged((settings) => {
    applySettings(settings);
    blockerEnabled = settings.blockTrackers;
    shieldBtn.classList.toggle('shield-active', blockerEnabled);
    renderShieldPopover();
  });

  api.getSettings().then(applySettings);
  api.getBlockerStats().then((stats) => {
    blockerEnabled = stats.enabled;
    shieldBtn.classList.toggle('shield-active', stats.enabled);
    trackersTotal.textContent = String(stats.totalBlocked);
    renderShieldPopover();
  });
  api.getTorStatus().then((status) => {
    torEnabled = !!status?.enabled;
    torBtn.classList.toggle('tor-active', torEnabled);
    window.dispatchEvent(new CustomEvent('angle:tor-status', { detail: torEnabled }));
    updateTorCircuit();
  });
  api.getZoom().then((zoom) => {
    currentZoom = zoom;
    zoomLevel.textContent = `${zoom}%`;
  });
}

setBookmarkState(false);
updateSslIndicator('');
loadBookmarksBar();
