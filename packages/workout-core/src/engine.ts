import {
  goalMetrics,
  intensities,
  sources,
  workoutTypes,
  type GoalMetric,
  type GoalProgress,
  type Intensity,
  type Source,
  type WeekSummary,
  type WorkoutGoal,
  type WorkoutSession,
  type WorkoutState,
  type WorkoutType,
} from "./types.ts";

export class WorkoutError extends Error {
  readonly code: "invalid" | "not_found";
  constructor(code: "invalid" | "not_found", message: string) {
    super(message);
    this.code = code;
    this.name = "WorkoutError";
  }
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_SESSIONS = 5000;
const MAX_GOALS = 20;

export function emptyWorkoutState(weekStartsOn = 1): WorkoutState {
  return { version: 1, weekStartsOn, goals: [], sessions: [] };
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Date arithmetic at local noon so DST shifts never move the calendar day. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + days, 12));
}

function dayOfWeek(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 12).getDay();
}

export function weekStart(date: string, weekStartsOn = 1): string {
  const offset = (dayOfWeek(date) - weekStartsOn + 7) % 7;
  return addDays(date, -offset);
}

export function newId(prefix = "wk"): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function invalid(message: string): never {
  throw new WorkoutError("invalid", message);
}

function finiteIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

export function validateSession(session: WorkoutSession): void {
  if (!session.id || typeof session.id !== "string") invalid("A workout needs an id.");
  if (!DATE.test(session.date)) invalid("Choose a valid date (YYYY-MM-DD).");
  if (!workoutTypes.includes(session.type)) invalid(`Workout type must be one of: ${workoutTypes.join(", ")}.`);
  if (!intensities.includes(session.intensity)) invalid("Intensity must be easy, moderate or hard.");
  if (!sources.includes(session.source)) invalid("Unknown source.");
  if (!["completed", "planned", "skipped"].includes(session.status)) invalid("Unknown workout status.");
  if (!finiteIn(session.durationMin, 0, 1440)) invalid("Duration must be between 0 and 1,440 minutes.");
  if (session.status === "completed" && session.durationMin <= 0)
    invalid("A completed workout needs a duration above zero.");
  if (session.distanceKm !== undefined && !finiteIn(session.distanceKm, 0, 1000))
    invalid("Distance must be between 0 and 1,000 km.");
  if (session.title !== undefined && (typeof session.title !== "string" || session.title.length > 80))
    invalid("Titles can be up to 80 characters.");
  if (session.note !== undefined && (typeof session.note !== "string" || session.note.length > 500))
    invalid("Notes can be up to 500 characters.");
  if (session.skipReason !== undefined && (typeof session.skipReason !== "string" || session.skipReason.length > 200))
    invalid("Skip reasons can be up to 200 characters.");
  if (session.exercises !== undefined) {
    if (!Array.isArray(session.exercises) || session.exercises.length > 40) invalid("Add up to 40 exercises.");
    for (const exercise of session.exercises) {
      if (!exercise.name?.trim() || exercise.name.length > 80) invalid("Each exercise needs a name (up to 80 characters).");
      if (!Array.isArray(exercise.sets) || exercise.sets.length > 50) invalid("Each exercise can have up to 50 sets.");
      for (const set of exercise.sets) {
        if (!finiteIn(set.reps, 0, 1000) || !Number.isInteger(set.reps)) invalid("Reps must be a whole number up to 1,000.");
        if (set.loadKg !== null && !finiteIn(set.loadKg, 0, 1000)) invalid("Load must be between 0 and 1,000 kg.");
        if (typeof set.done !== "boolean") invalid("Each set needs a done flag.");
      }
    }
  }
}

export function validateGoal(goal: WorkoutGoal): void {
  if (!goal.id) invalid("A goal needs an id.");
  if (!goalMetrics.includes(goal.metric)) invalid(`Goal metric must be one of: ${goalMetrics.join(", ")}.`);
  const max: Record<GoalMetric, number> = { sessions: 21, minutes: 3000, distanceKm: 1000, activeDays: 7 };
  if (!finiteIn(goal.target, 0.1, max[goal.metric])) invalid(`Weekly ${goal.metric} target must be above 0 and at most ${max[goal.metric]}.`);
  if (goal.types !== undefined && (!Array.isArray(goal.types) || goal.types.some((t) => !workoutTypes.includes(t))))
    invalid("Goal workout types are not recognised.");
  if (!goal.title?.trim() || goal.title.length > 80) invalid("Goal titles can be up to 80 characters.");
  if (!["active", "archived"].includes(goal.status)) invalid("Unknown goal status.");
}

