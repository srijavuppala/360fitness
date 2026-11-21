import { Condition, HealthProfile } from "./health";
import {
  ContextReason,
  evaluateHealthContext,
  HealthContext,
  NoticeKey,
  NutrientKey,
} from "./health-context";
import { ProfileAnswers } from "./profile";
import {
  estimateTargets,
  FORMULA_VERSION,
  GOAL_MODEL_VERSION,
  MACRO_POLICY_VERSION,
  ReasonCode,
  Targets,
} from "./targets";

/** Bump when the composition rules or the status table change. */
export const NUTRITION_GOAL_VERSION = "health-aware-3";

/** The states approved by the Nutrient Estimate Calculation and Testing Guide. */
export type RecommendationStatus =
  /** Complete inputs and no blocking condition. */
  | "GENERAL_ESTIMATE"
  /** A condition may change some targets: unaffected ones shown, others flagged. */
  | "CONDITION_SENSITIVE"
  /** A safe number depends on clinical details: product target suppressed. */
  | "CLINICIAN_DEFINED"
  /** A required input is missing or invalid. */
  | "INSUFFICIENT_DATA"
  /** Under 19, pregnancy or breastfeeding: needs a different pathway. */
  | "OUT_OF_SCOPE";
export type TargetSource = "APP_ESTIMATE" | "CLINICIAN_PROVIDED";
export type Reason = ReasonCode | ContextReason;
export type DisplayedTarget = {
  value: number;
  source: TargetSource;
  /** True when a condition may change this value; check with the care team. */
  flagged: boolean;
  /** Clinician provenance, shown next to a clinician-provided value. */
  providedBy?: string;
};

export type GoalInputs = {
  ageYears: number | null;
  heightCm: number | null;
  weightKg: number | null;
  equationSet: string | null;
  activity: string | null;
};

export type NutritionGoalResult = {
  status: RecommendationStatus;
  /** The unchanged general estimate, or null when none could be produced. */
  generalTarget: Targets | null;
  /** What may be shown as the user's goal; null entries are intentionally withheld. */
  displayedTarget: Record<NutrientKey, DisplayedTarget | null>;
  withheld: NutrientKey[];
  flagged: NutrientKey[];
  /** Maintenance range when only an age range or equation is unknown. */
  kcalRange: { min: number; max: number } | null;
  requiresProfessionalReview: boolean;
  /** Where the headline recommendation comes from. */
  source: TargetSource;
  reasons: Reason[];
  notices: NoticeKey[];
  assessment: HealthContext["assessment"];
  /** Conditions that matched an approved rule. Exclusive answers are omitted. */
  selectedConditions: Condition[];
  /** Nutrients whose condition rules disagree. No averaged target is produced. */
  conflicts: NutrientKey[];
  formulaVersion: string;
  policyVersion: string;
  goalModelVersion: string;
  calculationVersion: string;
  /** Non-health inputs used, for traceability. No health answers are copied. */
  inputs: GoalInputs;
  calculatedAt: string;
};

const nutrientKeys: NutrientKey[] = [
  "kcal",
  "protein",
  "carbs",
  "fat",
  "fiber",
];

function snapshot(answers: ProfileAnswers): GoalInputs {
  const num = (v: unknown) =>
    typeof v === "string" && v.trim() ? Number(v) : null;
  const text = (v: unknown) => (typeof v === "string" ? v : null);
  return {
    ageYears: num(answers.ageYears),
    heightCm: num(answers.heightCm),
    weightKg: num(answers.currentWeightKg),
    equationSet: text(answers.sex),
    activity: text(answers.activity),
  };
}

/**
 * Compose the final goal from three separate steps: the general calculation
 * (`estimateTargets`), the health-context evaluation, and the presentation
 * rules here. Fails closed: whenever a number cannot be supported, it is not
 * shown. Recalculation is cheap and pure, so only user input is persisted.
 */
