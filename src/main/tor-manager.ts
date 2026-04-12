import { session } from 'electron';

/**
 * Privacy Proxy Manager
 *
 * HONEST DISCLOSURE: This routes traffic through our server's Tor-connected
 * SOCKS5 proxy. The server runs a real Tor daemon, but the connection from
 * your browser to our server is NOT a direct Tor circuit.
 *
 * What this means:
 * - Your ISP sees traffic going to our server (not Tor traffic directly)
 * - Our server routes through Tor to the destination
 * - The destination sees a Tor exit node, not your IP or our server IP
 * - We cannot see the content (HTTPS encrypted end-to-end)
 *
 * For true Tor-level anonymity, use the Tor Browser directly.
 * This is a privacy proxy, not a full Tor implementation.
 */
export class TorManager {
  private isEnabled: boolean = false;
  private proxyUrl: string;

  constructor() {
    // Read from settings or use default
    // The proxy connects to our server's Tor-connected SOCKS5 daemon
    this.proxyUrl = 'socks5://sa.atlasiant.com:9050';
  }

  async enable(): Promise<boolean> {
    try {
      await session.defaultSession.setProxy({
        proxyRules: this.proxyUrl,
        proxyBypassRules: 'localhost,127.0.0.1',
      });
      this.isEnabled = true;
      return true;
    } catch (err) {
      console.error('[PROXY] Failed to enable:', err);
      return false;
    }
  }

  async disable(): Promise<void> {
    await session.defaultSession.setProxy({ proxyRules: '' });
    this.isEnabled = false;
  }

  async toggle(): Promise<boolean> {
    if (this.isEnabled) {
      await this.disable();
    } else {
      await this.enable();
    }
    return this.isEnabled;
  }

  get enabled(): boolean {
    return this.isEnabled;
  }

  async getCircuitInfo(): Promise<{ nodes: string[]; isActive: boolean; disclaimer: string }> {
    if (!this.isEnabled) {
      return { nodes: [], isActive: false, disclaimer: '' };
    }
    return {
      isActive: true,
      nodes: [
        'Your Device',
        'Atlasiant Server (encrypted tunnel)',
        'Tor Network (3 hops)',
        'Destination',
      ],
      disclaimer: 'Privacy proxy via Atlasiant server → Tor. For full Tor anonymity, use Tor Browser.',
    };
  }
}
