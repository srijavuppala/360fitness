import { localDate } from "./meals";
import {
  MAINTAIN_TOLERANCE_KG,
  options,
  ProfileAnswers,
  weightChangeKg,
} from "./profile";

/** Approximate energy in one kg of body-weight change. An estimate, not a law. */
export const KCAL_PER_KG = 7700;
const MAX_WEEKLY_LOSS_SHARE = 0.01;
const MAX_WEEKLY_GAIN_KG = 0.5;

type Sex = (typeof options.sex)[number];
type Age = (typeof options.age)[number];
type Activity = (typeof options.activity)[number];
type Pace = (typeof options.weeklyPace)[number];

const SEX_CONSTANT: Record<Sex, number> = {
  Male: 5,
  Female: -161,
  "Prefer not to say": -78,
};
const CALORIE_FLOOR: Record<Sex, number> = {
  Male: 1500,
  Female: 1200,
  "Prefer not to say": 1350,
};
/** Midpoints of the onboarding age ranges; unknown age uses an adult average. */
const AGE_YEARS: Record<Exclude<Age, "Under 18">, number> = {
  "18–24": 21,
  "25–34": 30,
  "35–44": 40,
  "45–54": 50,
  "55–64": 60,
  "65+": 70,
  "Prefer not to say": 35,
};
const ACTIVITY_FACTOR: Record<Activity, number> = {
  "Mostly sitting": 1.2,
  "Lightly active": 1.375,
  "Moderately active": 1.55,
  "Very active": 1.725,
  "Varies day to day": 1.375,
};
const PACE_KG: Record<Pace, number> = {
  "Gentle · 0.25 kg a week": 0.25,
  "Steady · 0.5 kg a week": 0.5,
  "Faster · 0.75 kg a week": 0.75,
};

export type Direction = "lose" | "gain" | "maintain";
export type Targets = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  bmr: number;
  maintenance: number;
  /** Negative for a deficit, positive for a surplus. */
  dailyAdjustment: number;
  direction: Direction;
  /** Expected kg per week after safety limits; 0 when maintaining. */
  weeklyChangeKg: number;
  weeksToGoal: number | null;
  goalDate: string | null;
  bmi: number;
  targetBmi: number;
  notes: string[];
};

function pick<T extends string>(
  table: Record<T, number>,
  value: unknown,
): number | null {
  return typeof value === "string" && value in table
    ? table[value as T]
    : null;
}

const roundTo = (value: number, step: number) =>
  Math.round(value / step) * step;

/**
 * Daily calorie and macro estimates from onboarding answers, or null when the
 * answers needed for the formula are missing. Mifflin–St Jeor BMR × activity,
 * adjusted by the chosen pace and clamped to safe limits.
 */
export function calculateTargets(
  answers: ProfileAnswers,
  now = new Date(),
): Targets | null {
  const change = weightChangeKg(answers);
  const height = Number(answers.heightCm);
  const weight = Number(answers.currentWeightKg);
  const sex = answers.sex as Sex | undefined;
  const sexConstant = pick(SEX_CONSTANT, sex);
  const factor = pick(ACTIVITY_FACTOR, answers.activity);
  const minor = answers.age === "Under 18";
  const age = minor ? 16 : pick(AGE_YEARS, answers.age);
  if (
    change === null ||
    !(height >= 100 && height <= 250) ||
    sexConstant === null ||
    factor === null ||
    age === null
  )
    return null;

  const target = weight + change;
  const notes: string[] = [];
  const bmr = 10 * weight + 6.25 * height - 5 * age + sexConstant;
  const maintenance = bmr * factor;
  let direction: Direction =
    Math.abs(change) <= MAINTAIN_TOLERANCE_KG
      ? "maintain"
      : change < 0
        ? "lose"
        : "gain";
  if (minor && direction !== "maintain") {
    direction = "maintain";
    notes.push(
      "Under 18: targets show maintenance only. Please talk to a doctor before trying to change your weight.",
    );
  }

  let pace = direction === "maintain" ? 0 : (pick(PACE_KG, answers.weeklyPace) ?? 0.5);
  if (direction === "lose" && pace > weight * MAX_WEEKLY_LOSS_SHARE) {
    pace = weight * MAX_WEEKLY_LOSS_SHARE;
    notes.push(
      "Pace limited to about 1% of your body weight a week, a commonly recommended maximum.",
    );
  }
  if (direction === "gain" && pace > MAX_WEEKLY_GAIN_KG) {
    pace = MAX_WEEKLY_GAIN_KG;
    notes.push("Weight gain is limited to 0.5 kg a week to favour lean gain.");
  }

  const sign = direction === "lose" ? -1 : direction === "gain" ? 1 : 0;
  let kcal = maintenance + (sign * pace * KCAL_PER_KG) / 7;
  const floor = CALORIE_FLOOR[sex!];
  if (kcal < floor) {
    kcal = floor;
    notes.push(
      `Calories raised to ${floor.toLocaleString("en-US")} kcal, the usual safe minimum without medical supervision. Progress will be slower.`,
    );
  }
  kcal = roundTo(kcal, 10);
  const dailyAdjustment = Math.round(kcal - maintenance);
  const weeklyChangeKg =
    direction === "maintain"
      ? 0
      : Math.round(((Math.abs(dailyAdjustment) * 7) / KCAL_PER_KG) * 100) /
        100;
  const weeksToGoal =
    weeklyChangeKg > 0 ? Math.ceil(Math.abs(change) / weeklyChangeKg) : null;
  const goalDate =
    weeksToGoal === null
      ? null
      : localDate(
          new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + weeksToGoal * 7,
            12,
          ),
        );

  const proteinWeight = direction === "lose" ? target : weight;
  const protein = Math.round(1.6 * proteinWeight);
  const fat = Math.round((kcal * 0.3) / 9);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const fiber = Math.round((kcal / 1000) * 14);
  const metres = height / 100;
  if (direction === "lose" && target / metres ** 2 < 18.5)
    notes.push(
      "Your target is below the healthy BMI range (18.5) for your height. Consider discussing it with a doctor.",
    );
  return {
    kcal,
    protein,
    carbs,
    fat,
    fiber,
    bmr: Math.round(bmr),
    maintenance: Math.round(maintenance),
    dailyAdjustment,
    direction,
    weeklyChangeKg,
    weeksToGoal,
    goalDate,
    bmi: Math.round((weight / metres ** 2) * 10) / 10,
    targetBmi: Math.round((target / metres ** 2) * 10) / 10,
    notes,
  };
}

export function directionLabel(targets: Targets): string {
  return targets.direction === "maintain"
    ? "Maintain your weight"
    : `${targets.direction === "lose" ? "Lose" : "Gain"} about ${targets.weeklyChangeKg} kg a week`;
}