export function buildNutritionGoal(
  answers: ProfileAnswers,
  health: HealthProfile | undefined,
  now = new Date(),
): NutritionGoalResult {
  const context = evaluateHealthContext(health, now);
  const none = Object.fromEntries(
    nutrientKeys.map((key) => [key, null]),
  ) as NutritionGoalResult["displayedTarget"];
  const base = {
    generalTarget: null,
    displayedTarget: none,
    withheld: [] as NutrientKey[],
    flagged: [] as NutrientKey[],
    kcalRange: null,
    requiresProfessionalReview: false,
    source: "APP_ESTIMATE" as TargetSource,
    notices: context.notices,
    assessment: context.assessment,
    selectedConditions: context.conditions,
    conflicts: context.conflicts,
    formulaVersion: FORMULA_VERSION,
    policyVersion: MACRO_POLICY_VERSION,
    goalModelVersion: GOAL_MODEL_VERSION,
    calculationVersion: NUTRITION_GOAL_VERSION,
    inputs: snapshot(answers),
    calculatedAt: now.toISOString(),
  };

  if (context.lifeStageOutOfScope)
    return {
      ...base,
      status: "OUT_OF_SCOPE",
      reasons: ["LIFE_STAGE_PATH_REQUIRED"],
      requiresProfessionalReview: true,
    };

  const outcome = estimateTargets(answers, now, {
    // A clinician-defined nutrient, or disagreeing condition rules, means a
    // weight-change target is not safe to automate. Maintenance is kept.
    blockWeightGoal:
      context.clinicianDefined.length > 0 || context.conflicts.length > 0,
  });
  if (outcome.status === "OUT_OF_SCOPE")
    return {
      ...base,
      status: "OUT_OF_SCOPE",
      reasons: outcome.reasons,
      requiresProfessionalReview: true,
    };
  if (outcome.status === "INSUFFICIENT_DATA")
    return {
      ...base,
      status: "INSUFFICIENT_DATA",
      reasons: outcome.reasons,
      kcalRange: outcome.kcalRange,
    };

  const general = outcome.targets;
  const displayedTarget = {} as NutritionGoalResult["displayedTarget"];
  for (const key of nutrientKeys) {
    if (context.impact[key] === "CLINICIAN_DEFINED") {
      const clinician = context.clinicianValues[key];
      displayedTarget[key] = clinician
        ? {
            value: clinician.value,
            source: "CLINICIAN_PROVIDED",
            flagged: false,
            providedBy: clinician.source,
          }
        : // Product decision: always show a number. Without a clinician
          // value, the general estimate is shown and flagged for review.
          { value: general[key], source: "APP_ESTIMATE", flagged: true };
    } else
      displayedTarget[key] = {
        value: general[key],
        source: "APP_ESTIMATE",
        flagged: context.impact[key] === "CONDITION_SENSITIVE",
      };
  }
  const withheld = nutrientKeys.filter((key) => displayedTarget[key] === null);
  const flagged = nutrientKeys.filter((key) => displayedTarget[key]?.flagged);
  const clinicianProvided = nutrientKeys.some(
    (key) => displayedTarget[key]?.source === "CLINICIAN_PROVIDED",
  );
  const declared =
    context.assessment === "CONDITIONS_DECLARED" ||
    context.notices.includes("guidance");

  const status: RecommendationStatus =
    context.clinicianDefined.length > 0
      ? "CLINICIAN_DEFINED"
      : flagged.length > 0 || declared
        ? "CONDITION_SENSITIVE"
        : "GENERAL_ESTIMATE";

  return {
    ...base,
    status,
    generalTarget: general,
    displayedTarget,
    withheld,
    flagged,
    requiresProfessionalReview: flagged.length > 0 && !clinicianProvided,
    source: clinicianProvided ? "CLINICIAN_PROVIDED" : "APP_ESTIMATE",
    reasons: [...new Set<Reason>([...outcome.reasons, ...context.reasons])],
  };
}

/** Value to show for a goal, or null when it is intentionally withheld. */
export function shownValue(
  goal: NutritionGoalResult,
  key: NutrientKey,
): number | null {
  return goal.displayedTarget[key]?.value ?? null;
}

/**
 * Progress of calories eaten against the same calorie target the dashboard shows.
 * Returns null when there is no target, so the ring can fall back to meal check-in.
 */
export function calorieRing(
  eatenKcal: number | null,
  targetKcal: number | null,
): {
  eaten: number;
  target: number;
  percent: number | null;
  remaining: number | null;
} | null {
  if (targetKcal === null || !(targetKcal > 0)) return null;
  return {
    eaten: eatenKcal ?? 0,
    target: targetKcal,
    percent:
      eatenKcal === null ? null : Math.round((eatenKcal / targetKcal) * 100),
    remaining: eatenKcal === null ? null : targetKcal - eatenKcal,
  };
}
