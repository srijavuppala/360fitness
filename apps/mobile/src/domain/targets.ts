import { localDate } from "./meals";
import {
  AnswerKey,
  MAINTAIN_TOLERANCE_KG,
  options,
  ProfileAnswers,
  weightChangeKg,
} from "./profile";

/**
 * General calorie and macro estimates for healthy adults (19+), following
 * docs/health-aware-nutrition-goals.md and the Nutrient Estimate Calculation
 * and Testing Guide v1.0:
 *  - maintenance energy: 2023 Dietary Reference Intakes adult EER equations;
 *  - weight goal: transparent v1 fallback, capped at +/-15% of EER;
 *  - macros: configurable 18% protein / 30% fat / 52% carbohydrate policy.
 * Nothing here knows about health conditions; routing lives in health-context.
 * Pending registered-dietitian sign-off, as the guide requires.
 */
export const FORMULA_VERSION = "DRI_EER_2023_v1";
export const MACRO_POLICY_VERSION = "macro_18_52_30_v1";
export const GOAL_MODEL_VERSION = "capped_15pct_v1";

/** Approximate energy in one kg of body-weight change. An estimate, not a law. */
export const KCAL_PER_KG = 7700;
const MAX_GOAL_SHARE_OF_EER = 0.15;
const ADULT_MIN_AGE = 19;
const BMI_ROUTING_FLOOR = 18.5;
const PROTEIN_SHARE = 0.18;
const FAT_SHARE = 0.3;
const CARB_SHARE = 0.52;
const FIBER_G_PER_1000_KCAL = 14;

type EquationSet = "Male" | "Female";
export type ActivityCategory =
  | "INACTIVE"
  | "LOW_ACTIVE"
  | "ACTIVE"
  | "VERY_ACTIVE";
type Pace = (typeof options.weeklyPace)[number];

/** [intercept, age, height cm, weight kg]; DRI 2023 adult EER, kcal/day. */
const EER_COEFFICIENTS: Record<
  EquationSet,
  Record<ActivityCategory, readonly [number, number, number, number]>
> = {
  Male: {
    INACTIVE: [753.07, -10.83, 6.5, 14.1],
    LOW_ACTIVE: [581.47, -10.83, 8.3, 14.94],
    ACTIVE: [1004.82, -10.83, 6.52, 15.91],
    VERY_ACTIVE: [-517.88, -10.83, 15.61, 19.11],
  },
  Female: {
    INACTIVE: [584.9, -7.01, 5.72, 11.71],
    LOW_ACTIVE: [575.77, -7.01, 6.6, 12.14],
    ACTIVE: [710.25, -7.01, 6.54, 12.34],
    VERY_ACTIVE: [511.83, -7.01, 9.07, 12.56],
  },
};
/**
 * Questionnaire mapping from the onboarding answer to an EER category. The
 * categories describe total energy expenditure, so this mapping needs
 * clinical review. "Varies" is not guessed silently: see ACTIVITY_UNCERTAIN.
 */
const ACTIVITY_CATEGORY: Record<
  (typeof options.activity)[number],
  ActivityCategory
> = {
  "Mostly sitting": "INACTIVE",
  "Lightly active": "LOW_ACTIVE",
  "Moderately active": "ACTIVE",
  "Very active": "VERY_ACTIVE",
  "Varies day to day": "LOW_ACTIVE",
};
const PACE_KG: Record<Pace, number> = {
  "Gentle · 0.25 kg a week": 0.25,
  "Steady · 0.5 kg a week": 0.5,
  "Faster · 0.75 kg a week": 0.75,
};
/** Completed-year bounds of the legacy onboarding age ranges (adults only). */
const BAND_YEARS: Record<string, readonly [number, number]> = {
  "18–24": [ADULT_MIN_AGE, 24],
  "25–34": [25, 34],
  "35–44": [35, 44],
  "45–54": [45, 54],
  "55–64": [55, 64],
};

export type Direction = "lose" | "gain" | "maintain";
export type ReasonCode =
  | "UNDER_19"
  | "MISSING_EXACT_AGE"
  | "MISSING_EQUATION_SET"
  | "MISSING_BODY_STATS"
  | "MISSING_ACTIVITY"
  | "MISSING_GOAL"
  | "ACTIVITY_UNCERTAIN"
  | "GOAL_CAPPED"
  | "GOAL_BLOCKED_BMI"
  | "GOAL_BLOCKED_CLINICIAN_DEFINED"
  | "GOAL_DIRECTION_INVALID";

