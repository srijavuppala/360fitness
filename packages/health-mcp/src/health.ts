/**
 * One assistant surface over every dependency-free core: workouts and
 * glucose today, meals next. Used by the stdio MCP server and by messaging
 * webhooks, so Claude (or any MCP client) and iMessage behave identically.
 */
import {
  dispatchGlucose,
  emptyGlucoseState,
  formatGlucoseReply,
  glucoseCommandFromTool,
  glucoseToolDefinitions,
  parseGlucoseMessage,
  parseGlucoseState,
  type GlucoseState,
} from "../../glucose-core/src/index.ts";
import {
  commandFromTool,
  dispatch,
  emptyWorkoutState,
  formatReply,
  handleMessage as handleWorkoutMessage,
  helpText as workoutHelp,
  parseWorkoutState,
  toolDefinitions as workoutToolDefinitions,
  type Clock,
  type WorkoutState,
} from "../../workout-core/src/index.ts";

export type HealthState = { version: 1; workouts: WorkoutState; glucose: GlucoseState };
export type Source = "mcp" | "message" | "app" | "web";

export function emptyHealthState(): HealthState {
  return { version: 1, workouts: emptyWorkoutState(), glucose: emptyGlucoseState() };
}

export function parseHealthState(raw: string | unknown): HealthState {
  const value = (typeof raw === "string" ? JSON.parse(raw) : raw) as Partial<HealthState>;
  if (!value || value.version !== 1) throw new Error("Health data has an unknown version.");
  return {
    version: 1,
    workouts: value.workouts ? parseWorkoutState(value.workouts) : emptyWorkoutState(),
    glucose: value.glucose ? parseGlucoseState(value.glucose) : emptyGlucoseState(),
  };
}

export const SAFETY_INSTRUCTIONS =
  "You help a person log meals, workouts and self-measured glucose and understand their own data. " +
  "Never diagnose, never suggest starting, stopping or changing any medication or insulin dose, and never present an estimate as a measurement. " +
  "If a tool returns a safety notice, show it verbatim. For urgent symptoms, tell the person to contact their care team or emergency services. " +
  "Days without records are gaps, not zero.";

export const healthToolDefinitions = [...workoutToolDefinitions, ...glucoseToolDefinitions];

export type ToolOutcome = { state: HealthState; text: string; structured: unknown; isError: boolean };

export function callTool(state: HealthState, name: string, args: Record<string, unknown> | undefined, source: Source, clock?: Clock): ToolOutcome | null {
  const g = glucoseCommandFromTool(name, args);
  if (g) {
    const out = dispatchGlucose(state.glucose, g, { source, ...(clock ? { clock } : {}) });
    return { state: out.result.ok ? { ...state, glucose: out.state } : state, text: formatGlucoseReply(out.result), structured: out.result, isError: !out.result.ok };
  }
  const w = commandFromTool(name, args);
  if (w) {
    const out = dispatch(state.workouts, w, { source, ...(clock ? { clock } : {}) });
    return { state: out.result.ok ? { ...state, workouts: out.state } : state, text: formatReply(out.result), structured: out.result, isError: !out.result.ok };
  }
  return null;
}

export const healthHelp = `${workoutHelp}\nGlucose: "glucose 142 after lunch", "bg 6.2 fasting", "glucose summary"`;

/** Route one chat message to the right core. `messageId` makes webhook redelivery safe. */
export function handleHealthMessage(
  state: HealthState,
  text: string,
  options: { messageId?: string; clock?: Clock } = {},
): { state: HealthState; reply: string } {
  if (/^(help|\?|commands)/i.test(text.trim())) return { state, reply: healthHelp };
  const g = parseGlucoseMessage(text);
  if (g) {
    if (g.action === "log_glucose" && options.messageId) g.idempotencyKey = `msg:${options.messageId}`;
    const out = dispatchGlucose(state.glucose, g, { source: "message", ...(options.clock ? { clock: options.clock } : {}) });
    return { state: { ...state, glucose: out.state }, reply: formatGlucoseReply(out.result) };
  }
  const out = handleWorkoutMessage(state.workouts, text, options);
  const reply = out.result ? out.reply : out.reply.replace(workoutHelp, healthHelp);
  return { state: { ...state, workouts: out.state }, reply };
}
