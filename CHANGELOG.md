# Changelog

## 0.3.1 - 2026-04-14

### Added
- `Total Security Overview` page with current-session and historical privacy telemetry.
- Persistent security history storage for recent page snapshots, blocked requests, and top tracker aggregates.
- Toolbar and native menu entry points for `History`, `Internet Map`, and `Security Overview`.
- Adblocker / tracker shield popover with per-page and session stats, blocked-domain drilldown, and quick actions.
- Context-aware Internet Map presets for `overview`, `page`, `trackers`, and `infrastructure`.

### Improved
- Internet Map now boots with a baseline structure immediately instead of an empty canvas.
- `Use Current Page` now follows the most recent real browsing tab, even when launched from internal browser pages.
- Security sidebar now stays in sync with live tracker telemetry, Tor routing state, and the mini network map.
- BrowserView sizing and preferred content tab tracking are more reliable across sidebar and bookmarks bar changes.
- Runtime defaults for video and streaming flows were kept in place while the browser chrome was upgraded.

### Fixed
- Fixed broken Internet Map context handoff from `Open Internet Map` and `This page`.
- Fixed session totals so `Total session` opens a dedicated security overview instead of a dead-end counter.
- Fixed blocker insights so blocked request details flow from the main process into the renderer correctly.
- Fixed version metadata drift in the app settings page and release metadata.