export type Targets = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  maintenance: number;
  /** Negative for a deficit, positive for a surplus. */
  dailyAdjustment: number;
  direction: Direction;
  /** Estimated kg per week after the cap; 0 when maintaining. */
  weeklyChangeKg: number;
  weeksToGoal: number | null;
  goalDate: string | null;
  bmi: number;
  targetBmi: number;
  notes: string[];
  formulaVersion: string;
  policyVersion: string;
  goalModelVersion: string;
};

export type TargetsOutcome =
  | { status: "OK"; targets: Targets; reasons: ReasonCode[] }
  | {
      status: "INSUFFICIENT_DATA";
      reasons: ReasonCode[];
      /** Maintenance range from the possible ages / equation sets, if bounded. */
      kcalRange: { min: number; max: number } | null;
      missing: AnswerKey[];
    }
  | { status: "OUT_OF_SCOPE"; reasons: ReasonCode[] };

export type EstimateOptions = {
  /** A condition or life-stage rule requires clinician-defined nutrition. */
  blockWeightGoal?: boolean;
};

/** 2023 DRI adult EER, kcal/day, full precision. */
export function eer(
  set: EquationSet,
  activity: ActivityCategory,
  ageYears: number,
  heightCm: number,
  weightKg: number,
): number {
  const [a, b, h, w] = EER_COEFFICIENTS[set][activity];
  return a + b * ageYears + h * heightCm + w * weightKg;
}

/** Exact completed years, or null when only an age range (or nothing) is known. */
export function exactAge(answers: ProfileAnswers): number | null {
  const value = answers.ageYears;
  if (typeof value !== "string" || !/^\d{1,3}$/.test(value.trim())) return null;
  const years = Number(value.trim());
  return years >= 5 && years <= 120 ? years : null;
}

export function maintenanceEnergy(
  answers: ProfileAnswers,
  age: number,
): number | null {
  const height = Number(answers.heightCm);
  const weight = Number(answers.currentWeightKg);
  const set = answers.sex as EquationSet;
  const activity = ACTIVITY_CATEGORY[answers.activity as never];
  if (
    !(set === "Male" || set === "Female") ||
    !activity ||
    !(height >= 100 && height <= 250) ||
    !(weight >= 25 && weight <= 350)
  )
    return null;
  return eer(set, activity, age, height, weight);
}

/**
 * Estimate energy and macros, or explain why no single number can be given.
 * Pure and deterministic: the same inputs and versions give the same result.
 */
