import { HealthProfile } from "./health";
import {
  evaluateHealthContext,
  HealthContext,
  NoticeKey,
  NutrientKey,
} from "./health-context";
import { ProfileAnswers } from "./profile";
import { calculateTargets, Targets } from "./targets";

/** Bump when the composition rules or the status table change. */
export const NUTRITION_GOAL_VERSION = "health-aware-1";

export type NutritionTargets = Record<NutrientKey, number>;
export type RecommendationStatus =
  /** Health information was given and declares nothing that affects the estimate. */
  | "GENERAL_RECOMMENDATION"
  /** A condition was declared: the general estimate is shown with a care-team notice. */
  | "GENERAL_WITH_ADVISORY"
  /** Not enough health information: the general estimate is shown as general only. */
  | "INSUFFICIENT_INFORMATION"
  /** Some estimates are withheld until the user's healthcare professional advises. */
  | "REVIEW_REQUIRED"
  /** A withheld value was supplied by the user from their healthcare professional. */
  | "CLINICIAN_PROVIDED";
export type TargetSource = "APP_ESTIMATE" | "CLINICIAN_PROVIDED";
export type DisplayedTarget = { value: number; source: TargetSource };

export type NutritionGoalResult = {
  /** The unchanged estimate from `calculateTargets` (energy, macros and notes). */
  generalTarget: Targets;
  /** What may be shown as the user's goal; null entries are intentionally withheld. */
  displayedTarget: Record<NutrientKey, DisplayedTarget | null>;
  withheld: NutrientKey[];
  recommendationStatus: RecommendationStatus;
  requiresProfessionalReview: boolean;
  /** Where the headline recommendation comes from. */
  source: TargetSource;
  notices: NoticeKey[];
  assessment: HealthContext["assessment"];
  calculationVersion: string;
  calculatedAt: string;
};

const nutrientKeys: NutrientKey[] = ["kcal", "protein", "carbs", "fat", "fiber"];

/**
 * Compose the final goal from three separate steps: the existing general
 * calculation, the health-context evaluation, and the presentation rules here.
 * Recalculation is cheap and pure, so nothing is persisted but user input.
 */
export function buildNutritionGoal(
  answers: ProfileAnswers,
  health: HealthProfile | undefined,
  now = new Date(),
): NutritionGoalResult | null {
  const general = calculateTargets(answers, now);
  if (!general) return null;
  const context = evaluateHealthContext(health);

  const displayedTarget = {} as NutritionGoalResult["displayedTarget"];
  for (const key of nutrientKeys) {
    const clinician = context.clinicianValues[key];
    displayedTarget[key] = context.withheld.includes(key)
      ? clinician
        ? { value: clinician.value, source: "CLINICIAN_PROVIDED" }
        : null
      : { value: general[key], source: "APP_ESTIMATE" };
  }
  const withheld = nutrientKeys.filter((key) => displayedTarget[key] === null);
  const clinicianProvided = nutrientKeys.some(
    (key) => displayedTarget[key]?.source === "CLINICIAN_PROVIDED",
  );

  const advisory = context.notices.some((n) => n !== "unknown");
  const status: RecommendationStatus = clinicianProvided
    ? "CLINICIAN_PROVIDED"
    : context.requiresProfessionalReview
      ? "REVIEW_REQUIRED"
      : advisory
        ? "GENERAL_WITH_ADVISORY"
        : context.assessment === "NO_CONDITIONS_DECLARED"
          ? "GENERAL_RECOMMENDATION"
          : "INSUFFICIENT_INFORMATION";

  return {
    generalTarget: general,
    displayedTarget,
    withheld,
    recommendationStatus: status,
    requiresProfessionalReview: withheld.length > 0,
    source: clinicianProvided ? "CLINICIAN_PROVIDED" : "APP_ESTIMATE",
    notices: context.notices,
    assessment: context.assessment,
    calculationVersion: NUTRITION_GOAL_VERSION,
    calculatedAt: now.toISOString(),
  };
}

/** Value to show for a goal, or null when it is intentionally withheld. */
export function shownValue(
  goal: NutritionGoalResult,
  key: NutrientKey,
): number | null {
  return goal.displayedTarget[key]?.value ?? null;
}
