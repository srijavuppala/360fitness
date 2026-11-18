import {
  addReading,
  contexts,
  deleteReading,
  formatGlucose,
  GlucoseError,
  localDateOf,
  mealResponses,
  setTarget,
  summarize,
  systemClock,
  type Clock,
  type GlucoseReading,
  type GlucoseState,
  type GlucoseSummary,
  type MealResponse,
  type ReadingContext,
  type ReadingSource,
  type Unit,
} from "./glucose.ts";

export type GlucoseCommand =
  | {
      action: "log_glucose";
      value: number;
      unit?: Unit;
      context?: ReadingContext;
      takenAt?: string;
      mealId?: string;
      note?: string;
      idempotencyKey?: string;
    }
  | { action: "delete_glucose"; id: string }
  | { action: "undo_glucose" }
  | { action: "glucose_summary"; days?: number }
  | { action: "list_glucose"; limit?: number }
  | { action: "set_glucose_target"; low: number; high: number; unit?: Unit; source?: "CONSENSUS_DEFAULT" | "CLINICIAN_PROVIDED" }
  | { action: "meal_glucose_responses" };

export type GlucoseResult =
  | { ok: true; action: "log_glucose"; reading: GlucoseReading; duplicate: boolean; notice: string | null; unit: Unit }
  | { ok: true; action: "delete_glucose" | "undo_glucose"; deleted: GlucoseReading | null; unit: Unit }
  | { ok: true; action: "glucose_summary"; summary: GlucoseSummary; unit: Unit }
  | { ok: true; action: "list_glucose"; readings: GlucoseReading[]; unit: Unit }
  | { ok: true; action: "set_glucose_target"; low: number; high: number; unit: Unit }
  | { ok: true; action: "meal_glucose_responses"; responses: MealResponse[]; unit: Unit }
  | { ok: false; error: { code: "invalid" | "not_found"; message: string } };

export function dispatchGlucose(
  state: GlucoseState,
  command: GlucoseCommand,
  context: { source: ReadingSource; clock?: Clock } = { source: "app" },
): { state: GlucoseState; result: GlucoseResult } {
  const clock = context.clock ?? systemClock;
  const unit = state.unit;
  try {
    switch (command.action) {
      case "log_glucose": {
        const { action: _a, ...input } = command;
        const out = addReading(state, { ...input, source: context.source }, clock);
        return { state: out.state, result: { ok: true, action: "log_glucose", reading: out.reading, duplicate: out.duplicate, notice: out.notice, unit } };
      }
      case "delete_glucose": {
        const deleted = state.readings.find((r) => r.id === command.id) ?? null;
        return { state: deleteReading(state, command.id), result: { ok: true, action: "delete_glucose", deleted, unit } };
      }
      case "undo_glucose": {
        const last = [...state.readings].filter((r) => r.source === context.source).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        return { state: last ? deleteReading(state, last.id) : state, result: { ok: true, action: "undo_glucose", deleted: last ?? null, unit } };
      }
      case "glucose_summary": {
        const days = Math.max(1, Math.min(90, Math.round(command.days ?? 14)));
        return { state, result: { ok: true, action: "glucose_summary", summary: summarize(state, days, localDateOf(clock.now())), unit } };
      }
      case "list_glucose": {
        const limit = Math.max(1, Math.min(100, command.limit ?? 10));
        const readings = [...state.readings].sort((a, b) => b.takenAt.localeCompare(a.takenAt)).slice(0, limit);
        return { state, result: { ok: true, action: "list_glucose", readings, unit } };
      }
      case "set_glucose_target": {
        const u = command.unit ?? unit;
        const toMg = (v: number) => (u === "mg/dL" ? v : v * 18.0182);
        const next = setTarget(state, toMg(command.low), toMg(command.high), command.source ?? "CLINICIAN_PROVIDED");
        return { state: next, result: { ok: true, action: "set_glucose_target", low: next.target.lowMgdl, high: next.target.highMgdl, unit } };
      }
      case "meal_glucose_responses":
        return { state, result: { ok: true, action: "meal_glucose_responses", responses: mealResponses(state), unit } };
      default:
        return { state, result: { ok: false, error: { code: "invalid", message: "Unknown action." } } };
    }
  } catch (error) {
    if (error instanceof GlucoseError) return { state, result: { ok: false, error: { code: error.code, message: error.message } } };
    if (error instanceof Error) return { state, result: { ok: false, error: { code: "invalid", message: error.message } } };
    throw error;
  }
}

const contextLabel: Record<ReadingContext, string> = {
  fasting: "fasting",
  before_meal: "before a meal",
  after_meal: "after a meal",
  bedtime: "at bedtime",
  overnight: "overnight",
  other: "",
};

