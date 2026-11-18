#!/usr/bin/env node
/**
 * Minimal, dependency-free MCP server (stdio transport) for workout goals
 * and tracking. Stage 1: a local, single-user server backed by a JSON file,
 * for Claude Desktop / Claude Code / any MCP client.
 *
 *   node packages/workout-core/bin/mcp-server.ts
 *
 * Env:
 *   WORKOUT_DATA_FILE   path to the JSON store (default ~/.360fitness/workouts.json)
 *
 * Stage 2 (see docs/workouts/WORKOUT-PRD.md): the same toolDefinitions and
 * dispatch() behind a remote Streamable-HTTP MCP endpoint with Firebase Auth,
 * reading/writing users/{uid}/workouts via Firestore rules.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { commandFromTool, dispatch, toolDefinitions } from "../src/commands.ts";
import { emptyWorkoutState, parseWorkoutState } from "../src/engine.ts";
import { formatReply } from "../src/format.ts";
import type { WorkoutState } from "../src/types.ts";

const PROTOCOL_VERSION = "2025-06-18";
const file = process.env.WORKOUT_DATA_FILE || join(homedir(), ".360fitness", "workouts.json");

function load(): WorkoutState {
  try {
    return parseWorkoutState(readFileSync(file, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyWorkoutState();
    // Never overwrite a file we could not read.
    throw new Error(`Workout data at ${file} could not be opened: ${(error as Error).message}`);
  }
}

function save(state: WorkoutState) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  renameSync(tmp, file);
}

type Request = { jsonrpc: "2.0"; id?: string | number | null; method: string; params?: Record<string, unknown> };

function send(message: unknown) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function handle(req: Request): unknown | undefined {
  switch (req.method) {
    case "initialize":
      return {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "360fitness-workouts", version: "0.1.0" },
        instructions:
          "Log workouts, set weekly workout goals and check progress. Dates are local YYYY-MM-DD. Pass idempotencyKey when retrying log_workout.",
      };
    case "ping":
      return {};
    case "tools/list":
      return {
        tools: toolDefinitions.map(({ name, title, description, inputSchema, annotations }) => ({
          name,
          title,
          description,
          inputSchema,
          annotations,
        })),
      };
    case "tools/call": {
      const name = String(req.params?.name ?? "");
      const command = commandFromTool(name, req.params?.arguments as Record<string, unknown> | undefined);
      if (!command) throw Object.assign(new Error(`Unknown tool: ${name}`), { rpcCode: -32602 });
      const before = load();
      const out = dispatch(before, command, { source: "mcp" });
      if (out.result.ok && out.state !== before) save(out.state);
      return {
        content: [{ type: "text", text: formatReply(out.result) }],
        structuredContent: out.result,
        isError: !out.result.ok,
      };
    }
    default:
      if (req.method.startsWith("notifications/")) return undefined;
      throw Object.assign(new Error(`Method not found: ${req.method}`), { rpcCode: -32601 });
  }
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let req: Request;
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
    const code = (error as { rpcCode?: number }).rpcCode ?? -32603;
    send({ jsonrpc: "2.0", id: req.id, error: { code, message: (error as Error).message } });
  }
});
