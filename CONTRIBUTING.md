# Contributing to Atlasiant Browser

Thank you for your interest in contributing to Atlasiant Browser! We're building the most private browser possible and we need your help.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/atlasiant-browser.git`
3. Install dependencies: `npm install`
4. Run in development: `npm start`

## Development

```bash
# Compile TypeScript (watches for changes)
npx tsc

# Run the browser
npx electron .

# Build .dmg
npm run build
```

## Project Structure

```
src/
  main/           # Electron main process (TypeScript)
    index.ts      # App entry point
    tab-manager.ts    # Tab lifecycle
    blocker.ts        # Tracker/ad blocking
    tor-manager.ts    # Tor proxy
    ...
  renderer/       # Browser UI (HTML/CSS/JS)
    index.html    # Browser chrome
    styles.css    # Theme
    browser-ui.js # UI logic
    ...
  preload/        # IPC bridge
    preload.ts    # Secure API exposure
```

## Guidelines

- **Privacy first** - Never add telemetry, analytics, or tracking
- **Keep it simple** - We prefer less code that does more
- **Test your changes** - Make sure the browser works before submitting
- **One PR per feature** - Keep PRs focused

## What We Need Help With

- Windows and Linux support
- Dynamic blocker list updates (EasyList integration)
- Tab favicon extraction
- Reader mode
- Accessibility improvements
- Performance optimization
- Documentation and translations

## Code of Conduct

Be kind. Be respectful. We're all here to build something good.
