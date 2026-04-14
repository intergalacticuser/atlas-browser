<p align="center">
  <img src="assets/logo.png" alt="Angle Browser" width="200">
</p>

<h1 align="center">Angle Browser</h1>

<p align="center">
  <a href="https://github.com/intergalacticuser/angle-browser/releases"><img src="https://img.shields.io/github/v/release/intergalacticuser/angle-browser?style=flat-square&label=release&color=cyan" alt="Release"></a>
  <img src="https://img.shields.io/badge/platform-macOS_Apple_Silicon-blue?style=flat-square" alt="macOS">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License"></a>
  <img src="https://img.shields.io/badge/privacy-100%25-brightgreen?style=flat-square" alt="Privacy Score">
</p>

---

## Why I built this

I got tired of being the product.

Every browser I've used either tracks me, profiles me, or quietly sends data to some ad network pretending it's "anonymous telemetry." Even the privacy-focused ones still rely on Google for search results - the same Google that logs every query.

I wanted something different. Not a fork with a few toggles flipped. Something built from scratch with a simple rule: **your data is yours, period.**

So I built Angle Browser. It's a real browser - videos play, web apps work, everything you expect. But underneath, it's fundamentally different:

- **Zero telemetry.** Not reduced telemetry. Zero.
- **No tracking cookies.** Not first-party. Not third-party. None.
- **Tracker blocker built in.** Not an extension you have to install.
- **Tor with one click.** Not a separate app. Not a hidden setting. A button.
- **A search engine that doesn't spy on you.** I built that too. It's called [Search Angel](https://github.com/intergalacticuser/search-angel).

This is a beta. It's not perfect. There are rough edges and missing features. But it works, it's fast, and it respects you.

If you've ever wished a browser like this existed - here it is. And if you want to help make it better, I'd genuinely love that.

*- Daniel*

---

## Features

| | What | Why it matters |
|---|------|---------------|
| :shield: | **Tracker Blocker + Shield Popover** | Blocks ads and trackers, shows live page/session counts, and lets you drill straight into blocked domains. |
| :onion: | **Tor Integration** | One button. All traffic through Tor. Your ISP sees nothing. |
| :ghost: | **Phantom Mode** | Spins up an isolated Docker container for your session. When done - container destroyed. Zero trace. |
| :mag: | **Search Angel** | Privacy search engine. Only uses DuckDuckGo, Brave, Startpage, Mojeek. Google/Bing disabled. |
| :world_map: | **Internet Map** | Page-aware internet topology with tracker, infrastructure, and current-page presets built into the browser. |
| :lock: | **Privacy Score** | Every site gets a 0-100 privacy rating in real time. |
| :bar_chart: | **Security Dashboard** | SSL status, cookies, trackers blocked, Tor circuit, and live network preview in one sidebar. |
| :clipboard: | **Security Overview** | Session-wide and historical protection telemetry with top trackers, page history, and privacy trends. |
| :bookmark: | **Bookmarks** | Bar + full manager. Local only. |
| :clock3: | **History** | Dedicated history view in both the toolbar and app menu for quick revisit workflows. |
| :arrow_down: | **Downloads** | Built-in manager with progress tracking. |
| :broom: | **Auto-Clear** | Everything wiped on exit. By default. |
| :gear: | **Settings** | Homepage, privacy, Tor, appearance, downloads. |

## What's New In 0.3.1

- `Internet Map` now opens with a real baseline topology instead of an empty state, and follows the current browsing context automatically.
- `Use Current Page`, `This Page`, and `Open Internet Map` now resolve against the last real web page, so internal browser pages no longer break map context.
- `Total Session` now opens a dedicated `Total Security Overview` page with current-session and historical protection telemetry.
- The tracker blocker now has an info popover with per-page/session counts, blocked-domain detail, pause/resume control, and shortcuts into the map and overview.
- Added `History` and `Security Overview` entry points to both the main toolbar and the native app menu.
- The security sidebar and mini network map now stay live as you browse, block requests, and switch between direct and Tor routing.

## Install

### npx (fastest - one command)

```bash
npx angle-browser
```

This downloads the latest release, installs it to `/Applications`, and launches automatically. That's it. One line.

[![npm](https://img.shields.io/npm/v/angle-browser?style=flat-square&color=red&label=npm)](https://www.npmjs.com/package/angle-browser)

### npm global install

```bash
npm install -g angle-browser
angle-browser
```

### curl

```bash
curl -sL https://raw.githubusercontent.com/intergalacticuser/angle-browser/main/install.sh | bash
```

### Download DMG

Grab the `.dmg` directly from the [Releases page](https://github.com/intergalacticuser/angle-browser/releases).

### Build from source

```bash
git clone https://github.com/intergalacticuser/angle-browser.git
cd angle-browser
npm install
npm start       # dev mode
npm run build   # build .dmg
```

Requires Node.js 20+, macOS 12+ (Apple Silicon)

## How privacy works

I want to be completely transparent:

```
Your device ──[HTTPS]──> Search Angel server ──> SearXNG (self-hosted)
                                                    ├── DuckDuckGo (no logging)
                                                    ├── Brave Search (no logging)
                                                    ├── Startpage (no logging)
                                                    └── Mojeek (no logging)
```

- **Your query** exists in server RAM for a fraction of a second. Then it's gone. No database. No log file.
- **Your IP** gets one-way hashed with a daily rotating salt. The original is never stored.
- **Google and Bing are off.** They log everything. That's a dealbreaker.
- **SearXNG runs on our server.** Queries don't leave our infrastructure until they hit the privacy engines.
- **Tor mode:** even our server doesn't know who connected.
- **Phantom Mode:** your session runs in a Docker container that's destroyed when you're done.

## Phantom Mode

The feature I'm most proud of.

Activate it and a fresh Docker container spins up just for you. All your searches happen inside it. When you end the session - or it auto-expires after 30 minutes - the container is permanently destroyed. Not stopped. Not archived. **Destroyed.**

Nothing survives. It's like the session never happened.

## Search Angel

Angle Browser's default search engine. Also open source:

**[github.com/intergalacticuser/search-angel](https://github.com/intergalacticuser/search-angel)**

Hybrid search (BM25 + vector embeddings + live web), evidence-based ranking, source credibility scoring. Built with FastAPI, PostgreSQL, OpenSearch, and SearXNG.

## Roadmap

**Shipped:**
- [x] Multi-tab browser (Chromium engine)
- [x] Search Angel integration
- [x] Tracker/ad blocker
- [x] One-click Tor
- [x] Phantom Mode
- [x] Internet Map
- [x] Security dashboard
- [x] Session security overview + persistent security history
- [x] Bookmarks, downloads, history, settings
- [x] macOS .dmg

**Next:**
- [ ] Dynamic blocker lists (EasyList)
- [ ] Tab favicons
- [ ] Reader mode
- [ ] Real certificate parsing

**Later:**
- [ ] Windows & Linux
- [ ] Limited extension support
- [ ] Local-only password manager
- [ ] Encrypted sync

## Contributing

This is beta. It needs work. If you care about privacy on the web, help me build it.

- **Found a bug?** [Open an issue](https://github.com/intergalacticuser/angle-browser/issues)
- **Have an idea?** Start a discussion or submit a PR
- **Want to contribute code?** Fork, branch, PR. Standard flow.

No contribution is too small.

## License

MIT - do whatever you want with it.

---

<p align="center">
  <sub>Built with stubbornness and a belief that the web should respect the people using it.</sub>
</p>
