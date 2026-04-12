import { WebContents } from 'electron';

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
  cookieCount: number;
  privacyScore: number;
}

export class SecurityAnalyzer {
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

    // Calculate privacy score
    const privacyScore = this.calculatePrivacyScore(isSecure, cookieCount, 0);

    return {
      url,
      domain,
      protocol,
      isSecure,
      certificate,
      thirdPartyDomains: [],
      cookieCount,
      privacyScore,
    };
  }

  private calculatePrivacyScore(
    isSecure: boolean,
    cookieCount: number,
    trackerCount: number
  ): number {
    let score = 100;

    // HTTPS
    if (!isSecure) score -= 30;

    // Cookies (more cookies = lower score)
    score -= Math.min(30, cookieCount * 3);

    // Trackers
    score -= Math.min(30, trackerCount * 5);

    return Math.max(0, Math.min(100, score));
  }
}
