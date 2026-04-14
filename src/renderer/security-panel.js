function requestSecurityRefresh() {
  const sidebar = document.getElementById('security-sidebar');
  if (!sidebar || sidebar.classList.contains('hidden') || !window.browserAPI) return;
  window.dispatchEvent(new CustomEvent('angle:refresh-security'));
}

setInterval(requestSecurityRefresh, 4000);

if (window.browserAPI) {
  window.browserAPI.onUrlChanged(requestSecurityRefresh);
  window.browserAPI.onBlockedCountUpdate(requestSecurityRefresh);
  window.browserAPI.onTorStatusChanged(requestSecurityRefresh);
}
