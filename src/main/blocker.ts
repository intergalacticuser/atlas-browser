import { Session } from 'electron';

// Common tracker/ad domains to block
const BLOCKED_DOMAINS = new Set([
  // Ad networks
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com',
  'google-analytics.com', 'googletagmanager.com', 'googletagservices.com',
  'adservice.google.com', 'pagead2.googlesyndication.com',
  'ads.facebook.com', 'pixel.facebook.com', 'connect.facebook.net',
  'ad.doubleclick.net', 'adnxs.com', 'adsrvr.org',
  'amazon-adsystem.com', 'ads-twitter.com',
  'advertising.com', 'criteo.com', 'criteo.net',
  'outbrain.com', 'taboola.com', 'revcontent.com',
  // Trackers
  'hotjar.com', 'fullstory.com', 'mouseflow.com',
  'mixpanel.com', 'amplitude.com', 'segment.com', 'segment.io',
  'optimizely.com', 'crazyegg.com', 'clicktale.net',
  'newrelic.com', 'nr-data.net', 'pingdom.net',
  'quantserve.com', 'scorecardresearch.com', 'imrworldwide.com',
  'comscore.com', 'chartbeat.com', 'parsely.com',
  // Social trackers
  'platform.twitter.com', 'syndication.twitter.com',
  'platform.linkedin.com', 'snap.licdn.com',
  'static.ads-twitter.com',
  // Fingerprinting
  'fingerprintjs.com', 'cdn.jsdelivr.net/npm/@aspect',
  // Misc trackers
  'tracking.', 'analytics.', 'telemetry.',
  'sentry.io', 'bugsnag.com',
]);

// URL patterns to block
const BLOCKED_PATTERNS = [
  /\/ads\//i,
  /\/tracking\//i,
  /\/analytics\//i,
  /\/pixel\//i,
  /google-analytics/i,
  /facebook.*pixel/i,
  /doubleclick/i,
  /\.gif\?.*utm_/i,
  /__utm\.gif/i,
  /beacon\./i,
];

type BlockCallback = () => void;

export class Blocker {
  private callbacks: Map<number, BlockCallback[]> = new Map();
  private totalBlocked: number = 0;
  private isEnabled: boolean = true;

  setup(session: Session): void {
    session.webRequest.onBeforeRequest((details, callback) => {
      if (!this.isEnabled) {
        callback({});
        return;
      }

      const shouldBlock = this.shouldBlock(details.url);

      if (shouldBlock) {
        this.totalBlocked++;

        // Notify tab-specific callbacks
        const tabCallbacks = details.webContentsId != null ? this.callbacks.get(details.webContentsId) : undefined;
        if (tabCallbacks) {
          tabCallbacks.forEach(cb => cb());
        }

        callback({ cancel: true });
      } else {
        callback({});
      }
    });
  }

  private shouldBlock(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;

      // Check against blocked domains
      for (const domain of BLOCKED_DOMAINS) {
        if (hostname === domain || hostname.endsWith('.' + domain)) {
          return true;
        }
      }

      // Check URL patterns
      for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(url)) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  onBlocked(webContentsId: number, callback: BlockCallback): void {
    const existing = this.callbacks.get(webContentsId) || [];
    existing.push(callback);
    this.callbacks.set(webContentsId, existing);
  }

  toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    return this.isEnabled;
  }

  get enabled(): boolean {
    return this.isEnabled;
  }

  get blockedTotal(): number {
    return this.totalBlocked;
  }
}
