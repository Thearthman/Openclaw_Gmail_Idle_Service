#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
SERVICE_DIR="$OPENCLAW_HOME/services/gmail"
REMOVE_CONFIG="0"
REMOVE_SECRETS="0"

usage() {
  cat <<'EOF'
Usage:
  bash uninstall.sh [options]

Options:
  --remove-openclaw-config   Remove gmail MCP server from openclaw.json.
  --remove-secrets           Remove Gmail app password file.
  -h, --help                 Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --remove-openclaw-config) REMOVE_CONFIG="1"; shift ;;
    --remove-secrets) REMOVE_SECRETS="1"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if command -v systemctl >/dev/null 2>&1; then
  systemctl --user disable --now openclaw-gmail-idle.service >/dev/null 2>&1 || true
  rm -f "$HOME/.config/systemd/user/openclaw-gmail-idle.service"
  systemctl --user daemon-reload >/dev/null 2>&1 || true
fi

if command -v launchctl >/dev/null 2>&1; then
  PLIST="$HOME/Library/LaunchAgents/com.openclaw.gmail-idle.plist"
  launchctl unload "$PLIST" >/dev/null 2>&1 || true
  rm -f "$PLIST"
fi

rm -rf "$SERVICE_DIR"

if [[ "$REMOVE_CONFIG" == "1" ]]; then
  CONFIG_FILE="$OPENCLAW_HOME/openclaw.json"
  if [[ -f "$CONFIG_FILE" ]]; then
    cp "$CONFIG_FILE" "$CONFIG_FILE.bak.gmail-uninstall.$(date +%Y%m%d%H%M%S)"
    node - "$CONFIG_FILE" <<'NODE'
const fs = require("fs");
const [configFile] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(configFile, "utf8"));
if (config.mcp?.servers?.gmail) delete config.mcp.servers.gmail;
if (config.mcp?.servers?.gmail_buffer) delete config.mcp.servers.gmail_buffer;
fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + "\n");
NODE
  fi
fi

if [[ "$REMOVE_SECRETS" == "1" ]]; then
  rm -f "$OPENCLAW_HOME/secrets/gmail_app_password.txt"
fi

echo "Uninstalled OpenClaw Gmail service runtime."
echo "User files kept unless explicitly removed:"
echo "  $OPENCLAW_HOME/gmail-idle-filter.txt"
echo "  $OPENCLAW_HOME/gmail-email-priority.md"
echo "  $OPENCLAW_HOME/workspace/tmp/gmail-summary-buffer.json"
