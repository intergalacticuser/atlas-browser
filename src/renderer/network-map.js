const networkCanvas = document.getElementById('network-canvas');

if (networkCanvas && window.browserAPI) {
  const api = window.browserAPI;
  const ctx = networkCanvas.getContext('2d');

  const COLORS = {
    bg: '#06090f',
    text: '#eef3ff',
    muted: '#7c88a3',
    accent: '#70d6ff',
    accentSoft: 'rgba(112, 214, 255, 0.35)',
    green: '#52d39b',
    red: '#ff6f86',
    purple: '#af80ff',
    amber: '#f3bc58',
  };

  let width = 280;
  let height = 200;
  let frame = 0;
  let torMode = false;
  let trackerIntel = null;

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const nextWidth = networkCanvas.clientWidth || 280;
    const nextHeight = networkCanvas.clientHeight || 200;
    width = nextWidth;
    height = nextHeight;
    networkCanvas.width = nextWidth * dpr;
    networkCanvas.height = nextHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  function glowCircle(x, y, radius, color) {
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 2.8);
    gradient.addColorStop(0, `${color}33`);
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius * 2.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function buildGraph() {
    const sourceDomain = trackerIntel?.sourceDomain || 'Search Angel';
    const trackerDomains = (trackerIntel?.domains || []).slice(0, 4);
    const nodes = [];
    const edges = [];

    const sourceNode = {
      id: 'source',
      label: sourceDomain,
      subtitle: trackerIntel?.isSecure ? 'HTTPS origin' : 'Direct origin',
      x: width - 42,
      y: height / 2,
      radius: 12,
      color: COLORS.accent,
    };

    const youNode = {
      id: 'you',
      label: 'You',
      subtitle: torMode ? 'via Tor' : 'browser',
      x: 40,
      y: height / 2,
      radius: 12,
      color: COLORS.green,
    };

    nodes.push(youNode);

    if (torMode) {
      const guard = { id: 'guard', label: 'Guard', subtitle: 'entry', x: width * 0.28, y: height * 0.28, radius: 7, color: COLORS.purple };
      const relay = { id: 'relay', label: 'Relay', subtitle: 'middle hop', x: width * 0.48, y: height * 0.7, radius: 7, color: COLORS.purple };
      const exit = { id: 'exit', label: 'Exit', subtitle: 'egress', x: width * 0.7, y: height * 0.34, radius: 7, color: COLORS.purple };
      nodes.push(guard, relay, exit);
      edges.push([youNode, guard], [guard, relay], [relay, exit], [exit, sourceNode]);
    } else {
      const shield = { id: 'shield', label: 'Shield', subtitle: `${trackerIntel?.pageBlocked || 0} blocked`, x: width * 0.33, y: height / 2, radius: 8, color: COLORS.green };
      const dns = { id: 'dns', label: 'Resolver', subtitle: '1.1.1.1 / 8.8.8.8', x: width * 0.56, y: height * 0.22, radius: 7, color: COLORS.amber };
      nodes.push(shield, dns);
      edges.push([youNode, shield], [shield, sourceNode], [shield, dns], [dns, sourceNode]);
    }

    nodes.push(sourceNode);

    trackerDomains.forEach((domain, index) => {
      const angle = trackerDomains.length === 1
        ? Math.PI / 2
        : (Math.PI / 1.2) + (index / Math.max(1, trackerDomains.length - 1)) * (Math.PI / 1.6);
      const trackerNode = {
        id: `tracker-${domain.domain}`,
        label: domain.domain.replace(/^www\./, ''),
        subtitle: `${domain.blockedCount} blocked`,
        x: sourceNode.x - Math.cos(angle) * 82,
        y: sourceNode.y + Math.sin(angle) * 44,
        radius: 7,
        color: COLORS.red,
      };
      nodes.push(trackerNode);
      edges.push([trackerNode, sourceNode]);
    });

    return { nodes, edges, sourceDomain, trackerCount: trackerDomains.length };
  }

  function drawEdge(fromNode, toNode, color, speedFactor = 1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -frame * speedFactor;
    ctx.beginPath();
    ctx.moveTo(fromNode.x, fromNode.y);
    ctx.lineTo(toNode.x, toNode.y);
    ctx.stroke();
    ctx.setLineDash([]);

    const progress = ((frame * speedFactor) % 120) / 120;
    const x = fromNode.x + (toNode.x - fromNode.x) * progress;
    const y = fromNode.y + (toNode.y - fromNode.y) * progress;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawGraph() {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    const graph = buildGraph();

    graph.edges.forEach(([fromNode, toNode]) => {
      const edgeColor = fromNode.color === COLORS.red ? 'rgba(255, 111, 134, 0.42)' : 'rgba(112, 214, 255, 0.34)';
      drawEdge(fromNode, toNode, edgeColor, fromNode.color === COLORS.red ? 1.6 : 1.1);
    });

    graph.nodes.forEach((node) => {
      glowCircle(node.x, node.y, node.radius, node.color);
      ctx.fillStyle = node.color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = COLORS.text;
      ctx.font = '10px "SF Pro Display", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.label.length > 18 ? `${node.label.slice(0, 16)}…` : node.label, node.x, node.y + node.radius + 14);
    });

    ctx.fillStyle = COLORS.muted;
    ctx.font = '10px "SF Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(
      torMode
        ? `Tor route • ${trackerIntel?.pageBlocked || 0} requests neutralized`
        : `Direct route • ${graph.trackerCount} tracker domains mapped`,
      10,
      16
    );

    frame += 1;
    requestAnimationFrame(drawGraph);
  }

  async function refreshTrackerIntel() {
    trackerIntel = await api.getTrackerIntel();
  }

  window.addEventListener('angle:tracker-intel', (event) => {
    trackerIntel = event.detail;
  });

  window.addEventListener('angle:tor-status', (event) => {
    torMode = !!event.detail;
  });

  api.onUrlChanged(() => {
    refreshTrackerIntel();
  });

  api.onBlockedCountUpdate(() => {
    refreshTrackerIntel();
  });

  api.getTorStatus().then((status) => {
    torMode = !!status?.enabled;
  });

  refreshTrackerIntel();
  drawGraph();
}
