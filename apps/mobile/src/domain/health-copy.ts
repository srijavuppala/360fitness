import type { NoticeKey, NutrientKey } from "./health-context";
import type { RecommendationStatus } from "./nutrition-goal";

/** User-facing wording. Kept apart from components so it can be reviewed in one place. */
export const DISCLAIMER =
  "360Fitness provides general nutrition and wellness estimates based on the information you share. These estimates are not medical advice and are not intended to diagnose, treat or manage any medical condition. Health conditions can significantly affect nutritional requirements. Please consult your doctor or registered dietitian before making dietary changes, especially if you have an existing medical condition.";

export const KIDNEY_DISCLAIMER =
  "Protein requirements for people with kidney conditions vary depending on individual clinical circumstances. Please consult your nephrologist or registered dietitian for an appropriate protein target. 360Fitness does not independently determine medical protein requirements.";

export const HEALTH_INTRO =
  "Help us understand your health-related preferences and circumstances so we can provide more relevant nutrition guidance. Your answers are optional and can be updated later.";

export const CONSENT_NOTICE =
  "If you continue, the answers you choose to give here are saved on this device only, to decide whether your general nutrition estimate is suitable to show. They are not sent to our servers, shared, or used in analytics. You can skip any question, change your answers, or remove all of them at any time in Profile. You can back them up to your account later if you want to, with a separate choice.";

export const statusLabel: Record<RecommendationStatus, string> = {
  GENERAL_RECOMMENDATION: "General fitness estimate",
  GENERAL_WITH_ADVISORY: "General estimate · check with your care team",
  INSUFFICIENT_INFORMATION: "General estimate · health information not provided",
  REVIEW_REQUIRED: "Professional review required",
  CLINICIAN_PROVIDED: "Includes a value from your healthcare professional",
};

export const nutrientLabel: Record<NutrientKey, string> = {
  kcal: "Calories",
  protein: "Protein",
  carbs: "Carbohydrates",
  fat: "Fat",
  fiber: "Fiber",
};
export const nutrientUnit: Record<NutrientKey, string> = {
  kcal: "kcal",
  protein: "g",
  carbs: "g",
  fat: "g",
  fiber: "g",
};

export const noticeText: Record<NoticeKey, string> = {
  kidney:
    "Your health information may affect your protein requirements. Your general fitness-based estimate may not be suitable for your circumstances, so we are not showing a personalised protein or carbohydrate target. This is intentional, not an error.",
  "general-condition":
    "You told us about a health condition. This is a general estimate, and your doctor or registered dietitian can tell you whether it suits you.",
  guidance:
    "You mentioned dietary advice from a healthcare professional. Please follow their advice where it differs from this general estimate.",
  unknown:
    "We don’t have health information from you, so this is a general fitness estimate. It does not take any health condition into account.",
};

export function explanation(status: RecommendationStatus): string {
  switch (status) {
    case "REVIEW_REQUIRED":
      return "Compared with your general estimate, the targets marked “Needs review” are withheld until your healthcare professional advises you.";
    case "CLINICIAN_PROVIDED":
      return "Targets marked “From your care team” were entered by you. 360Fitness has not checked them. Other withheld targets still need review.";
    case "GENERAL_WITH_ADVISORY":
      return "Your targets are the same as your general estimate. Please check them with your doctor or registered dietitian.";
    case "INSUFFICIENT_INFORMATION":
      return "Your targets are the same as your general estimate. Adding health information lets us tell you if it may not suit you.";
    default:
      return "Your targets are the same as your general estimate, as you reported no health conditions that affect it.";
  }
}
