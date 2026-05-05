#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const HOME = process.env.HOME || process.env.USERPROFILE || "";
const OPENCLAW_HOME = process.env.OPENCLAW_HOME || path.join(HOME, ".openclaw");
const OPENCLAW_WORKSPACE = process.env.OPENCLAW_WORKSPACE || path.join(OPENCLAW_HOME, "workspace");
const DEFAULT_SUMMARY_FILE = path.join(OPENCLAW_WORKSPACE, "tmp", "gmail-summary-buffer.json");

function readBuffer(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { version: 1, records: [] };
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (Array.isArray(parsed)) return { version: 1, records: parsed };
    if (parsed && Array.isArray(parsed.records)) return { version: parsed.version || 1, records: parsed.records };
  } catch {
    return { version: 1, records: [] };
  }
  return { version: 1, records: [] };
}

function writeResponse(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function writeError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}

function readGmailBuffer(args = {}) {
  const filePath = process.env.GMAIL_SUMMARY_FILE || DEFAULT_SUMMARY_FILE;
  const limit = Math.max(1, Math.min(200, Number(args.limit || 200)));
  const buffer = readBuffer(filePath);
  const records = buffer.records.slice(-limit);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          file: filePath,
          count: records.length,
          maxRecords: 200,
          records,
        }, null, 2),
      },
    ],
  };
}

function handleMessage(msg) {
  if (msg.method === "initialize") {
    writeResponse(msg.id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "openclaw-gmail-buffer", version: "1.0.0" },
    });
    return;
  }

  if (msg.method === "notifications/initialized") return;

  if (msg.method === "tools/list") {
    writeResponse(msg.id, {
      tools: [
        {
          name: "gmail_read_buffer",
          description: "Read the Gmail medium/low-priority summary buffer records.",
          inputSchema: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Maximum number of newest records to return. Default 200, max 200.",
              },
            },
          },
        },
      ],
    });
    return;
  }

  if (msg.method === "tools/call") {
    if (msg.params?.name !== "gmail_read_buffer") {
      writeError(msg.id, -32601, `unknown tool: ${msg.params?.name || ""}`);
      return;
    }
    writeResponse(msg.id, readGmailBuffer(msg.params?.arguments || {}));
    return;
  }

  if (msg.id != null) writeError(msg.id, -32601, `unknown method: ${msg.method}`);
}

let inputBuffer = "";
process.stdin.on("data", (chunk) => {
  inputBuffer += chunk.toString();
  let newlineIndex;
  while ((newlineIndex = inputBuffer.indexOf("\n")) !== -1) {
    const line = inputBuffer.slice(0, newlineIndex);
    inputBuffer = inputBuffer.slice(newlineIndex + 1);
    if (!line.trim()) continue;
    try {
      handleMessage(JSON.parse(line));
    } catch (err) {
      writeError(null, -32700, `parse error: ${err.message}`);
    }
  }
});
