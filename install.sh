#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# Atlasiant Browser - One-Line Installer for macOS
#
# Usage:
#   curl -sL https://raw.githubusercontent.com/intergalacticuser/atlasiant-browser/main/install.sh | bash
#
# Or with wget:
#   wget -qO- https://raw.githubusercontent.com/intergalacticuser/atlasiant-browser/main/install.sh | bash
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

REPO="intergalacticuser/atlasiant-browser"
APP_NAME="Atlasiant Browser"
DMG_NAME="Atlasiant-Browser.dmg"
INSTALL_DIR="/Applications"

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

echo ""
echo -e "${CYAN}${BOLD}  ╔══════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}  ║       Atlasiant Browser Installer        ║${NC}"
echo -e "${CYAN}${BOLD}  ║    Privacy-First Web Browser          ║${NC}"
echo -e "${CYAN}${BOLD}  ╚══════════════════════════════════════╝${NC}"
echo ""

# Check macOS
if [[ "$(uname)" != "Darwin" ]]; then
  echo -e "${RED}Error: Atlasiant Browser is currently macOS only.${NC}"
  echo "Windows and Linux support coming soon."
  exit 1
fi

# Check architecture
ARCH=$(uname -m)
if [[ "$ARCH" != "arm64" ]]; then
  echo -e "${RED}Error: This release is for Apple Silicon (M1/M2/M3) only.${NC}"
  echo "Intel Mac support coming soon."
  exit 1
fi

# Get latest release URL
echo -e "${DIM}> Fetching latest release...${NC}"
DOWNLOAD_URL=$(curl -sL "https://api.github.com/repos/$REPO/releases/latest" | grep "browser_download_url.*\.dmg" | head -1 | cut -d '"' -f 4)

if [[ -z "$DOWNLOAD_URL" ]]; then
  echo -e "${RED}Error: Could not find download URL.${NC}"
  echo "Visit https://github.com/$REPO/releases manually."
  exit 1
fi

# Download
TEMP_DIR=$(mktemp -d)
DMG_PATH="$TEMP_DIR/$DMG_NAME"
echo -e "${DIM}> Downloading Atlasiant Browser...${NC}"
curl -sL "$DOWNLOAD_URL" -o "$DMG_PATH"
echo -e "${GREEN}  Downloaded $(du -h "$DMG_PATH" | cut -f1)${NC}"

# Mount DMG
echo -e "${DIM}> Mounting disk image...${NC}"
MOUNT_POINT=$(hdiutil attach "$DMG_PATH" -nobrowse -quiet | grep "/Volumes" | cut -f3)

if [[ -z "$MOUNT_POINT" ]]; then
  echo -e "${RED}Error: Failed to mount DMG.${NC}"
  exit 1
fi

# Install
echo -e "${DIM}> Installing to $INSTALL_DIR...${NC}"
APP_PATH="$MOUNT_POINT/$APP_NAME.app"

if [[ ! -d "$APP_PATH" ]]; then
  # Try alternative name
  APP_PATH=$(find "$MOUNT_POINT" -maxdepth 1 -name "*.app" | head -1)
fi

if [[ -z "$APP_PATH" || ! -d "$APP_PATH" ]]; then
  echo -e "${RED}Error: App not found in DMG.${NC}"
  hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null
  exit 1
fi

# Remove old version if exists
if [[ -d "$INSTALL_DIR/$APP_NAME.app" ]]; then
  echo -e "${DIM}> Removing previous version...${NC}"
  rm -rf "$INSTALL_DIR/$APP_NAME.app"
fi

cp -R "$APP_PATH" "$INSTALL_DIR/"

# Cleanup
hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null
rm -rf "$TEMP_DIR"

# Remove quarantine (unsigned app)
xattr -rd com.apple.quarantine "$INSTALL_DIR/$APP_NAME.app" 2>/dev/null || true

echo ""
echo -e "${GREEN}${BOLD}  ✓ Atlasiant Browser installed successfully!${NC}"
echo ""
echo -e "  ${DIM}Location:${NC} $INSTALL_DIR/$APP_NAME.app"
echo -e "  ${DIM}Launch:${NC}   open -a '$APP_NAME'"
echo ""
echo -e "${CYAN}  Privacy: Zero tracking. Zero cookies. Zero profiling.${NC}"
echo -e "${DIM}  Search:  https://sa.atlasiant.com${NC}"
echo ""

# Offer to launch
read -p "  Launch Atlasiant Browser now? [Y/n] " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]?$ ]]; then
  open -a "$APP_NAME"
  echo -e "  ${GREEN}Launching...${NC}"
fi
