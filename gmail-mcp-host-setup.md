# OpenClaw Gmail (host MCP + IDLE notifier)

App-password Gmail for OpenClaw: host-side `gmail-mcp-imap` MCP, optional buffer MCP, and a long-running IMAP IDLE daemon that classifies new mail and can deliver to Telegram via the **gateway**.

**Q&A and edge cases:** [gmail-mcp-host-setup-companion.md](gmail-mcp-host-setup-companion.md)

**Using this repo:** clone it anywhere; `install.sh` resolves its own directory for `templates/`. You only need a standard OpenClaw home (default `~/.openclaw`).

```bash
git clone <your-fork-or-url> openclaw-gmail-installer
cd openclaw-gmail-installer
bash install.sh --email you@gmail.com
```

---

## 1) Architecture (current)

| Piece | Role |
|--------|------|
| `openclaw.json` → `mcp.servers.gmail` | Starts **`mcp-prefix-proxy.js`** (`gmail_` tool prefix) → **`mcp-gmail-imap-wrapper.js`** → `gmail-mcp-imap`. Main agent uses this for Gmail tools. |
| `mcp.servers.gmail_buffer` | Small MCP server for reading the JSON summary buffer (`gmail_read_buffer`). |
| `$OPENCLAW_HOME/services/gmail/gmail-idle-notifier.js` | Persistent IMAP IDLE + periodic catch-up; invokes the **gmail-priority** agent locally; optional gateway reminder + Telegram delivery through **main** via gateway. |
| `gmail.env` | All notifier/MCP-related env vars; systemd / LaunchAgent sources it. |
| `workspace-gmail-priority/` | Isolated workspace for priority-only prompts (no tools). |
| `gmail-priority-openclaw.json` | **Regenerated** when mail is processed: copy of main `openclaw.json` with a single isolated agent entry, tools locked down, **MCP servers cleared** for that subprocess. |

Design goals: no Google OAuth for this path; secrets stay on the host; IDLE is not inside the MCP process (MCP can restart; notifier stays up).

---

## 2) Prerequisites

