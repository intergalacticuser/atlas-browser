// Security Panel - updates sidebar with security info
// Most logic is in browser-ui.js, this handles periodic updates

setInterval(async () => {
  const sidebar = document.getElementById('security-sidebar');
  if (sidebar && !sidebar.classList.contains('hidden') && window.browserAPI) {
    const stats = await window.browserAPI.getBlockerStats();
    const trackersTotal = document.getElementById('trackers-total');
    if (trackersTotal) {
      trackersTotal.textContent = stats.totalBlocked;
    }
  }
}, 3000);
