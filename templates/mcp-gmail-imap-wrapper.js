#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const HOME = process.env.HOME || process.env.USERPROFILE || "";
const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(HOME, ".openclaw");
const DEFAULT_PASSWORD_FILE = path.join(OPENCLAW_HOME, "secrets", "gmail_app_password.txt");
const MCP_ENTRY = process.env.GMAIL_MCP_ENTRY || path.join(OPENCLAW_HOME, "node_modules", "gmail-mcp-imap", "build", "index.js");
const HKT_OFFSET_MINUTES = 8 * 60;

function readTrimmed(filePath) {
  return fs.readFileSync(filePath, "utf8").trim();
}

function getEmail() {
  const email = process.env.GMAIL_EMAIL;
  if (!email || !email.includes("@")) {
    throw new Error("missing or invalid GMAIL_EMAIL");
  }
  return email;
}

function getAppPassword() {
  if (process.env.GMAIL_APP_PASSWORD && process.env.GMAIL_APP_PASSWORD.trim()) {
    return process.env.GMAIL_APP_PASSWORD.trim();
  }

  const passwordFile = process.env.GMAIL_APP_PASSWORD_FILE || DEFAULT_PASSWORD_FILE;
  if (!fs.existsSync(passwordFile)) {
    throw new Error(`app password file not found: ${passwordFile}`);
  }

  const value = readTrimmed(passwordFile);
  if (!value) {
    throw new Error(`app password file is empty: ${passwordFile}`);
  }
  return value;
}

function toHktIsoString(input) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;

  const shifted = new Date(date.getTime() + HKT_OFFSET_MINUTES * 60 * 1000);
  const yyyy = shifted.getUTCFullYear();
  const mm = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getUTCDate()).padStart(2, "0");
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mi = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}+08:00`;
}

function shouldConvertKey(key) {
  return /(date|time|timestamp|received|sent|created|updated)$/i.test(key);
}

function isUtcDateString(input) {
  const s = String(input).trim();
  if (!s) return false;
  if (/Z$/i.test(s)) return true;
  if (/[+-]00:00$/i.test(s)) return true;
  if (/[+-]0000$/i.test(s)) return true;
  if (/\bUTC\b/i.test(s)) return true;
  if (/\bGMT\b/i.test(s) && !/\bGMT[+-]\d{1,2}/i.test(s)) return true;
  return false;
}

function toHktIfUtcString(input) {
  if (!isUtcDateString(input)) return null;
  return toHktIsoString(input);
}

function replaceUtcDateTokens(text) {
  const patterns = [
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]00:00|[+-]0000)\b/g,
    /\b\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]00:00|[+-]0000)\b/g,
    /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),? \d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} (?:UTC|GMT|[+-]0000)\b/g,
  ];

  let out = text;
  for (const regex of patterns) {
    out = out.replace(regex, (match) => toHktIfUtcString(match) || match);
  }
  return out;
}

function convertDateLikeValues(value, parentKey = "") {
  if (Array.isArray(value)) {
    return value.map((item) => convertDateLikeValues(item, parentKey));
  }

  if (value && typeof value === "object") {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      out[key] = convertDateLikeValues(child, key);
    }
    return out;
  }

  if (typeof value === "string") {
    if (shouldConvertKey(parentKey)) {
      return toHktIfUtcString(value) || value;
    }
    return replaceUtcDateTokens(value);
  }

  return value;
}

const BLOCKED_ENV_KEYS = new Set([
  "BASH_ENV",
  "ENV",
  "NODE_OPTIONS",
  "NPM_CONFIG_PREFIX",
  "NPM_CONFIG_USERCONFIG",
  "YARN_IGNORE_PATH",
]);
const BLOCKED_ENV_PREFIXES = [
  "GIT_",
  "HG",
  "MAKE",
  "RUSTC_",
  "CARGO_",
];

function sanitizedEnv(extra = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (BLOCKED_ENV_KEYS.has(key)) continue;
    if (BLOCKED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
    env[key] = value;
  }
  return { ...env, ...extra };
}

function maybeConvertRpcMessage(line) {
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return line;
  }

  if (!msg || typeof msg !== "object") return line;
  if (!msg.result || typeof msg.result !== "object") return line;

  msg.result = convertDateLikeValues(msg.result);
  return JSON.stringify(msg);
}

function main() {
  const email = getEmail();
  const appPassword = getAppPassword();

  const child = spawn(process.execPath, [MCP_ENTRY], {
    stdio: ["pipe", "pipe", "inherit"],
    env: sanitizedEnv({
      GMAIL_EMAIL: email,
      GMAIL_APP_PASSWORD: appPassword,
    }),
  });

  process.stdin.on("data", (data) => {
    child.stdin.write(data);
  });

  process.stdin.on("end", () => {
    child.stdin.end();
  });

  let stdoutBuffer = "";
  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString();
    let newlineIndex;
    while ((newlineIndex = stdoutBuffer.indexOf("\n")) !== -1) {
      const line = stdoutBuffer.slice(0, newlineIndex);
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
      const out = maybeConvertRpcMessage(line);
      process.stdout.write(out + "\n");
    }
  });

  child.stdout.on("end", () => {
    if (!stdoutBuffer) return;
    const out = maybeConvertRpcMessage(stdoutBuffer);
    process.stdout.write(out);
    stdoutBuffer = "";
  });

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    process.exit(code ?? 1);
  });
}

try {
  main();
} catch (err) {
  process.stderr.write(`[mcp-gmail-imap-wrapper] ${err.message}\n`);
  process.exit(1);
}
