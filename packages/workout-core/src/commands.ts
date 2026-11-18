/**
 * One command surface for every client.
 *
 *   app      → dispatch(state, { action: "log_workout", ... })
 *   MCP      → tools/call name = action, arguments = rest   (see toolDefinitions)
 *   iMessage → parseMessage(text) → dispatch → formatReply
 *
 * Commands are plain JSON, so they can be queued offline, sent over a
 * webhook, or emitted by an LLM using the JSON Schemas below.
 */
import {
  archiveGoal,
  deleteWorkout,
  localDate,
  logWorkout,
  recentSessions,
  setGoal,
  systemClock,
  updateWorkout,
  weekSummary,
  WorkoutError,
  type Clock,
  type SessionPatch,
} from "./engine.ts";
import {
  goalMetrics,
  intensities,
  workoutTypes,
  type GoalMetric,
  type Intensity,
  type Source,
  type WeekSummary,
  type WorkoutGoal,
  type WorkoutSession,
  type WorkoutState,
  type WorkoutType,
} from "./types.ts";

export type Command =
  | {
      action: "log_workout";
      type: WorkoutType;
      durationMin: number;
      date?: string;
      intensity?: Intensity;
      distanceKm?: number;
      title?: string;
      note?: string;
      status?: "completed" | "planned" | "skipped";
      skipReason?: string;
      exercises?: WorkoutSession["exercises"];
      idempotencyKey?: string;
    }
  | { action: "update_workout"; id: string; patch: SessionPatch }
  | { action: "delete_workout"; id: string }
  | { action: "undo_last" }
  | { action: "set_goal"; metric: GoalMetric; target: number; types?: WorkoutType[]; title?: string; id?: string }
  | { action: "archive_goal"; id: string }
  | { action: "list_goals" }
  | { action: "list_workouts"; limit?: number }
  | { action: "summary"; date?: string }
  | { action: "help" }
  | { action: "clarify"; question: string };

export type CommandResult =
  | { ok: true; action: "log_workout"; session: WorkoutSession; duplicate: boolean; summary: WeekSummary }
  | { ok: true; action: "update_workout"; session: WorkoutSession }
  | { ok: true; action: "delete_workout" | "undo_last"; deleted: WorkoutSession | null; summary: WeekSummary }
  | { ok: true; action: "set_goal"; goal: WorkoutGoal; replaced: boolean; summary: WeekSummary }
  | { ok: true; action: "archive_goal"; goalId: string }
  | { ok: true; action: "list_goals"; goals: WorkoutGoal[] }
  | { ok: true; action: "list_workouts"; sessions: WorkoutSession[] }
  | { ok: true; action: "summary"; summary: WeekSummary }
  | { ok: true; action: "help" }
  | { ok: true; action: "clarify"; question: string }
  | { ok: false; error: { code: "invalid" | "not_found"; message: string } };

export type DispatchContext = { source: Source; clock?: Clock };

/** Pure: returns the next state and a JSON-serialisable result. Never throws for user input. */
export function dispatch(
  state: WorkoutState,
  command: Command,
  context: DispatchContext = { source: "app" },
): { state: WorkoutState; result: CommandResult } {
  const clock = context.clock ?? systemClock;
  const today = localDate(clock.now());
  try {
    switch (command.action) {
      case "log_workout": {
        const { action: _a, ...input } = command;
        const out = logWorkout(state, { ...input, source: context.source }, clock);
        return {
          state: out.state,
          result: { ok: true, action: "log_workout", session: out.session, duplicate: out.duplicate, summary: weekSummary(out.state, out.session.date) },
        };
      }
      case "update_workout": {
        const out = updateWorkout(state, command.id, command.patch ?? {}, clock);
        return { state: out.state, result: { ok: true, action: "update_workout", session: out.session } };
      }
      case "delete_workout": {
        const deleted = state.sessions.find((s) => s.id === command.id) ?? null;
        const next = deleteWorkout(state, command.id);
        return { state: next, result: { ok: true, action: "delete_workout", deleted, summary: weekSummary(next, today) } };
      }
      case "undo_last": {
        // Only undo something this same surface created, so a chat "undo"
        // can never delete a workout logged in the app.
        const last = [...state.sessions]
          .filter((s) => s.source === context.source)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        const next = last ? deleteWorkout(state, last.id) : state;
        return { state: next, result: { ok: true, action: "undo_last", deleted: last ?? null, summary: weekSummary(next, today) } };
      }
      case "set_goal": {
        const { action: _a, ...input } = command;
        const out = setGoal(state, input, clock);
        return { state: out.state, result: { ok: true, action: "set_goal", goal: out.goal, replaced: out.replaced, summary: weekSummary(out.state, today) } };
      }
      case "archive_goal":
        return { state: archiveGoal(state, command.id, clock), result: { ok: true, action: "archive_goal", goalId: command.id } };
      case "list_goals":
        return { state, result: { ok: true, action: "list_goals", goals: state.goals.filter((g) => g.status === "active") } };
      case "list_workouts":
        return { state, result: { ok: true, action: "list_workouts", sessions: recentSessions(state, command.limit ?? 10) } };
      case "summary":
        return { state, result: { ok: true, action: "summary", summary: weekSummary(state, command.date ?? today) } };
      case "help":
        return { state, result: { ok: true, action: "help" } };
      case "clarify":
        return { state, result: { ok: true, action: "clarify", question: command.question } };
      default:
        return { state, result: { ok: false, error: { code: "invalid", message: "Unknown action." } } };
    }
  } catch (error) {
    if (error instanceof WorkoutError) return { state, result: { ok: false, error: { code: error.code, message: error.message } } };
    if (error instanceof Error) return { state, result: { ok: false, error: { code: "invalid", message: error.message } } };
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* JSON Schema tool definitions — MCP `tools/list` and LLM tool use.   */
/* ------------------------------------------------------------------ */

const date = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "Local date YYYY-MM-DD. Defaults to today." };
const types = { type: "string", enum: [...workoutTypes] };

export type ToolDefinition = {
  name: Exclude<Command["action"], "clarify" | "help">;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: boolean; destructiveHint: boolean; idempotentHint: boolean };
};