- Node 18+, npm, OpenClaw CLI (`openclaw --version`).
- Gmail: 2FA + [App Password](https://myaccount.google.com/apppasswords), IMAP enabled (Settings → Forwarding and POP/IMAP).
- Workspace accounts may not allow app passwords — see the companion doc.

---

## 3) Recommended install (one shot)

From a clone of **this repository** (any directory):

```bash
bash install.sh --email you@gmail.com
```

With the default `--openclaw-home ~/.openclaw`, the same command is also:

```bash
bash ~/.openclaw/services/gmail-installer/install.sh --email you@gmail.com
```

The installer will:

- `npm install` into **`$OPENCLAW_HOME`** the packages `gmail-mcp-imap` and `imap`.
- Copy runtime scripts into **`$OPENCLAW_HOME/services/gmail/`** (not the home root): wrapper, prefix proxy, notifier, buffer MCP.
- Create **`gmail.env`** (mode 600) with the maintained layout: gateway-oriented notify, `GMAIL_IDLE_CATCHUP_INTERVAL_MS=120000`, log file path, etc.
- Seed filter / priority templates and the JSON buffer file if missing.
- Populate **`workspace-gmail-priority/`** bootstrap markdown and memory snapshot.
- Patch **`openclaw.json`**: ensure **`main`** agent, add/update **`gmail-priority`**, register **`gmail`** + **`gmail_buffer`** MCP servers (with **prefix proxy** args matching the live config).
- Enable autostart: **Linux** `systemd --user` unit, **macOS** LaunchAgent (notifier logs via `GMAIL_IDLE_LOG_FILE` — no shell redirect, avoids duplicate lines).

**Useful options:**

```text
--email ADDR
--app-password PASS | --password-file PATH
--agent-id ID                (default gmail-priority)
--priority-model MODEL       (default ollama/qwen3.6:latest)
--priority-memory-max-chars N
--catchup-interval-ms MS     (default 120000)
--catchup-timeout-ms MS      (optional; omit to use notifier built-in 90000 default)
--openclaw-home PATH
--no-autostart
--skip-openclaw-config
```

**Uninstall:** `bash uninstall.sh` (add `--remove-openclaw-config` / `--remove-secrets` if you want those gone too).

---

## 4) After install

1. **Restart the gateway** so MCP entries load: `openclaw gateway run --force`
2. **Telegram / channels:** configure in **`openclaw.json`** (`channels.telegram`, etc.). Delivery uses **`GMAIL_NOTIFY_DELIVER_AGENT_ID`** (default `main`) and gateway auth — ensure **`gateway.auth.token`** is set (or export **`OPENCLAW_GATEWAY_TOKEN`** for the notifier). The CLI has no `--token`; the notifier reads the token from env or config.
3. **`plugins.allow`:** an explicit non-empty allowlist can **disable** plugins you did not list (e.g. Telegram). Prefer default plugin behavior or list every plugin you need.
4. **Linux:** `systemctl --user status openclaw-gmail-idle.service` — `ExecStart` is `sh -lc` sourcing **`services/gmail/gmail.env`** then `node` the notifier (no `>> log` on the unit; logging is in-process).

---

## 5) `gmail.env` (notifier)

| Variable | Purpose |
|----------|---------|
| `OPENCLAW_*` | Home, workspace, main config path. |
| `GMAIL_EMAIL` / `GMAIL_APP_PASSWORD_FILE` | IMAP credentials. |
| `GMAIL_IDLE_FILTER_FILE` | Exclusion rules (reloads each batch). |
| `GMAIL_PRIORITY_FILE` | User priority policy markdown. |
| `GMAIL_SUMMARY_FILE` | JSON buffer path (`workspace/tmp/gmail-summary-buffer.json`). |
| `GMAIL_PRIORITY_WORKSPACE` / `GMAIL_PRIORITY_CONFIG_PATH` / `GMAIL_PRIORITY_MODEL` | Priority agent isolation + model. |
| `GMAIL_NOTIFY_*` | Agent id, deliver toggle, **`GMAIL_NOTIFY_DELIVER_VIA_GATEWAY`**, **`GMAIL_NOTIFY_DELIVER_AGENT_ID`**, optional `GMAIL_NOTIFY_TO`. |
| `GMAIL_IDLE_LOG_FILE` | Notifier log path. |
| `GMAIL_IDLE_CATCHUP_INTERVAL_MS` | Periodic UID catch-up (default in installer **120000**). |
| `GMAIL_IDLE_CATCHUP_TIMEOUT_MS` | If IMAP commands stall, abort and recycle connection (notifier default **90000** if unset). |
| `GMAIL_PRIORITY_GATEWAY_REMINDER` | Queue a gateway system event after evaluation. |

Edit **`services/gmail/gmail.env`**, then `systemctl --user restart openclaw-gmail-idle` (Linux) or restart the LaunchAgent.

---

## 6) `openclaw.json` MCP entries (shape)

The installer writes entries equivalent to:

```json
"gmail": {
  "command": "node",
  "args": [
    "/ABSOLUTE/.openclaw/services/gmail/mcp-prefix-proxy.js",
    "gmail_",
    "--",
    "node",
    "/ABSOLUTE/.openclaw/services/gmail/mcp-gmail-imap-wrapper.js"
  ],
  "env": {
    "OPENCLAW_HOME": "/ABSOLUTE/.openclaw",
    "GMAIL_EMAIL": "you@gmail.com",
    "GMAIL_APP_PASSWORD_FILE": "/ABSOLUTE/.openclaw/secrets/gmail_app_password.txt",
    "GMAIL_ALLOW_SEND_EMAIL": "false"
  }
},
"gmail_buffer": {
  "command": "node",
  "args": ["/ABSOLUTE/.openclaw/services/gmail/gmail-buffer-mcp.js"],
  "env": {
    "OPENCLAW_HOME": "/ABSOLUTE/.openclaw",
    "OPENCLAW_WORKSPACE": "/ABSOLUTE/.openclaw/workspace",
    "GMAIL_SUMMARY_FILE": "/ABSOLUTE/.openclaw/workspace/tmp/gmail-summary-buffer.json"
  }
}
```

Validate: `openclaw config validate` and `openclaw config get mcp.servers.gmail`.

---

## 7) Operations

```bash
# Logs (path from GMAIL_IDLE_LOG_FILE)
tail -f ~/.openclaw/gmail-idle-notifier.log

# Linux service
systemctl --user restart openclaw-gmail-idle.service

# Manual test (no install): source gmail.env then node (stop with Ctrl+C)
set -a; . ~/.openclaw/services/gmail/gmail.env; set +a
node ~/.openclaw/services/gmail/gmail-idle-notifier.js
```

Wrapper smoke test (should print MCP startup on stdio):

```bash
OPENCLAW_HOME="$HOME/.openclaw" \
GMAIL_EMAIL="you@gmail.com" \
GMAIL_APP_PASSWORD_FILE="$HOME/.openclaw/secrets/gmail_app_password.txt" \
node "$HOME/.openclaw/services/gmail/mcp-gmail-imap-wrapper.js"
```

---

## 8) Manual / advanced

Templates live in **`templates/`** in this repository. The supported path is **`install.sh`** so copies, npm deps, agent list patch, and autostart stay consistent. If you hand-edit only the wrapper in `~/.openclaw/`, MCP paths in `openclaw.json` will not match this scheme.

---

## 9) Remove / cleanup

1. `bash uninstall.sh --remove-openclaw-config` (optional `--remove-secrets`).
2. Remove filter / priority / buffer files if you no longer want them.
3. `openclaw gateway run --force`

For historical Himalaya-in-sandbox notes, remove old binds/env from **`openclaw.json`** if you still have them.
