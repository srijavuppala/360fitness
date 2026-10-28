import { dailyNutrition, Entry, lastDays, Nutrients } from "./meals";

export type HistoryDay = {
  date: string;
  meals: number;
  checkedIn: boolean;
  nutrition: Nutrients | null;
};

// Empty and skipped-only dates are missing intake, not zero-calorie days.
export function historyDays(
  entries: Entry[],
  count: number,
  now = new Date(),
): HistoryDay[] {
  return lastDays(count, now).map((date) => {
    const recorded = entries.filter((entry) => entry.date === date);
    const meals = recorded.filter(
      (entry) => entry.status === "confirmed",
    ).length;
    return {
      date,
      meals,
      checkedIn: recorded.length > 0,
      nutrition: meals ? dailyNutrition(recorded, date) : null,
    };
  });
}

export function averageLogged(
  days: HistoryDay[],
  nutrient: keyof Nutrients,
): number | null {
  const known = days.flatMap((day) => {
    const value = day.nutrition?.[nutrient];
    return value === null || value === undefined ? [] : [value];
  });
  return known.length
    ? known.reduce((sum, value) => sum + value, 0) / known.length
    : null;
}

/** Days whose known intake sits within ±10% of the daily target. */
export function daysOnTarget(
  days: HistoryDay[],
  target: number,
  nutrient: keyof Nutrients = "kcal",
  band = 0.1,
): number {
  if (!(target > 0)) return 0;
  return days.filter((day) => {
    const value = day.nutrition?.[nutrient];
    return value != null && Math.abs(value - target) <= target * band;
  }).length;
}