export function estimateTargets(
  answers: ProfileAnswers,
  now = new Date(),
  settings: EstimateOptions = {},
): TargetsOutcome {
  const years = exactAge(answers);
  if (answers.age === "Under 18" || (years !== null && years < ADULT_MIN_AGE))
    return { status: "OUT_OF_SCOPE", reasons: ["UNDER_19"] };

  const height = Number(answers.heightCm);
  const weight = Number(answers.currentWeightKg);
  const change = weightChangeKg(answers);
  const reasons: ReasonCode[] = [];
  const missing: AnswerKey[] = [];
  if (!(height >= 100 && height <= 250) || !(weight >= 25 && weight <= 350)) {
    reasons.push("MISSING_BODY_STATS");
    missing.push("heightCm", "currentWeightKg");
  }
  if (
    typeof answers.activity !== "string" ||
    !(answers.activity in ACTIVITY_CATEGORY)
  ) {
    reasons.push("MISSING_ACTIVITY");
    missing.push("activity");
  }
  if (change === null) {
    reasons.push("MISSING_GOAL");
    missing.push("targetWeightKg");
  }
  if (reasons.length)
    return { status: "INSUFFICIENT_DATA", reasons, kcalRange: null, missing };

  const set = answers.sex === "Male" || answers.sex === "Female" ? answers.sex : null;
  if (years === null) {
    reasons.push("MISSING_EXACT_AGE");
    missing.push("ageYears");
  }
  if (set === null) {
    reasons.push("MISSING_EQUATION_SET");
    missing.push("sex");
  }
  if (years === null || set === null) {
    // Show a clearly bounded range only when every unknown has known limits.
    const band = BAND_YEARS[answers.age as string];
    const ages = years !== null ? [years] : band ? [band[0], band[1]] : null;
    const sets: EquationSet[] = set ? [set] : ["Male", "Female"];
    const category = ACTIVITY_CATEGORY[answers.activity as never];
    const values = ages
      ? ages.flatMap((age) => sets.map((s) => eer(s, category, age, height, weight)))
      : [];
    return {
      status: "INSUFFICIENT_DATA",
      reasons,
      kcalRange: values.length
        ? {
            min: Math.round(Math.min(...values)),
            max: Math.round(Math.max(...values)),
          }
        : null,
      missing,
    };
  }

  const category = ACTIVITY_CATEGORY[answers.activity as never];
  if (answers.activity === "Varies day to day") reasons.push("ACTIVITY_UNCERTAIN");
  const maintenance = eer(set, category, years, height, weight);
  const metres = height / 100;
  const bmi = weight / metres ** 2;
  const target = weight + change!;
  const notes: string[] = [];
  if (reasons.includes("ACTIVITY_UNCERTAIN"))
    notes.push(
      "Your activity varies, so we used the “low active” group. Check your weight trend after 2–4 weeks and update your profile.",
    );

  let direction: Direction =
    Math.abs(change!) <= MAINTAIN_TOLERANCE_KG
      ? "maintain"
      : change! < 0
        ? "lose"
        : "gain";
  if (direction !== "maintain" && bmi < BMI_ROUTING_FLOOR) {
    direction = "maintain";
    reasons.push("GOAL_BLOCKED_BMI");
    notes.push(
      "Your current weight is below a typical healthy range for your height, so we show maintenance only. Please talk to a doctor or registered dietitian before trying to change your weight.",
    );
  } else if (direction !== "maintain" && settings.blockWeightGoal) {
    direction = "maintain";
    reasons.push("GOAL_BLOCKED_CLINICIAN_DEFINED");
    notes.push(
      "Because some of your nutrition needs are set by your care team, we show maintenance energy only and do not estimate a weight-change target.",
    );
  }

  let delta = 0;
  if (direction !== "maintain") {
    const pace = PACE_KG[answers.weeklyPace as Pace] ?? 0.5;
    const requested = (direction === "lose" ? -1 : 1) * ((pace * KCAL_PER_KG) / 7);
    const limit = maintenance * MAX_GOAL_SHARE_OF_EER;
    delta = Math.max(-limit, Math.min(limit, requested));
    if (delta !== requested) {
      reasons.push("GOAL_CAPPED");
      notes.push(
        `Your requested pace was limited to the supported rate of about ${Math.round(((Math.abs(delta) * 7) / KCAL_PER_KG) * 100) / 100} kg a week.`,
      );
    }
    if ((direction === "gain" && delta <= 0) || (direction === "lose" && delta >= 0))
      return {
        status: "INSUFFICIENT_DATA",
        reasons: ["GOAL_DIRECTION_INVALID"],
        kcalRange: null,
        missing: [],
      };
  }
  const energy = maintenance + delta;
  const kcal = Math.round(energy);
  const dailyAdjustment = Math.round(energy - maintenance);
  const weeklyChangeKg =
    direction === "maintain"
      ? 0
      : Math.round(((Math.abs(delta) * 7) / KCAL_PER_KG) * 100) / 100;
  const weeksToGoal =
    weeklyChangeKg > 0 ? Math.ceil(Math.abs(change!) / weeklyChangeKg) : null;
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
  if (direction === "lose" && target / metres ** 2 < BMI_ROUTING_FLOOR)
    notes.push(
      "Your target weight is below a typical healthy range for your height. Consider discussing it with a doctor or registered dietitian.",
    );

  return {
    status: "OK",
    reasons,
    targets: {
      kcal,
      // Grams come from unrounded energy; only the display is rounded.
      protein: Math.round((energy * PROTEIN_SHARE) / 4),
      carbs: Math.round((energy * CARB_SHARE) / 4),
      fat: Math.round((energy * FAT_SHARE) / 9),
      fiber: Math.round((energy * FIBER_G_PER_1000_KCAL) / 1000),
      maintenance: Math.round(maintenance),
      dailyAdjustment,
      direction,
      weeklyChangeKg,
      weeksToGoal,
      goalDate,
      bmi: Math.round(bmi * 10) / 10,
      targetBmi: Math.round((target / metres ** 2) * 10) / 10,
      notes,
      formulaVersion: FORMULA_VERSION,
      policyVersion: MACRO_POLICY_VERSION,
      goalModelVersion: GOAL_MODEL_VERSION,
    },
  };
}

/** Targets when a single personalised estimate is possible, otherwise null. */
export function calculateTargets(
  answers: ProfileAnswers,
  now = new Date(),
  settings: EstimateOptions = {},
): Targets | null {
  const outcome = estimateTargets(answers, now, settings);
  return outcome.status === "OK" ? outcome.targets : null;
}

/** Energy implied by the displayed macros; must stay within tolerance of kcal. */
export function macroEnergy(t: Pick<Targets, "protein" | "carbs" | "fat">) {
  return 4 * t.protein + 4 * t.carbs + 9 * t.fat;
}
export const reconciliationTolerance = (kcal: number) =>
  Math.max(10, kcal * 0.01);

export function directionLabel(targets: Targets): string {
  return targets.direction === "maintain"
    ? "Maintain your weight"
    : `${targets.direction === "lose" ? "Lose" : "Gain"} about ${targets.weeklyChangeKg} kg a week`;
}