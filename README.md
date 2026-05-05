# OpenClaw Gmail installer

Install script and templates for **host-side Gmail MCP** (`gmail-mcp-imap`), a **buffer MCP** for email summaries, and an **IMAP IDLE notifier** that runs a dedicated OpenClaw agent for priority classification and optional Telegram delivery via the gateway.

## Docs


| File                                                                   | Purpose                     |
| ---------------------------------------------------------------------- | --------------------------- |
| [gmail-mcp-host-setup.md](gmail-mcp-host-setup.md)                     | Main setup and architecture |
| [gmail-mcp-host-setup-companion.md](gmail-mcp-host-setup-companion.md) | Q&A, troubleshooting        |


## Quick start

1. Clone this repository (any path):
  ```bash
   git clone https://github.com/YOUR_USER/openclaw-gmail-installer.git
   cd openclaw-gmail-installer
  ```
2. Run the installer (defaults to `OPENCLAW_HOME=$HOME/.openclaw`):
  ```bash
   bash install.sh --email you@gmail.com
  ```
3. Restart the OpenClaw gateway: `openclaw gateway run --force`
4. On Linux, enable/check the user service: `systemctl --user status openclaw-gmail-idle.service`

Full options: `bash install.sh --help`

## Repo layout

```text
install.sh          # Installs deps, copies runtime files, patches openclaw.json, autostart
uninstall.sh        # Removes service, optional MCP + secret cleanup
templates/          # Source files copied into $OPENCLAW_HOME/services/gmail/
```

Runtime files land under `**$OPENCLAW_HOME/services/gmail/**` after install; this repo stays a **source-only** package you can version control without secrets.

## Publishing your fork

This directory is its own git repository (`git init` is already done if you used the prepared tree).

If **`gmail-installer/`** is inside another repo (e.g. dotfiles), either:

- add it to the parent **`.gitignore`** and clone/publish this folder separately, or  
- use a **submodule** pointed at your GitHub repo.

Typical first push:

```bash
git add .
git commit -m "Initial commit: OpenClaw Gmail installer"
# Create an empty repo on GitHub, then:
git remote add origin https://github.com/YOUR_USER/openclaw-gmail-installer.git
git push -u origin main
```

## License

See [LICENSE](LICENSE).