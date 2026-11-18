#!/usr/bin/env node
/**
 * 360fitness health MCP server — stdio transport, zero dependencies.
 *
 *   node packages/health-mcp/bin/server.ts
 *
 * Env: HEALTH_DATA_FILE (default ~/.360fitness/health.json)
 *
 * Why MCP first: the person's own assistant (Claude, etc.) supplies the
 * conversation and the model, so we ship accurate tools and data rules
 * without paying for or operating a chat model. See docs/business/PRODUCT-PLAN.md.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { callTool, emptyHealthState, healthToolDefinitions, parseHealthState, SAFETY_INSTRUCTIONS, type HealthState } from "../src/health.ts";

const file = process.env.HEALTH_DATA_FILE || join(homedir(), ".360fitness", "health.json");

function load(): HealthState {
  try {
    return parseHealthState(readFileSync(file, "utf8"));
  } catch (error) {
    if ((error as { code?: string }).code === "ENOENT") return emptyHealthState();
    throw new Error(`Health data at ${file} could not be opened: ${(error as Error).message}`);
  }
}

function save(state: HealthState) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  renameSync(tmp, file);
}

const send = (m: unknown) => process.stdout.write(`${JSON.stringify(m)}\n`);
type Req = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };
const rpcError = (code: number, message: string) => Object.assign(new Error(message), { rpcCode: code });

function handle(req: Req): unknown {
  switch (req.method) {
    case "initialize":
      return {
        protocolVersion: "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "360fitness-health", version: "0.1.0" },
        instructions: SAFETY_INSTRUCTIONS,
      };
    case "ping":
      return {};
    case "tools/list":
      return { tools: healthToolDefinitions.map(({ name, title, description, inputSchema, annotations }) => ({ name, title, description, inputSchema, annotations })) };
    case "tools/call": {
      const before = load();
      const out = callTool(before, String(req.params?.name ?? ""), req.params?.arguments as Record<string, unknown> | undefined, "mcp");
      if (!out) throw rpcError(-32602, `Unknown tool: ${String(req.params?.name)}`);
      if (!out.isError && JSON.stringify(out.state) !== JSON.stringify(before)) save(out.state);
      return { content: [{ type: "text", text: out.text }], structuredContent: out.structured, isError: out.isError };
    }
    default:
      if (req.method.startsWith("notifications/")) return undefined;
      throw rpcError(-32601, `Method not found: ${req.method}`);
  }
}

createInterface({ input: process.stdin }).on("line", (line) => {
  if (!line.trim()) return;
  let req: Req;
  try {
    req = JSON.parse(line);
  } catch {
    send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    return;
  }
  try {
    const result = handle(req);
    if (req.id !== undefined && req.id !== null && result !== undefined) send({ jsonrpc: "2.0", id: req.id, result });
  } catch (error) {
    if (req.id === undefined) return;
    send({ jsonrpc: "2.0", id: req.id, error: { code: (error as { rpcCode?: number }).rpcCode ?? -32603, message: (error as Error).message } });
  }
});
