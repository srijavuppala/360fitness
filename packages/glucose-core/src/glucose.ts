/**
 * Self-reported blood glucose log for people managing diabetes or
 * prediabetes. Dependency-free so the app, MCP server and messaging adapter
 * share one implementation.
 *
 * SAFETY BOUNDARY (see docs/business/PRODUCT-PLAN.md §6):
 * - Records and summarises readings the person enters. It never recommends
 *   insulin or medication doses, never diagnoses, and never adjusts a
 *   treatment plan. Those features would make the app a regulated medical
 *   device and need a clinician.
 * - Default ranges are the published International Consensus on Time in
 *   Range (Battelino et al., Diabetes Care 2019; adopted in ADA Standards of
 *   Care): target 70–180 mg/dL, level 1 low < 70, level 2 low < 54,
 *   high > 180, very high > 250. A person can replace the target range with
 *   the one their care team gave them; the safety thresholds (54/70) stay.
 */

export const MGDL_PER_MMOLL = 18.0182;

export const contexts = ["fasting", "before_meal", "after_meal", "bedtime", "overnight", "other"] as const;
export type ReadingContext = (typeof contexts)[number];
export type Unit = "mg/dL" | "mmol/L";
export const readingSources = ["app", "web", "mcp", "message", "meter", "cgm"] as const;
export type ReadingSource = (typeof readingSources)[number];

export type GlucoseReading = {
  id: string;
  /** ISO timestamp of when the reading was taken. */
  takenAt: string;
  /** Local calendar date of `takenAt` in the person's time zone (YYYY-MM-DD). */
  date: string;
  /** Canonical storage is mg/dL; the entered value and unit are kept for provenance. */
  mgdl: number;
  entered: { value: number; unit: Unit };
  context: ReadingContext;
  /** Optional link to a logged meal (after_meal / before_meal readings). */
  mealId?: string;
  note?: string;
  source: ReadingSource;
  idempotencyKey?: string;
  createdAt: string;
};

export type TargetRange = {
  lowMgdl: number;
  highMgdl: number;
  /** Who set the range: the published default or the person's care team. */
  source: "CONSENSUS_DEFAULT" | "CLINICIAN_PROVIDED";
};

export type GlucoseState = {
  version: 1;
  unit: Unit;
  target: TargetRange;
  readings: GlucoseReading[];
};

export const DEFAULT_TARGET: TargetRange = { lowMgdl: 70, highMgdl: 180, source: "CONSENSUS_DEFAULT" };
/** Fixed safety thresholds; not user-editable. */
export const LEVEL_2_LOW = 54;
export const LEVEL_1_LOW = 70;
export const VERY_HIGH = 250;
/** Plausible meter range; values outside are almost always typos or unit mix-ups. */
const MIN_MGDL = 20;
const MAX_MGDL = 600;

export class GlucoseError extends Error {
  readonly code: "invalid" | "not_found";
  constructor(code: "invalid" | "not_found", message: string) {
    super(message);
    this.code = code;
    this.name = "GlucoseError";
  }
}
const invalid = (m: string): never => {
  throw new GlucoseError("invalid", m);
};

export function emptyGlucoseState(unit: Unit = "mg/dL"): GlucoseState {
  return { version: 1, unit, target: { ...DEFAULT_TARGET }, readings: [] };
}

export function toMgdl(value: number, unit: Unit): number {
  return unit === "mg/dL" ? Math.round(value) : Math.round(value * MGDL_PER_MMOLL);
}

export function fromMgdl(mgdl: number, unit: Unit): number {
  return unit === "mg/dL" ? Math.round(mgdl) : Math.round((mgdl / MGDL_PER_MMOLL) * 10) / 10;
}

export function formatGlucose(mgdl: number, unit: Unit): string {
  return `${fromMgdl(mgdl, unit)} ${unit}`;
}

export function localDateOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export type Band = "very_low" | "low" | "in_range" | "high" | "very_high";

/** Classify against the person's target range plus the fixed safety thresholds. */
export function classify(mgdl: number, target: TargetRange = DEFAULT_TARGET): Band {
  if (mgdl < LEVEL_2_LOW) return "very_low";
  if (mgdl < Math.max(LEVEL_1_LOW, target.lowMgdl)) return "low";
  if (mgdl > VERY_HIGH) return "very_high";
  if (mgdl > target.highMgdl) return "high";
  return "in_range";
}

/**
 * Plain safety notice for a reading, or null. Copy is deliberately general
 * and points to the person's own care plan; clinic-approved wording replaces
 * it before any clinical pilot.
 */
