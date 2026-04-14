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

export interface BlockedRequestDetail {
  id: string;
  url: string;
  domain: string;
  resourceType: string;
  timestamp: number;
  rule: 'domain' | 'pattern';
  matched: string;
}

type BlockRuleMatch =
  | { blocked: false }
  | { blocked: true; rule: 'domain' | 'pattern'; matched: string };

type BlockCallback = (detail: BlockedRequestDetail) => void;

export class Blocker {
  private callbacks: Map<number, BlockCallback[]> = new Map();
  private blockedByContents: Map<number, BlockedRequestDetail[]> = new Map();
  private totalBlocked: number = 0;
  private isEnabled: boolean = true;

  setup(session: Session): void {
    session.webRequest.onBeforeRequest((details, callback) => {
      if (!this.isEnabled) {
        callback({});
        return;
      }

      const match = this.shouldBlock(details.url);

      if (match.blocked) {
        this.totalBlocked++;

        const detail: BlockedRequestDetail = {
          id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
          url: details.url,
          domain: this.extractDomain(details.url),
          resourceType: details.resourceType || 'other',
          timestamp: Date.now(),
          rule: match.rule,
          matched: match.matched,
        };

        // Notify tab-specific callbacks
        const tabCallbacks = details.webContentsId != null ? this.callbacks.get(details.webContentsId) : undefined;
        if (details.webContentsId != null) {
          const existing = this.blockedByContents.get(details.webContentsId) || [];
          existing.unshift(detail);
          this.blockedByContents.set(details.webContentsId, existing.slice(0, 80));
        }
        if (tabCallbacks) {
          tabCallbacks.forEach(cb => cb(detail));
        }

        callback({ cancel: true });
      } else {
        callback({});
      }
    });
  }

  private shouldBlock(url: string): BlockRuleMatch {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;

      // Check against blocked domains
      for (const domain of BLOCKED_DOMAINS) {
        if (hostname === domain || hostname.endsWith('.' + domain)) {
          return { blocked: true, rule: 'domain', matched: domain };
        }
      }

      // Check URL patterns
      for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(url)) {
          return { blocked: true, rule: 'pattern', matched: pattern.toString() };
        }
      }

      return { blocked: false };
    } catch {
      return { blocked: false };
    }
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  onBlocked(webContentsId: number, callback: BlockCallback): void {
    const existing = this.callbacks.get(webContentsId) || [];
    existing.push(callback);
    this.callbacks.set(webContentsId, existing);
  }

  clearForWebContents(webContentsId: number): void {
    this.blockedByContents.delete(webContentsId);
  }

  removeWebContents(webContentsId: number): void {
    this.callbacks.delete(webContentsId);
    this.blockedByContents.delete(webContentsId);
  }

  getBlockedDetails(webContentsId: number): BlockedRequestDetail[] {
    return [...(this.blockedByContents.get(webContentsId) || [])];
  }

  getBlockedCount(webContentsId: number): number {
    return this.getBlockedDetails(webContentsId).length;
  }

  getBlockedDomains(webContentsId: number): string[] {
    return Array.from(new Set(this.getBlockedDetails(webContentsId).map(item => item.domain).filter(Boolean)));
  }

  setEnabled(enabled: boolean): boolean {
    this.isEnabled = enabled;
    return this.isEnabled;
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
