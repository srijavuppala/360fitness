/**
 * Workout goal & tracking — shared types.
 *
 * Everything in this package is plain TypeScript with zero runtime
 * dependencies so the same rules run in the React Native app, the web
 * companion, an MCP server and a messaging (iMessage/SMS) handler.
 */

export const workoutTypes = [
  "run",
  "walk",
  "cycle",
  "swim",
  "strength",
  "yoga",
  "hiit",
  "sport",
  "other",
] as const;
export type WorkoutType = (typeof workoutTypes)[number];

export const intensities = ["easy", "moderate", "hard"] as const;
export type Intensity = (typeof intensities)[number];

/** Where a record came from. Used for attribution and de-duplication. */
export const sources = ["app", "web", "mcp", "message", "wearable"] as const;
export type Source = (typeof sources)[number];

export type ExerciseSet = {
  reps: number;
  /** Load in kilograms; null for body-weight work. */
  loadKg: number | null;
  done: boolean;
};

export type Exercise = { name: string; sets: ExerciseSet[] };

export type WorkoutSession = {
  id: string;
  /** Local calendar date, YYYY-MM-DD, in the person's time zone. */
  date: string;
  type: WorkoutType;
  /** Optional free-text title, e.g. "Leg day" or "Morning 5k". */
  title?: string;
  durationMin: number;
  intensity: Intensity;
  distanceKm?: number;
  exercises?: Exercise[];
  /** Planned sessions count toward nothing until completed. */
  status: "completed" | "planned" | "skipped";
  /** Optional reason captured for a skipped session (tracker AI Notification r7). */
  skipReason?: string;
  note?: string;
  source: Source;
  /**
   * Client-chosen key. Retrying the same command (flaky network, duplicate
   * webhook delivery, double-tap) with the same key never creates a second
   * session.
   */
  idempotencyKey?: string;
  createdAt: string;
  updatedAt: string;
};

export const goalMetrics = [
  "sessions",
  "minutes",
  "distanceKm",
  "activeDays",
] as const;
export type GoalMetric = (typeof goalMetrics)[number];

export type WorkoutGoal = {
  id: string;
  /** Human label, generated when not provided ("3 sessions a week"). */
  title: string;
  metric: GoalMetric;
  /** Weekly target for the metric. */
  target: number;
  /** Restrict the goal to some workout types; empty/undefined = all types. */
  types?: WorkoutType[];
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type WorkoutState = {
  version: 1;
  /** 0 = Sunday … 6 = Saturday. Defaults to Monday. */
  weekStartsOn: number;
  goals: WorkoutGoal[];
  sessions: WorkoutSession[];
};

export type GoalProgress = {
  goal: WorkoutGoal;
  weekStart: string;
  weekEnd: string;
  value: number;
  target: number;
  /** 0–1, capped at 1. */
  ratio: number;
  met: boolean;
  remaining: number;
};

export type WeekSummary = {
  weekStart: string;
  weekEnd: string;
  sessions: number;
  minutes: number;
  distanceKm: number;
  activeDays: number;
  byType: Partial<Record<WorkoutType, number>>;
  goals: GoalProgress[];
  /** Consecutive previous weeks (including this one if met) where every active goal was met. */
  goalStreakWeeks: number;
};
