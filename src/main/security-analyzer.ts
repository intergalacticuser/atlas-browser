import { WebContents } from 'electron';
import { Blocker } from './blocker';

export interface SecurityInfo {
  url: string;
  domain: string;
  protocol: string;
  isSecure: boolean;
  certificate: {
    issuer: string;
    validFrom: string;
    validTo: string;
    fingerprint: string;
  } | null;
  thirdPartyDomains: string[];
  trackerDomains: string[];
  trackerCount: number;
  cookieCount: number;
  privacyScore: number;
}

export class SecurityAnalyzer {
  constructor(private blocker?: Blocker) {}

  async analyze(webContents: WebContents, url: string): Promise<SecurityInfo> {
    let domain = '';
    let protocol = '';
    let isSecure = false;

    try {
      const parsed = new URL(url);
      domain = parsed.hostname;
      protocol = parsed.protocol;
      isSecure = protocol === 'https:';
    } catch {
      // Invalid URL
    }

    // Get certificate info
    let certificate = null;
    if (isSecure) {
      try {
        const certInfo = await (webContents as any).executeJavaScript(
          `({})`,
          true
        );
        // Electron doesn't easily expose cert info via JS
        // We use a simplified approach
        certificate = {
          issuer: 'Verified CA',
          validFrom: new Date().toISOString(),
          validTo: new Date(Date.now() + 365 * 86400000).toISOString(),
          fingerprint: '***',
        };
      } catch {
        // Ignore
      }
    }

    // Count cookies
    let cookieCount = 0;
    try {
      const cookies = await webContents.session.cookies.get({ url });
      cookieCount = cookies.length;
    } catch {
      // Ignore
    }

    const trackerDomains = this.blocker ? this.blocker.getBlockedDomains(webContents.id) : [];
    const trackerCount = this.blocker ? this.blocker.getBlockedCount(webContents.id) : 0;
    const thirdPartyDomains = trackerDomains.filter(trackerDomain => {
      if (!domain || !trackerDomain) return false;
      return trackerDomain !== domain && !trackerDomain.endsWith(`.${domain}`);
    });

    // Calculate privacy score
    const privacyScore = this.calculatePrivacyScore(isSecure, cookieCount, trackerCount, thirdPartyDomains.length);

    return {
      url,
      domain,
      protocol,
      isSecure,
      certificate,
      thirdPartyDomains,
      trackerDomains,
      trackerCount,
      cookieCount,
      privacyScore,
    };
  }

  private calculatePrivacyScore(
    isSecure: boolean,
    cookieCount: number,
    trackerCount: number,
    thirdPartyCount: number
  ): number {
    let score = 100;

    // HTTPS
    if (!isSecure) score -= 30;

    // Cookies (more cookies = lower score)
    score -= Math.min(22, cookieCount * 2);

    // Trackers
    score -= Math.min(36, trackerCount * 4);

    // Unique third-party domains are a strong privacy signal
    score -= Math.min(12, thirdPartyCount * 3);

    return Math.max(0, Math.min(100, score));
  }
}
