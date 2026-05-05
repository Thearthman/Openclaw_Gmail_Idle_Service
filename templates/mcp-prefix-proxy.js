#!/usr/bin/env node

const { spawn } = require("child_process");

const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
if (sep === -1 || sep === 0 || sep === argv.length - 1) {
  console.error("Usage: mcp-prefix-proxy.js <prefix> -- <command> [args...]");
  process.exit(1);
}

const prefix = argv[0];
const cmd = argv[sep + 1];
const cmdArgs = argv.slice(sep + 2);
const SEND_TOOL_NAMES = new Set(["send_email", "reply_to_email"]);

if (!prefix.endsWith("_")) {
  console.error('mcp-prefix-proxy: prefix should end with "_"');
}

const child = spawn(cmd, cmdArgs, { stdio: ["pipe", "pipe", "inherit"] });

function isEnabled(name, defaultValue) {
  const raw = process.env[name];
  if (raw == null || raw === "") return defaultValue;
  return !/^(0|false|no|off)$/i.test(raw.trim());
}

function prefixToolName(name) {
  if (typeof name !== "string" || !name) return name;
  return name.startsWith(prefix) ? name : prefix + name;
}

function stripToolPrefix(name) {
  if (typeof name !== "string" || !name) return name;
  return name.startsWith(prefix) ? name.slice(prefix.length) : name;
}

function canExposeTool(name) {
  if (isEnabled("GMAIL_ALLOW_SEND_EMAIL", false)) return true;
  return !SEND_TOOL_NAMES.has(stripToolPrefix(name));
}

function transformToolsList(msg) {
  if (!msg || !msg.result || !Array.isArray(msg.result.tools)) return msg;
  const tools = msg.result.tools
    .filter((tool) => canExposeTool(tool.name))
    .map((tool) => ({ ...tool, name: prefixToolName(tool.name) }));
  return { ...msg, result: { ...msg.result, tools } };
}

function toolBlockedError(id, name) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id,
    error: {
      code: -32603,
      message: `${prefixToolName(name)} is disabled by GMAIL_ALLOW_SEND_EMAIL=false`,
    },
  });
}

let outBuf = "";
child.stdout.on("data", (data) => {
  outBuf += data.toString();
  let nl;
  while ((nl = outBuf.indexOf("\n")) !== -1) {
    const line = outBuf.slice(0, nl);
    outBuf = outBuf.slice(nl + 1);
    if (!line.trim()) continue;
    let toWrite = line;
    try {
      toWrite = JSON.stringify(transformToolsList(JSON.parse(line)));
    } catch {
      // passthrough non-JSON lines
    }
    process.stdout.write(toWrite + "\n");
  }
});

let inBuf = "";
process.stdin.on("data", (data) => {
  inBuf += data.toString();
  let nl;
  while ((nl = inBuf.indexOf("\n")) !== -1) {
    const line = inBuf.slice(0, nl);
    inBuf = inBuf.slice(nl + 1);
    if (!line.trim()) continue;
    let toChild = line;
    try {
      const msg = JSON.parse(line);
      if (msg.method === "tools/call" && msg.params && typeof msg.params.name === "string") {
        const toolName = stripToolPrefix(msg.params.name);
        if (!canExposeTool(toolName)) {
          process.stdout.write(toolBlockedError(msg.id, toolName) + "\n");
          continue;
        }
        msg.params = { ...msg.params, name: toolName };
        toChild = JSON.stringify(msg);
      }
    } catch {
      // passthrough
    }
    child.stdin.write(toChild + "\n");
  }
});

process.stdin.on("end", () => {
  child.stdin.end();
});

child.on("close", (code) => {
  process.exit(code ?? 0);
});

child.on("error", (err) => {
  console.error("mcp-prefix-proxy: failed to spawn child:", err);
  process.exit(1);
});
