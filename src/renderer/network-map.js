// Network Map - Canvas visualization of connection path

const canvas = document.getElementById('network-canvas');
if (canvas) {
  const ctx = canvas.getContext('2d');
  // HiDPI fix for Retina
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 280;
  const cssH = canvas.clientHeight || 200;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.scale(dpr, dpr);
  const W = cssW;
  const H = cssH;

  // Colors
  const BG = '#0a0a0f';
  const ACCENT = '#00d4ff';
  const PURPLE = '#a855f7';
  const GREEN = '#22c55e';
  const MUTED = '#8888a0';
  const TEXT = '#e2e2e8';

  let animFrame = 0;
  let torMode = false;
  let currentDomain = 'Search Angel';

  // Node positions
  function getNodes() {
    if (torMode) {
      return [
        { x: 40, y: H / 2, label: 'You', color: GREEN, r: 12 },
        { x: W * 0.25, y: H * 0.3, label: 'Guard', color: PURPLE, r: 8 },
        { x: W * 0.5, y: H * 0.65, label: 'Relay', color: PURPLE, r: 8 },
        { x: W * 0.75, y: H * 0.35, label: 'Exit', color: PURPLE, r: 8 },
        { x: W - 40, y: H / 2, label: currentDomain, color: ACCENT, r: 12 },
      ];
    }
    return [
      { x: 40, y: H / 2, label: 'You', color: GREEN, r: 12 },
      { x: W / 2, y: H / 2, label: 'Encrypted', color: ACCENT, r: 6 },
      { x: W - 40, y: H / 2, label: currentDomain, color: ACCENT, r: 12 },
    ];
  }

  function drawFrame() {
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const nodes = getNodes();
    animFrame++;

    // Draw connections
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];

      // Animated dashed line
      ctx.strokeStyle = torMode ? PURPLE + '60' : ACCENT + '40';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -animFrame * 0.5;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Data packet animation
      const progress = ((animFrame * 2 + i * 30) % 100) / 100;
      const px = a.x + (b.x - a.x) * progress;
      const py = a.y + (b.y - a.y) * progress;
      ctx.fillStyle = torMode ? PURPLE : ACCENT;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw nodes
    for (const node of nodes) {
      // Glow
      const gradient = ctx.createRadialGradient(
        node.x, node.y, 0,
        node.x, node.y, node.r * 2.5
      );
      gradient.addColorStop(0, node.color + '30');
      gradient.addColorStop(1, 'transparent');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Node circle
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fill();

      // Label
      ctx.fillStyle = TEXT;
      ctx.font = '9px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      const labelY = node.y > H / 2 ? node.y - node.r - 8 : node.y + node.r + 14;
      ctx.fillText(node.label, node.x, labelY);
    }

    // Title
    ctx.fillStyle = MUTED;
    ctx.font = '9px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(torMode ? 'Tor Circuit (encrypted)' : 'Direct Connection (HTTPS)', 8, 14);

    requestAnimationFrame(drawFrame);
  }

  drawFrame();

  // Listen for Tor toggle
  const torBtn = document.getElementById('tor-btn');
  if (torBtn) {
    const origClick = torBtn.onclick;
    torBtn.addEventListener('click', () => {
      torMode = !torMode;
    });
  }

  // Update domain from URL changes
  if (window.browserAPI) {
    window.browserAPI.onUrlChanged((data) => {
      try {
        const url = new URL(data.url);
        currentDomain = url.hostname.replace('www.', '').slice(0, 15);
      } catch {
        currentDomain = 'Web';
      }
    });
  }
}