export function validateWorkoutState(state: WorkoutState): void {
  if (!state || state.version !== 1) invalid("Workout data has an unknown version.");
  if (!Number.isInteger(state.weekStartsOn) || state.weekStartsOn < 0 || state.weekStartsOn > 6)
    invalid("weekStartsOn must be 0–6.");
  if (!Array.isArray(state.goals) || !Array.isArray(state.sessions)) invalid("Workout data is malformed.");
  state.goals.forEach(validateGoal);
  state.sessions.forEach(validateSession);
}

/** Parse and validate persisted JSON. Throws without touching stored data. */
export function parseWorkoutState(raw: string | unknown): WorkoutState {
  const value = (typeof raw === "string" ? JSON.parse(raw) : raw) as WorkoutState;
  validateWorkoutState(value);
  return value;
}

export type LogWorkoutInput = {
  type: WorkoutType;
  durationMin: number;
  date?: string;
  intensity?: Intensity;
  distanceKm?: number;
  title?: string;
  note?: string;
  exercises?: WorkoutSession["exercises"];
  status?: WorkoutSession["status"];
  skipReason?: string;
  source?: Source;
  idempotencyKey?: string;
};

export type Clock = { now: () => Date; id: (prefix?: string) => string };
export const systemClock: Clock = { now: () => new Date(), id: newId };

export function logWorkout(
  state: WorkoutState,
  input: LogWorkoutInput,
  clock: Clock = systemClock,
): { state: WorkoutState; session: WorkoutSession; duplicate: boolean } {
  if (input.idempotencyKey) {
    const existing = state.sessions.find((s) => s.idempotencyKey === input.idempotencyKey);
    if (existing) return { state, session: existing, duplicate: true };
  }
  if (state.sessions.length >= MAX_SESSIONS) invalid("Workout history is full; archive older sessions first.");
  const now = clock.now().toISOString();
  const session: WorkoutSession = {
    id: clock.id("wk"),
    date: input.date ?? localDate(clock.now()),
    type: input.type,
    durationMin: input.durationMin,
    intensity: input.intensity ?? "moderate",
    status: input.status ?? "completed",
    source: input.source ?? "app",
    createdAt: now,
    updatedAt: now,
    ...(input.distanceKm !== undefined && { distanceKm: input.distanceKm }),
    ...(input.title !== undefined && { title: input.title.trim() }),
    ...(input.note !== undefined && { note: input.note.trim() }),
    ...(input.exercises !== undefined && { exercises: input.exercises }),
    ...(input.skipReason !== undefined && { skipReason: input.skipReason.trim() }),
    ...(input.idempotencyKey !== undefined && { idempotencyKey: input.idempotencyKey }),
  };
  validateSession(session);
  return { state: { ...state, sessions: [...state.sessions, session] }, session, duplicate: false };
}

export type SessionPatch = Partial<
  Pick<WorkoutSession, "date" | "type" | "durationMin" | "intensity" | "distanceKm" | "title" | "note" | "exercises" | "status" | "skipReason">
>;

export function updateWorkout(
  state: WorkoutState,
  id: string,
  patch: SessionPatch,
  clock: Clock = systemClock,
): { state: WorkoutState; session: WorkoutSession } {
  const current = state.sessions.find((s) => s.id === id);
  if (!current) throw new WorkoutError("not_found", "That workout was not found.");
  const session: WorkoutSession = { ...current, ...patch, id, updatedAt: clock.now().toISOString() };
  validateSession(session);
  return { state: { ...state, sessions: state.sessions.map((s) => (s.id === id ? session : s)) }, session };
}

export function deleteWorkout(state: WorkoutState, id: string): WorkoutState {
  if (!state.sessions.some((s) => s.id === id)) throw new WorkoutError("not_found", "That workout was not found.");
  return { ...state, sessions: state.sessions.filter((s) => s.id !== id) };
}

const metricNoun: Record<GoalMetric, [string, string]> = {
  sessions: ["workout", "workouts"],
  minutes: ["active minute", "active minutes"],
  distanceKm: ["km", "km"],
  activeDays: ["active day", "active days"],
};

export function describeGoal(metric: GoalMetric, target: number, types?: WorkoutType[]): string {
  const [one, many] = metricNoun[metric];
  const scope = types?.length ? ` (${types.join("/")})` : "";
  return `${target} ${target === 1 ? one : many} a week${scope}`;
}

export type SetGoalInput = {
  metric: GoalMetric;
  target: number;
  types?: WorkoutType[];
  title?: string;
  /** Replace an existing goal instead of adding one. */
  id?: string;
};

/**
 * Add or replace a weekly goal. Setting a goal with the same metric and type
 * scope as an active goal replaces it, so "goal 4 workouts a week" sent twice
 * from chat never stacks duplicate goals.
 */
