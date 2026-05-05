# Gmail MCP Setup — Companion Q&A

**Main guide:** [gmail-mcp-host-setup.md](gmail-mcp-host-setup.md)  
**Preferred install:** from this repo’s root, `bash install.sh --email you@gmail.com` (see README).

---

## Before You Start

**Q: What do I need installed?**  
A: Node (v18+), npm, OpenClaw CLI. Run `node --version`, `npm --version`, `openclaw --version`.

**Q: Where is everything on disk?**  
A: **This repo** only contains installer scripts and templates. After install: runtime scripts under **`~/.openclaw/services/gmail/`**, config **`~/.openclaw/openclaw.json`**, secrets e.g. **`~/.openclaw/secrets/gmail_app_password.txt`**, notifier env **`~/.openclaw/services/gmail/gmail.env`**.

**Q: Is `gmail-mcp-imap` the right package?**  
A: Run `npm info gmail-mcp-imap`. See https://www.npmjs.com/package/gmail-mcp-imap — the installer installs it under **`$OPENCLAW_HOME`**.

---

## Google Setup

(Same as before: 2FA, app password, IMAP enabled. Workspace accounts may lack app passwords — admin/OAuth may be required.)

---

## Wrapper and MCP path

**Q: Where is the wrapper?**  
A: **`~/.openclaw/services/gmail/mcp-gmail-imap-wrapper.js`**. OpenClaw should **not** point at a stray copy under `~/.openclaw/mcp-gmail-imap-wrapper.js` unless you maintain that path yourself.

**Q: What is `mcp-prefix-proxy.js`?**  
A: Prefixes Gmail MCP tool names with `gmail_` so they do not collide with other tools. `openclaw.json` lists it as the **`gmail`** MCP **command** with args: `prefix`, `gmail_`, `--`, `node`, wrapper.

**Q: Test the wrapper manually**  
A:
```bash
OPENCLAW_HOME="$HOME/.openclaw" \
GMAIL_EMAIL="you@gmail.com" \
GMAIL_APP_PASSWORD_FILE="$HOME/.openclaw/secrets/gmail_app_password.txt" \
node "$HOME/.openclaw/services/gmail/mcp-gmail-imap-wrapper.js"
```
Expect MCP stdio startup text; Ctrl+C to stop.

---

## Notifier and Telegram

**Q: How does Telegram delivery work?**  
A: Evaluation runs the **gmail-priority** agent (local subprocess). If the decision is `notify`, delivery targets **`GMAIL_NOTIFY_DELIVER_AGENT_ID`** (default **`main`**) via **`openclaw agent`** against the **gateway** when **`GMAIL_NOTIFY_DELIVER_VIA_GATEWAY=true`**. The CLI does not take `--token`; set **`OPENCLAW_GATEWAY_TOKEN`** or **`gateway.auth.token`** in **`openclaw.json`**.

**Q: `Outbound not configured for channel: telegram`?**  
A: Configure **`channels.telegram`** in **`openclaw.json`**. Also check **`plugins`** — a restrictive **`plugins.allow`** list can disable the Telegram plugin if Telegram is not included.

**Q: Duplicate lines in the notifier log?**  
A: Do not add shell `>> log 2>&1` on **`ExecStart`** when the notifier already sets **`GMAIL_IDLE_LOG_FILE`** (the stock **systemd** unit and LaunchAgent follow this).

---

## Platform paths

**Q: macOS paths?**  
A: `/Users/USERNAME/.openclaw/...`

**Q: WSL / Linux?**  
A: `/home/USERNAME/.openclaw/...`

---

## Configuring OpenClaw

**Q: What does `openclaw config validate` do?**  
A: JSON / schema checks for **`openclaw.json`** — not your Gmail password.

**Q: After changing MCP servers?**  
A: `openclaw gateway run --force`

---

## Uninstalling

**Q: Clean removal?**  
A: From this repo (or with absolute path to `uninstall.sh`).
```bash
bash uninstall.sh --remove-openclaw-config
# optional: --remove-secrets
openclaw gateway run --force
```
User-edited files like **`gmail-idle-filter.txt`** and **`gmail-email-priority.md`** are left unless you delete them.

---

## Still stuck?

1. `tail -n 80 ~/.openclaw/gmail-idle-notifier.log`
2. `openclaw logs --plain --limit 100`
3. `openclaw config get mcp.servers.gmail`