export const toolDefinitions: ToolDefinition[] = [
  {
    name: "log_workout",
    title: "Log a workout",
    description: "Record a completed, planned or skipped workout. Pass idempotencyKey to make retries safe.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["type", "durationMin"],
      properties: {
        type: types,
        durationMin: { type: "number", minimum: 0, maximum: 1440 },
        date,
        intensity: { type: "string", enum: [...intensities] },
        distanceKm: { type: "number", minimum: 0, maximum: 1000 },
        title: { type: "string", maxLength: 80 },
        note: { type: "string", maxLength: 500 },
        status: { type: "string", enum: ["completed", "planned", "skipped"] },
        skipReason: { type: "string", maxLength: 200 },
        exercises: {
          type: "array",
          maxItems: 40,
          items: {
            type: "object",
            required: ["name", "sets"],
            properties: {
              name: { type: "string", maxLength: 80 },
              sets: {
                type: "array",
                maxItems: 50,
                items: {
                  type: "object",
                  required: ["reps", "loadKg", "done"],
                  properties: { reps: { type: "integer", minimum: 0 }, loadKg: { type: ["number", "null"] }, done: { type: "boolean" } },
                },
              },
            },
          },
        },
        idempotencyKey: { type: "string", maxLength: 100 },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "update_workout",
    title: "Edit a workout",
    description: "Change fields of an existing workout by id.",
    inputSchema: {
      type: "object",
      required: ["id", "patch"],
      properties: { id: { type: "string" }, patch: { type: "object" } },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "delete_workout",
    title: "Delete a workout",
    description: "Delete one workout by id.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: "undo_last",
    title: "Undo last workout",
    description: "Delete the most recent workout created from this same client.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },
  {
    name: "set_goal",
    title: "Set a weekly workout goal",
    description: "Create or replace a weekly goal. A goal with the same metric and type scope replaces the old one.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["metric", "target"],
      properties: {
        metric: { type: "string", enum: [...goalMetrics], description: "sessions, minutes, distanceKm or activeDays per week" },
        target: { type: "number", exclusiveMinimum: 0 },
        types: { type: "array", items: types, description: "Limit the goal to these workout types." },
        title: { type: "string", maxLength: 80 },
        id: { type: "string", description: "Replace this goal id." },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "archive_goal",
    title: "Archive a goal",
    description: "Stop tracking a goal. History is kept.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "list_goals",
    title: "List active goals",
    description: "Return active weekly workout goals.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "list_workouts",
    title: "Recent workouts",
    description: "Return the most recent workouts, newest first.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 } } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "summary",
    title: "Weekly progress",
    description: "Totals for the week containing `date` plus progress toward every active goal and the goal streak.",
    inputSchema: { type: "object", properties: { date } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
];

/** Turn an MCP/LLM tool call into a Command. Unknown names return null. */
export function commandFromTool(name: string, args: Record<string, unknown> | undefined): Command | null {
  if (!toolDefinitions.some((t) => t.name === name)) return null;
  return { ...(args ?? {}), action: name } as Command;
}
