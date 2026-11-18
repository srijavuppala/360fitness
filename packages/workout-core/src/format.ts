import type { CommandResult } from "./commands.ts";
import type { GoalProgress, WeekSummary, WorkoutSession } from "./types.ts";

/** Short plain-text replies for chat surfaces (iMessage/SMS limit-friendly). */

const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function describeSession(s: WorkoutSession): string {
  if (s.status === "skipped") return `Skipped ${s.type}${s.skipReason ? ` (${s.skipReason})` : ""} on ${s.date}`;
  const parts = [`${s.durationMin} min ${s.title ?? s.type}`];
  if (s.distanceKm) parts.push(`${round(s.distanceKm)} km`);
  if (s.intensity !== "moderate") parts.push(s.intensity);
  return `${parts.join(", ")} · ${s.date}`;
}

export function describeProgress(p: GoalProgress): string {
  const unit = p.goal.metric === "minutes" ? " min" : p.goal.metric === "distanceKm" ? " km" : "";
  const status = p.met ? "✅ done" : `${round(p.remaining)}${unit} to go`;
  return `${p.goal.title}: ${round(p.value)}/${round(p.target)}${unit} — ${status}`;
}

export function describeWeek(w: WeekSummary): string {
  const lines = [
    `This week (${w.weekStart} → ${w.weekEnd}): ${w.sessions} workout${w.sessions === 1 ? "" : "s"}, ${w.minutes} min${w.distanceKm ? `, ${round(w.distanceKm)} km` : ""}.`,
  ];
  if (w.goals.length) lines.push(...w.goals.map(describeProgress));
  else lines.push('No goal yet — try "goal 3 workouts a week".');
  if (w.goalStreakWeeks > 1) lines.push(`🔥 ${w.goalStreakWeeks}-week goal streak`);
  return lines.join("\n");
}

export const helpText = [
  "Log: \"ran 5k in 28 min\", \"45 min yoga easy\", \"lifted 1h hard yesterday\"",
  "Skip: \"skipped run, knee sore\"",
  "Goals: \"goal 3 workouts a week\", \"goal 150 minutes a week\"",
  "Check: \"status\", \"history\", \"goals\", \"undo\"",
].join("\n");

export function formatReply(result: CommandResult): string {
  if (!result.ok) return `⚠️ ${result.error.message}`;
  switch (result.action) {
    case "log_workout": {
      const head = result.duplicate ? "Already logged:" : result.session.status === "skipped" ? "Noted:" : "Logged 💪";
      const goals = result.summary.goals.map(describeProgress);
      return [`${head} ${describeSession(result.session)}`, ...goals].join("\n");
    }
    case "update_workout":
      return `Updated: ${describeSession(result.session)}`;
    case "delete_workout":
    case "undo_last":
      return result.deleted ? `Removed: ${describeSession(result.deleted)}` : "Nothing to undo from this chat.";
    case "set_goal":
      return `${result.replaced ? "Goal updated" : "Goal set"}: ${result.goal.title}.\n${result.summary.goals
        .filter((g) => g.goal.id === result.goal.id)
        .map(describeProgress)
        .join("\n")}`;
    case "archive_goal":
      return "Goal archived. Your history is kept.";
    case "list_goals":
      return result.goals.length ? result.goals.map((g) => `• ${g.title}`).join("\n") : 'No goals yet — try "goal 3 workouts a week".';
    case "list_workouts":
      return result.sessions.length ? result.sessions.map((s) => `• ${describeSession(s)}`).join("\n") : "No workouts logged yet.";
    case "summary":
      return describeWeek(result.summary);
    case "help":
      return helpText;
    case "clarify":
      return result.question;
  }
}