export function formatGlucoseReply(result: GlucoseResult): string {
  if (!result.ok) return `⚠️ ${result.error.message}`;
  const u = result.unit;
  switch (result.action) {
    case "log_glucose": {
      const r = result.reading;
      const head = result.duplicate ? "Already logged:" : "Logged:";
      const line = `${head} ${formatGlucose(r.mgdl, u)}${contextLabel[r.context] ? ` ${contextLabel[r.context]}` : ""}.`;
      return result.notice ? `${line}\n${result.notice}` : line;
    }
    case "delete_glucose":
    case "undo_glucose":
      return result.deleted ? `Removed reading ${formatGlucose(result.deleted.mgdl, u)} (${result.deleted.date}).` : "Nothing to undo from this chat.";
    case "list_glucose":
      return result.readings.length
        ? result.readings.map((r) => `• ${r.date} ${formatGlucose(r.mgdl, u)} ${contextLabel[r.context]}`.trim()).join("\n")
        : "No glucose readings yet.";
    case "set_glucose_target":
      return `Target range saved: ${formatGlucose(result.low, u)}–${formatGlucose(result.high, u)}.`;
    case "meal_glucose_responses":
      return result.responses.length
        ? result.responses
            .map((m) => (m.riseMgdl === null ? `• After meal: ${formatGlucose(m.afterMgdl, u)} (no before-meal reading)` : `• Rise ${m.riseMgdl >= 0 ? "+" : ""}${formatGlucose(m.riseMgdl, u)} over ${m.minutesAfter} min`))
            .join("\n")
        : "Log a reading before and after a meal to see how that meal affected you.";
    case "glucose_summary": {
      const s = result.summary;
      if (!s.count) return `No readings in the last ${s.days} days.`;
      const label = s.continuous ? "time in range" : "readings in range";
      return [
        `Last ${s.days} days: ${s.count} readings on ${s.daysWithReadings} of ${s.days} days (days without readings aren't counted).`,
        `Average ${formatGlucose(s.averageMgdl!, u)} · ${s.percent!.in_range}% ${label} (${formatGlucose(s.target.lowMgdl, u)}–${formatGlucose(s.target.highMgdl, u)}).`,
        s.lowEvents ? `${s.lowEvents} low reading${s.lowEvents === 1 ? "" : "s"} below 70 mg/dL — worth sharing with your care team.` : "No readings below 70 mg/dL.",
      ].join("\n");
    }
  }
}

/** Chat phrases: "glucose 142 after lunch", "bg 6.2 fasting", "sugar 98 before dinner", "glucose summary". */
export function parseGlucoseMessage(input: string): GlucoseCommand | null {
  const text = input.toLowerCase().trim();
  if (!/\b(glucose|bg|blood sugar|sugar|bs|reading)\b/.test(text)) return null;
  if (/\b(summary|status|report|trend|week|average)\b/.test(text)) return { action: "glucose_summary", days: /\b30\b|month/.test(text) ? 30 : 14 };
  if (/\b(undo|delete last|remove last)\b/.test(text)) return { action: "undo_glucose" };
  if (/\b(history|recent|list)\b/.test(text)) return { action: "list_glucose", limit: 5 };
  const number = text.match(/(\d{1,3}(?:\.\d)?)/);
  if (!number) return null;
  const value = Number(number[1]);
  const unit: Unit | undefined = /mmol/.test(text) ? "mmol/L" : /mg/.test(text) ? "mg/dL" : undefined;
  let context: ReadingContext = "other";
  if (/\b(fasting|woke|waking|morning fasting)\b/.test(text)) context = "fasting";
  else if (/\b(after|post|2h|two hours)\b/.test(text)) context = "after_meal";
  else if (/\b(before|pre)\b/.test(text)) context = "before_meal";
  else if (/\b(bed|bedtime|night)\b/.test(text)) context = "bedtime";
  return { action: "log_glucose", value, context, ...(unit ? { unit } : {}) };
}

const ts = { type: "string", description: "ISO 8601 timestamp; defaults to now." };
export const glucoseToolDefinitions = [
  {
    name: "log_glucose",
    title: "Log a blood glucose reading",
    description:
      "Record a self-measured glucose reading. Units are inferred (≤35 → mmol/L) unless given. Returns a safety notice for low/very high readings. Never use this tool's output to suggest medication or insulin doses.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["value"],
      properties: {
        value: { type: "number", exclusiveMinimum: 0 },
        unit: { type: "string", enum: ["mg/dL", "mmol/L"] },
        context: { type: "string", enum: [...contexts] },
        takenAt: ts,
        mealId: { type: "string" },
        note: { type: "string", maxLength: 200 },
        idempotencyKey: { type: "string", maxLength: 100 },
      },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "glucose_summary",
    title: "Glucose summary",
    description: "Average, % of readings in the target range, low-reading count and per-context averages. Days without readings are reported as gaps.",
    inputSchema: { type: "object", properties: { days: { type: "integer", minimum: 1, maximum: 90 } } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "list_glucose",
    title: "Recent glucose readings",
    description: "Most recent readings first.",
    inputSchema: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 100 } } },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "meal_glucose_responses",
    title: "Meal glucose responses",
    description: "Before/after-meal reading pairs showing how glucose changed around logged meals. Descriptive only.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "set_glucose_target",
    title: "Set target range",
    description: "Save the target range the person's care team gave them. Safety thresholds for lows stay fixed.",
    inputSchema: {
      type: "object",
      required: ["low", "high"],
      properties: { low: { type: "number" }, high: { type: "number" }, unit: { type: "string", enum: ["mg/dL", "mmol/L"] } },
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "delete_glucose",
    title: "Delete a reading",
    description: "Delete one reading by id.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
  },
  {
    name: "undo_glucose",
    title: "Undo last reading",
    description: "Delete the most recent reading created from this same client.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
  },
] as const;

export function glucoseCommandFromTool(name: string, args: Record<string, unknown> | undefined): GlucoseCommand | null {
  if (!glucoseToolDefinitions.some((t) => t.name === name)) return null;
  return { ...(args ?? {}), action: name } as GlucoseCommand;
}
