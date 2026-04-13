# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Angle Browser, **please report it responsibly**.

Email: intergalacticuser@users.noreply.github.com

Or open a [GitHub issue](https://github.com/intergalacticuser/angle-browser/issues) with the `security` label.

I take security seriously - especially in a privacy-focused browser. I'll respond within 48 hours.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | Yes (current beta) |

## Security Measures

Angle Browser implements:
- Context isolation + sandboxed BrowserViews
- No node integration in renderer
- Secure preload bridge (contextBridge API)
- Built-in tracker/ad blocking
- Cookie auto-clear on exit
- User agent normalization
- Referrer stripping
- Tor integration for anonymous browsing