export function safetyNotice(mgdl: number): string | null {
  if (mgdl < LEVEL_2_LOW)
    return "This reading is very low. Follow the low-glucose plan from your care team now. If you feel confused, faint or unable to treat it, call 911 or your local emergency number.";
  if (mgdl < LEVEL_1_LOW) return "This reading is below 70 mg/dL. Follow the low-glucose plan from your care team and recheck as they advised.";
  if (mgdl > 300)
    return "This reading is very high. Follow your care team's high-glucose plan. If you feel very unwell, are vomiting, or have trouble breathing, seek urgent care.";
  return null;
}

export function validateTarget(target: TargetRange): void {
  if (!Number.isFinite(target.lowMgdl) || !Number.isFinite(target.highMgdl)) invalid("Target range needs two numbers.");
  if (target.lowMgdl < LEVEL_1_LOW || target.lowMgdl > 150) invalid("The low end of the target must be between 70 and 150 mg/dL.");
  if (target.highMgdl <= target.lowMgdl || target.highMgdl > 300) invalid("The high end must be above the low end and at most 300 mg/dL.");
  if (!["CONSENSUS_DEFAULT", "CLINICIAN_PROVIDED"].includes(target.source)) invalid("Unknown target source.");
}

export function validateReading(r: GlucoseReading): void {
  if (!r.id) invalid("A reading needs an id.");
  if (Number.isNaN(Date.parse(r.takenAt))) invalid("A reading needs a valid time.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) invalid("A reading needs a valid date.");
  if (!Number.isInteger(r.mgdl) || r.mgdl < MIN_MGDL || r.mgdl > MAX_MGDL)
    invalid(`Glucose must be between ${MIN_MGDL} and ${MAX_MGDL} mg/dL (${fromMgdl(MIN_MGDL, "mmol/L")}–${fromMgdl(MAX_MGDL, "mmol/L")} mmol/L). Check the number and unit.`);
  if (!contexts.includes(r.context)) invalid(`Context must be one of: ${contexts.join(", ")}.`);
  if (!readingSources.includes(r.source)) invalid("Unknown reading source.");
  if (r.note !== undefined && (typeof r.note !== "string" || r.note.length > 200)) invalid("Notes can be up to 200 characters.");
}

export function validateGlucoseState(s: GlucoseState): void {
  if (!s || s.version !== 1) invalid("Glucose data has an unknown version.");
  if (s.unit !== "mg/dL" && s.unit !== "mmol/L") invalid("Unknown glucose unit.");
  validateTarget(s.target);
  if (!Array.isArray(s.readings)) invalid("Glucose data is malformed.");
  s.readings.forEach(validateReading);
}

export function parseGlucoseState(raw: string | unknown): GlucoseState {
  const value = (typeof raw === "string" ? JSON.parse(raw) : raw) as GlucoseState;
  validateGlucoseState(value);
  return value;
}

export type Clock = { now: () => Date; id: (prefix?: string) => string };
export const systemClock: Clock = {
  now: () => new Date(),
  id: (prefix = "bg") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
};

export type AddReadingInput = {
  value: number;
  unit?: Unit;
  context?: ReadingContext;
  takenAt?: string;
  mealId?: string;
  note?: string;
  source?: ReadingSource;
  idempotencyKey?: string;
};

/**
 * Guess the unit when none was given: values ≤ 35 are almost certainly
 * mmol/L (35 mmol/L ≈ 630 mg/dL, beyond meter range), larger ones mg/dL.
 */
export function inferUnit(value: number): Unit {
  return value <= 35 ? "mmol/L" : "mg/dL";
}

export function addReading(
  state: GlucoseState,
  input: AddReadingInput,
  clock: Clock = systemClock,
): { state: GlucoseState; reading: GlucoseReading; duplicate: boolean; notice: string | null } {
  if (input.idempotencyKey) {
    const existing = state.readings.find((r) => r.idempotencyKey === input.idempotencyKey);
    if (existing) return { state, reading: existing, duplicate: true, notice: safetyNotice(existing.mgdl) };
  }
  if (!Number.isFinite(input.value)) invalid("Enter the glucose number from your meter.");
  if (state.readings.length >= 20000) invalid("Glucose history is full.");
  const unit = input.unit ?? inferUnit(input.value);
  const now = clock.now();
  const takenAt = input.takenAt ?? now.toISOString();
  const taken = new Date(takenAt);
  if (taken.getTime() > now.getTime() + 5 * 60 * 1000) invalid("A reading can't be in the future.");
  const reading: GlucoseReading = {
    id: clock.id("bg"),
    takenAt,
    date: localDateOf(taken),
    mgdl: toMgdl(input.value, unit),
    entered: { value: input.value, unit },
    context: input.context ?? "other",
    source: input.source ?? "app",
    createdAt: now.toISOString(),
    ...(input.mealId ? { mealId: input.mealId } : {}),
    ...(input.note ? { note: input.note.trim() } : {}),
    ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
  };
  validateReading(reading);
  return { state: { ...state, readings: [...state.readings, reading] }, reading, duplicate: false, notice: safetyNotice(reading.mgdl) };
}

export function deleteReading(state: GlucoseState, id: string): GlucoseState {
  if (!state.readings.some((r) => r.id === id)) throw new GlucoseError("not_found", "That reading was not found.");
  return { ...state, readings: state.readings.filter((r) => r.id !== id) };
}

export function setTarget(state: GlucoseState, lowMgdl: number, highMgdl: number, source: TargetRange["source"]): GlucoseState {
  const target = { lowMgdl: Math.round(lowMgdl), highMgdl: Math.round(highMgdl), source };
  validateTarget(target);
  return { ...state, target };
}

export type GlucoseSummary = {
  from: string;
  to: string;
  days: number;
  /** Days in the window with at least one reading; days without readings are gaps, never "in range". */
  daysWithReadings: number;
  count: number;
  averageMgdl: number | null;
  /** Percent of readings per band. Fingerstick readings are point samples, not CGM time-in-range. */
  percent: Record<Band, number> | null;
  lowEvents: number;
  byContext: Partial<Record<ReadingContext, { count: number; averageMgdl: number }>>;
  target: TargetRange;
  /** True when every reading came from a CGM, so percentages approximate time in range. */
  continuous: boolean;
};

function addDaysTo(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return localDateOf(new Date(y, m - 1, d + days, 12));
}

export function summarize(state: GlucoseState, days = 14, today: string = localDateOf(new Date())): GlucoseSummary {
  const from = addDaysTo(today, -(days - 1));
  const window = state.readings.filter((r) => r.date >= from && r.date <= today);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const bands: Band[] = ["very_low", "low", "in_range", "high", "very_high"];
  const percent = window.length
    ? (Object.fromEntries(
        bands.map((b) => [b, Math.round((window.filter((r) => classify(r.mgdl, state.target) === b).length / window.length) * 1000) / 10]),
      ) as Record<Band, number>)
    : null;
  const byContext: GlucoseSummary["byContext"] = {};
  for (const c of contexts) {
    const xs = window.filter((r) => r.context === c).map((r) => r.mgdl);
    if (xs.length) byContext[c] = { count: xs.length, averageMgdl: avg(xs)! };
  }
  return {
    from,
    to: today,
    days,
    daysWithReadings: new Set(window.map((r) => r.date)).size,
    count: window.length,
    averageMgdl: avg(window.map((r) => r.mgdl)),
    percent,
    lowEvents: window.filter((r) => r.mgdl < LEVEL_1_LOW).length,
    byContext,
    target: state.target,
    continuous: window.length > 0 && window.every((r) => r.source === "cgm"),
  };
}

export type MealResponse = {
  mealId: string;
  beforeMgdl: number | null;
  afterMgdl: number;
  riseMgdl: number | null;
  minutesAfter: number | null;
};

/**
 * Pair after-meal readings with the closest before-meal reading for the same
 * meal (or within 90 minutes before the after-meal reading). Purely
 * descriptive — it shows what happened, not what to change.
 */
export function mealResponses(state: GlucoseState): MealResponse[] {
  const out: MealResponse[] = [];
  for (const after of state.readings.filter((r) => r.context === "after_meal" && r.mealId)) {
    const t = Date.parse(after.takenAt);
    const before = state.readings
      .filter(
        (r) =>
          r.context === "before_meal" &&
          (r.mealId === after.mealId || (!r.mealId && t - Date.parse(r.takenAt) > 0 && t - Date.parse(r.takenAt) <= 4 * 3600 * 1000)) &&
          Date.parse(r.takenAt) < t,
      )
      .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt))[0];
    out.push({
      mealId: after.mealId!,
      beforeMgdl: before?.mgdl ?? null,
      afterMgdl: after.mgdl,
      riseMgdl: before ? after.mgdl - before.mgdl : null,
      minutesAfter: before ? Math.round((t - Date.parse(before.takenAt)) / 60000) : null,
    });
  }
  return out;
}
