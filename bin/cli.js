#!/usr/bin/env node

/**
 * Atlasiant Browser CLI
 *
 * Usage:
 *   npx atlasiant-browser          # Download and launch
 *   npx atlasiant-browser install   # Download and install to /Applications
 *   npx atlasiant-browser --help    # Show help
 */

const { execSync } = require('child_process');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO = 'intergalacticuser/atlasiant-browser';
const APP_NAME = 'Atlasiant Browser';

const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

function log(msg) { console.log(msg); }

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    log(`
${CYAN}${BOLD}Atlasiant Browser${NC} - Privacy-First Web Browser

${BOLD}Usage:${NC}
  npx atlasiant-browser              Download & launch
  npx atlasiant-browser install      Install to /Applications
  npx atlasiant-browser --version    Show version
  npx atlasiant-browser --help       Show this help

${DIM}https://github.com/${REPO}${NC}
`);
    return;
  }

  if (args.includes('--version') || args.includes('-v')) {
    const pkg = require('../package.json');
    log(`Atlasiant Browser v${pkg.version}`);
    return;
  }

  if (os.platform() !== 'darwin') {
    log(`${CYAN}Atlasiant Browser is currently macOS only.${NC}`);
    log('Windows and Linux support coming soon.');
    process.exit(1);
  }

  if (os.arch() !== 'arm64') {
    log(`${CYAN}This release is for Apple Silicon (M1/M2/M3) only.${NC}`);
    process.exit(1);
  }

  log('');
  log(`${CYAN}${BOLD}  Atlasiant Browser${NC}`);
  log(`${DIM}  Privacy-First Web Browser${NC}`);
  log('');

  // Check if already installed
  const appPath = `/Applications/${APP_NAME}.app`;
  if (fs.existsSync(appPath) && !args.includes('install')) {
    log(`${GREEN}  Already installed. Launching...${NC}`);
    execSync(`open -a "${APP_NAME}"`);
    return;
  }

  // Download latest release
  log(`${DIM}  Fetching latest release...${NC}`);

  try {
    const releaseUrl = await getLatestDmgUrl();
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atlasiant-'));
    const dmgPath = path.join(tmpDir, 'Atlasiant-Browser.dmg');

    log(`${DIM}  Downloading...${NC}`);
    execSync(`curl -sL "${releaseUrl}" -o "${dmgPath}"`);

    log(`${DIM}  Installing...${NC}`);
    const mountOutput = execSync(`hdiutil attach "${dmgPath}" -nobrowse -quiet`).toString();
    const mountPoint = mountOutput.split('\n').filter(l => l.includes('/Volumes'))[0]?.split('\t').pop()?.trim();

    if (mountPoint) {
      const appSrc = fs.readdirSync(mountPoint).find(f => f.endsWith('.app'));
      if (appSrc) {
        if (fs.existsSync(appPath)) fs.rmSync(appPath, { recursive: true });
        execSync(`cp -R "${path.join(mountPoint, appSrc)}" "/Applications/"`);
        execSync(`xattr -rd com.apple.quarantine "${appPath}" 2>/dev/null || true`);
      }
      execSync(`hdiutil detach "${mountPoint}" -quiet 2>/dev/null || true`);
    }

    fs.rmSync(tmpDir, { recursive: true });

    log('');
    log(`${GREEN}${BOLD}  ✓ Atlasiant Browser installed${NC}`);
    log(`${DIM}  Location: /Applications/${APP_NAME}.app${NC}`);
    log('');

    execSync(`open -a "${APP_NAME}"`);
    log(`${GREEN}  Launching...${NC}`);

  } catch (err) {
    log(`Error: ${err.message}`);
    log(`Download manually: https://github.com/${REPO}/releases`);
    process.exit(1);
  }
}

function getLatestDmgUrl() {
  return new Promise((resolve, reject) => {
    https.get(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { 'User-Agent': 'atlasiant-browser-cli' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(data);
          const asset = release.assets?.find(a => a.name.endsWith('.dmg'));
          if (asset) resolve(asset.browser_download_url);
          else reject(new Error('No DMG found in latest release'));
        } catch { reject(new Error('Failed to parse release info')); }
      });
    }).on('error', reject);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
