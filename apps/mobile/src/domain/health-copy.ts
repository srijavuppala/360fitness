import type { NoticeKey, NutrientKey } from "./health-context";
import type { Reason, RecommendationStatus } from "./nutrition-goal";

/** User-facing wording. Kept apart from components so it can be reviewed in one place. */
export const DISCLAIMER =
  "360Fitness provides general nutrition and wellness estimates based on the information you share. These estimates are not medical advice and are not intended to diagnose, treat or manage any medical condition. Health conditions can significantly affect nutritional requirements. Please consult your doctor or registered dietitian before making dietary changes, especially if you have an existing medical condition.";

export const KIDNEY_DISCLAIMER =
  "Protein requirements for people with kidney conditions vary depending on individual clinical circumstances. Please consult your nephrologist or registered dietitian for an appropriate protein target. 360Fitness does not independently determine medical protein requirements.";

export const HEALTH_INTRO =
  "Share any health conditions that may affect your nutrition. This helps us determine whether your general nutrition estimates are appropriate.";

/** The one notice shown before the questionnaire. Longer privacy text stays off this screen. */
export const HEALTH_NOTICE =
  "Your nutrition targets are general estimates, not medical advice. If you have a health condition, consult your doctor or registered dietitian before making dietary changes.";

/** Shown on the daily target when the user has selected a health condition. */
export const DASHBOARD_HEALTH_NOTICE =
  "General nutrition estimate, not medical advice. Consult your doctor or registered dietitian if you have a health condition.";

export const CONSENT_NOTICE =
  "If you continue, the answers you choose to give here are saved on this device only, to decide whether your general nutrition estimate is suitable to show. They are not sent to our servers, shared, or used in analytics. You can skip any question, change your answers, or remove all of them at any time in Profile. You can back them up to your account later if you want to, with a separate choice.";

export const statusLabel: Record<RecommendationStatus, string> = {
  GENERAL_ESTIMATE: "General estimate",
  CONDITION_SENSITIVE: "Some targets may need personalising",
  CLINICIAN_DEFINED: "Some targets come from your care team",
  INSUFFICIENT_DATA: "More information needed",
  OUT_OF_SCOPE: "Not available in this app yet",
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
    "Your health information may affect your protein requirements. Your general fitness-based estimate may not be suitable for your circumstances, so protein is shown as “needs personalisation”. This is intentional, not an error.",
  "kidney-dialysis-unknown":
    "Protein needs can be lower before dialysis and higher during dialysis. Tell us whether you are on dialysis, or enter the target from your kidney care team. Until then, protein stays as “needs personalisation”.",
  sensitive:
    "Because of a condition you selected, some targets may need a personalised value. We show a general starting estimate and flag it. Please check it with your doctor or registered dietitian.",
  "general-condition":
    "You told us about a health condition. This is a general estimate, and your doctor or registered dietitian can tell you whether it suits you.",
  guidance:
    "You mentioned dietary advice from a healthcare professional. Please follow their advice where it differs from this general estimate.",
  expired:
    "The target from your care team is past its review date, so it is no longer shown. Please check for an updated target.",
  "life-stage":
    "Needs are different during pregnancy and breastfeeding, and this app does not estimate them. Please talk to your doctor, midwife or registered dietitian.",
  unknown:
    "We don’t have health information from you, so this is a general estimate. It does not take any health condition into account.",
};

export const reasonText: Partial<Record<Reason, string>> = {
  MISSING_EXACT_AGE:
    "Add your exact age so we can calculate one personalised estimate.",
  MISSING_EQUATION_SET:
    "Choose a calorie equation (Female or Male) so we can calculate one estimate.",
  MISSING_BODY_STATS: "Add your height and current weight.",
  MISSING_ACTIVITY: "Tell us your typical activity level.",
  MISSING_GOAL: "Add your target weight (or your current weight to maintain).",
  UNDER_19:
    "This app’s estimates are for adults 19 and over. Please speak to a doctor or registered dietitian for nutrition guidance.",
  LIFE_STAGE_PATH_REQUIRED:
    "Pregnancy and breastfeeding need specialised guidance. Please talk to your doctor, midwife or registered dietitian.",
  GOAL_DIRECTION_INVALID:
    "We couldn’t support the weight goal you chose, so no estimate is shown.",
  CONDITION_RULE_CONFLICT:
    "The conditions you selected need different guidance, so no personalised target was calculated. Please check with your doctor or registered dietitian.",
};

export function explanation(status: RecommendationStatus): string {
  switch (status) {
    case "CLINICIAN_DEFINED":
      return "Targets marked “Needs personalisation” are withheld on purpose until your healthcare professional advises you. Targets marked “From your care team” were entered by you and are not checked by 360Fitness.";
    case "CONDITION_SENSITIVE":
      return "These are general starting estimates. Targets marked “Check with your care team” may need a personalised value.";
    case "INSUFFICIENT_DATA":
      return "We can’t give one personalised estimate yet. A clear estimate needs the details below.";
    case "OUT_OF_SCOPE":
      return "We don’t estimate nutrition for your situation. This is intentional, not an error.";
    default:
      return "These are general starting estimates for adults, not medical advice. Check your weight trend after 2–4 weeks and update your profile if it changes.";
  }
}
