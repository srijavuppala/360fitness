import type { Command } from "./commands.ts";
import type { GoalMetric, Intensity, WorkoutType } from "./types.ts";

/**
 * Deterministic text → command parser for chat surfaces (iMessage, SMS,
 * Slack, a quick-log box in the app). No AI call is needed for the common
 * phrasings; anything it cannot understand returns `null` so the caller can
 * reply with help text (or hand off to an LLM that emits a `Command`).
 *
 * Examples:
 *   "ran 5k in 28 min"            → log run, 5 km, 28 min
 *   "45 min yoga easy"            → log yoga, 45 min, easy
 *   "lifted 1h hard yesterday"    → log strength, 60 min, hard, yesterday
 *   "goal 3 workouts a week"      → set sessions goal = 3
 *   "goal 150 minutes per week"   → set minutes goal = 150
 *   "goal run 20 km a week"       → set distance goal = 20 (run only)
 *   "status" / "progress"         → weekly summary
 *   "undo"                        → delete the most recent logged workout
 *   "skipped run, knee sore"      → skipped session with reason
 */

const typeWords: [RegExp, WorkoutType][] = [
  [/\b(ran|run|running|jog|jogged|jogging)\b/, "run"],
  [/\b(walk|walked|walking|hike|hiked|hiking)\b/, "walk"],
  [/\b(bike|biked|cycle|cycled|cycling|ride|rode|spin)\b/, "cycle"],
  [/\b(swim|swam|swimming|laps)\b/, "swim"],
  [/\b(lift|lifted|lifting|weights|strength|gym|legs?|leg day|push|pull|upper|lower)\b/, "strength"],
  [/\b(yoga|pilates|stretch|stretched|stretching|mobility)\b/, "yoga"],
  [/\b(hiit|crossfit|circuit|bootcamp|intervals?)\b/, "hiit"],
  [/\b(tennis|football|soccer|basketball|cricket|badminton|pickleball|climb|climbed|climbing)\b/, "sport"],
];

function detectType(text: string): WorkoutType | null {
  for (const [pattern, type] of typeWords) if (pattern.test(text)) return type;
  return null;
}

function detectIntensity(text: string): Intensity | undefined {
  if (/\b(easy|light|gentle|recovery|chill)\b/.test(text)) return "easy";
  if (/\b(hard|intense|tough|brutal|max|heavy)\b/.test(text)) return "hard";
  if (/\b(moderate|medium|steady)\b/.test(text)) return "moderate";
  return undefined;
}

/** Minutes from "45 min", "1h", "1 hr 15", "1:30", "90m". */
export function parseDuration(text: string): number | null {
  const hm = text.match(/\b(\d{1,2}):(\d{2})\b(?!\s*(am|pm))/);
  if (hm) return Number(hm[1]) * 60 + Number(hm[2]);
  const hours = text.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b(?:\s*(\d{1,2})\s*(m|min|mins|minutes)?\b)?/);
  if (hours) return Math.round(Number(hours[1]) * 60 + (hours[3] ? Number(hours[3]) : 0));
  const mins = text.match(/(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)\b/);
  if (mins) return Math.round(Number(mins[1]));
  return null;
}

/** Kilometres from "5k", "5 km", "3.1 miles", "10mi". */
export function parseDistance(text: string): number | null {
  const km = text.match(/(\d+(?:\.\d+)?)\s*(k|km|kms|kilometers?|kilometres?)\b/);
  if (km) return Number(km[1]);
  const mi = text.match(/(\d+(?:\.\d+)?)\s*(mi|mile|miles)\b/);
  if (mi) return Math.round(Number(mi[1]) * 1.60934 * 100) / 100;
  return null;
}

function detectDate(text: string, today: string): string | undefined {
  if (/\byesterday\b/.test(text)) {
    const [y, m, d] = today.split("-").map(Number);
    const date = new Date(y, m - 1, d - 1, 12);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  return iso ? iso[1] : undefined;
}

function parseGoal(text: string): Command | null {
  const number = text.match(/(\d+(?:\.\d+)?)/);
  if (!number) return null;
  const target = Number(number[1]);
  let metric: GoalMetric = "sessions";
  if (/\b(min|mins|minutes|hours?|hrs?)\b/.test(text)) metric = "minutes";
  else if (/\b(k|km|kms|kilomet\w*|mi|miles?)\b/.test(text)) metric = "distanceKm";
  else if (/\b(days?|active days?)\b/.test(text) && !/\b(a|per|each|every)\s+day\b/.test(text)) metric = "activeDays";
  let value = target;
  if (metric === "minutes" && /\b(hours?|hrs?)\b/.test(text)) value = target * 60;
  if (metric === "distanceKm" && /\b(mi|miles?)\b/.test(text)) value = Math.round(target * 1.60934 * 100) / 100;
  const type = detectType(text.replace(/\bworkouts?\b/g, ""));
  return { action: "set_goal", metric, target: value, ...(type ? { types: [type] } : {}) };
}

export function parseMessage(input: string, today: string): Command | null {
  const text = input.toLowerCase().replace(/[’']/g, "'").trim();
  if (!text) return null;
  if (/^(help|\?|commands|what can you do)/.test(text)) return { action: "help" };
  if (/^(status|progress|summary|how am i doing|week|this week)\b/.test(text)) return { action: "summary" };
  if (/^(history|recent|last workouts?)\b/.test(text)) return { action: "list_workouts", limit: 5 };
  if (/^(goals?|my goals?)$/.test(text)) return { action: "list_goals" };
  if (/^(undo|delete last|remove last)\b/.test(text)) return { action: "undo_last" };
  if (/^(set\s+)?(a\s+)?(weekly\s+)?goal\b|\btarget\b.*\bweek\b/.test(text)) return parseGoal(text);

  const skipped = /\b(skip|skipped|missed|didn't|did not|no workout)\b/.test(text);
  const type = detectType(text);
  const durationMin = parseDuration(text);
  const distanceKm = parseDistance(text);
  const date = detectDate(text, today);

  if (skipped) {
    const reason = text.split(/[,—-]|because|cause/).slice(1).join(" ").trim();
    return {
      action: "log_workout",
      type: type ?? "other",
      durationMin: 0,
      status: "skipped",
      ...(reason ? { skipReason: reason.slice(0, 200) } : {}),
      ...(date ? { date } : {}),
    };
  }
  if (!type && durationMin === null && distanceKm === null) return null;
  const resolvedType = type ?? (distanceKm !== null ? "run" : "other");
  // A distance without a time: estimate nothing — ask the user instead.
  if (durationMin === null) return { action: "clarify", question: `How long was the ${resolvedType}? e.g. "${resolvedType} 30 min".` };
  const intensity = detectIntensity(text);
  return {
    action: "log_workout",
    type: resolvedType,
    durationMin,
    ...(distanceKm !== null ? { distanceKm } : {}),
    ...(intensity ? { intensity } : {}),
    ...(date ? { date } : {}),
  };
}