export function setGoal(
  state: WorkoutState,
  input: SetGoalInput,
  clock: Clock = systemClock,
): { state: WorkoutState; goal: WorkoutGoal; replaced: boolean } {
  const scopeKey = (types?: WorkoutType[]) => [...(types ?? [])].sort().join(",");
  const existing = input.id
    ? state.goals.find((g) => g.id === input.id)
    : state.goals.find((g) => g.status === "active" && g.metric === input.metric && scopeKey(g.types) === scopeKey(input.types));
  if (input.id && !existing) throw new WorkoutError("not_found", "That goal was not found.");
  if (!existing && state.goals.filter((g) => g.status === "active").length >= MAX_GOALS)
    invalid(`You can have up to ${MAX_GOALS} active goals.`);
  const now = clock.now().toISOString();
  const goal: WorkoutGoal = {
    id: existing?.id ?? clock.id("goal"),
    title: input.title?.trim() || describeGoal(input.metric, input.target, input.types),
    metric: input.metric,
    target: input.target,
    status: "active",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...(input.types?.length ? { types: [...input.types] } : {}),
  };
  validateGoal(goal);
  const goals = existing ? state.goals.map((g) => (g.id === existing.id ? goal : g)) : [...state.goals, goal];
  return { state: { ...state, goals }, goal, replaced: !!existing };
}

export function archiveGoal(state: WorkoutState, id: string, clock: Clock = systemClock): WorkoutState {
  if (!state.goals.some((g) => g.id === id)) throw new WorkoutError("not_found", "That goal was not found.");
  const now = clock.now().toISOString();
  return { ...state, goals: state.goals.map((g) => (g.id === id ? { ...g, status: "archived" as const, updatedAt: now } : g)) };
}

function inRange(session: WorkoutSession, start: string, end: string) {
  return session.status === "completed" && session.date >= start && session.date <= end;
}

function metricValue(sessions: WorkoutSession[], metric: GoalMetric): number {
  switch (metric) {
    case "sessions":
      return sessions.length;
    case "minutes":
      return sessions.reduce((sum, s) => sum + s.durationMin, 0);
    case "distanceKm":
      return Math.round(sessions.reduce((sum, s) => sum + (s.distanceKm ?? 0), 0) * 100) / 100;
    case "activeDays":
      return new Set(sessions.map((s) => s.date)).size;
  }
}

export function goalProgress(state: WorkoutState, goal: WorkoutGoal, date: string = localDate()): GoalProgress {
  const start = weekStart(date, state.weekStartsOn);
  const end = addDays(start, 6);
  const sessions = state.sessions.filter(
    (s) => inRange(s, start, end) && (!goal.types?.length || goal.types.includes(s.type)),
  );
  const value = metricValue(sessions, goal.metric);
  return {
    goal,
    weekStart: start,
    weekEnd: end,
    value,
    target: goal.target,
    ratio: Math.min(1, value / goal.target),
    met: value >= goal.target,
    remaining: Math.max(0, Math.round((goal.target - value) * 100) / 100),
  };
}

export function weekSummary(state: WorkoutState, date: string = localDate()): WeekSummary {
  const start = weekStart(date, state.weekStartsOn);
  const end = addDays(start, 6);
  const sessions = state.sessions.filter((s) => inRange(s, start, end));
  const byType: WeekSummary["byType"] = {};
  for (const s of sessions) byType[s.type] = (byType[s.type] ?? 0) + 1;
  const active = state.goals.filter((g) => g.status === "active");
  const goals = active.map((g) => goalProgress(state, g, date));

  // Streak: count back week by week while every active goal was met.
  // The current week counts only once it is met; an unfinished week does not break the streak.
  let streak = 0;
  if (active.length) {
    let cursor = start;
    const thisWeekMet = goals.every((g) => g.met);
    if (thisWeekMet) streak++;
    for (let i = 0; i < 104; i++) {
      cursor = addDays(cursor, -7);
      if (active.every((g) => goalProgress(state, g, cursor).met)) streak++;
      else break;
    }
  }
  return {
    weekStart: start,
    weekEnd: end,
    sessions: sessions.length,
    minutes: metricValue(sessions, "minutes"),
    distanceKm: metricValue(sessions, "distanceKm"),
    activeDays: metricValue(sessions, "activeDays"),
    byType,
    goals,
    goalStreakWeeks: streak,
  };
}

export function recentSessions(state: WorkoutState, limit = 10): WorkoutSession[] {
  return [...state.sessions]
    .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
    .slice(0, Math.max(0, Math.min(100, limit)));
}
