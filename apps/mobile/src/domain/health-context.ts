import {
  Condition,
  exclusiveConditions,
  HealthProfile,
  KIDNEY,
} from "./health";

/**
 * Health-context evaluation. This layer answers one question: given what the
 * user chose to tell us, may the general fitness estimate be shown as is?
 *
 * It computes no nutrition values and contains no medical thresholds or
 * formulas. All it holds is a reviewable table of which declared conditions
 * make which general estimates unsuitable to show on their own. Changes to
 * that table are product/clinical decisions and should be reviewed as such.
 */
export type NutrientKey = "kcal" | "protein" | "carbs" | "fat" | "fiber";

export type Assessment =
  /** No health answers were given (never asked, skipped, or no consent). */
  | "NOT_ASSESSED"
  /** The user declined to say, or chose answers that leave the picture open. */
  | "UNDETERMINED"
  | "NO_CONDITIONS_DECLARED"
  | "CONDITIONS_DECLARED";

export type ConditionRule = {
  /** General estimates that may not suit this condition and are withheld. */
  withhold: readonly NutrientKey[];
  /**
   * Withheld nutrients for which the user may enter a value given by their
   * healthcare professional. The app displays it as theirs, never as its own.
   */
  clinicianEditable: readonly NutrientKey[];
  /** Key into `notices` for the explanation shown to the user. */
  notice: NoticeKey;
};

export const conditionRules: Partial<Record<Condition, ConditionRule>> = {
  // Kidney-related needs vary by clinical circumstances, so no protein
  // estimate is shown. Carbohydrate is derived from protein in the general
  // calculation, so it is withheld with it.
  [KIDNEY]: {
    withhold: ["protein", "carbs"],
    clinicianEditable: ["protein"],
    notice: "kidney",
  },
  "Diabetes (Type 1 / Type 2)": {
    withhold: [],
    clinicianEditable: [],
    notice: "general-condition",
  },
  "High blood pressure (Hypertension)": {
    withhold: [],
    clinicianEditable: [],
    notice: "general-condition",
  },
  "Liver-related condition": {
    withhold: [],
    clinicianEditable: [],
    notice: "general-condition",
  },
  "Thyroid-related condition": {
    withhold: [],
    clinicianEditable: [],
    notice: "general-condition",
  },
  "Heart-related condition": {
    withhold: [],
    clinicianEditable: [],
    notice: "general-condition",
  },
  "Other health condition": {
    withhold: [],
    clinicianEditable: [],
    notice: "general-condition",
  },
};

export type NoticeKey = "kidney" | "general-condition" | "guidance" | "unknown";

export type HealthContext = {
  assessment: Assessment;
  /** Declared conditions that have an entry in the rules table. */
  conditions: Condition[];
  withheld: NutrientKey[];
  /** Subset of `withheld` the user may fill from clinician advice. */
  clinicianEditable: NutrientKey[];
  notices: NoticeKey[];
  /** True when the general estimate should not be presented as personalised. */
  requiresProfessionalReview: boolean;
  /** Clinician-provided values that apply to the current conditions. */
  clinicianValues: Partial<Record<NutrientKey, { value: number; enteredAt: string }>>;
};

const unique = <T>(items: T[]) => [...new Set(items)];

/**
 * Missing health data is never read as "no conditions": it is NOT_ASSESSED.
 * Precedence: withheld estimates > advisory notices > undetermined > general.
 */
export function evaluateHealthContext(
  health: HealthProfile | undefined,
): HealthContext {
  const empty: HealthContext = {
    assessment: "NOT_ASSESSED",
    conditions: [],
    withheld: [],
    clinicianEditable: [],
    notices: [],
    requiresProfessionalReview: false,
    clinicianValues: {},
  };
  if (!health) return empty;

  const declared = (health.conditions ?? []).filter(
    (c) => !exclusiveConditions.includes(c),
  );
  const rules = declared.flatMap((c) => {
    const rule = conditionRules[c];
    return rule ? [{ condition: c, rule }] : [];
  });
  const withheld = unique(rules.flatMap(({ rule }) => [...rule.withhold]));
  const clinicianEditable = unique(
    rules.flatMap(({ rule }) => [...rule.clinicianEditable]),
  );
  const notices = unique(rules.map(({ rule }) => rule.notice));
  const hasGuidance =
    health.professionalGuidance === "Yes" ||
    health.dietaryRestrictions === "Yes";
  if (hasGuidance) notices.push("guidance");

  const clinicianValues: HealthContext["clinicianValues"] = {};
  if (health.clinicianProtein && clinicianEditable.includes("protein"))
    clinicianValues.protein = {
      value: health.clinicianProtein.grams,
      enteredAt: health.clinicianProtein.enteredAt,
    };

  const answered = health.conditions !== undefined;
  const optedOut = health.conditions?.includes("Prefer not to disclose");
  const unsure = [health.dietaryRestrictions, health.professionalGuidance].some(
    (a) => a === "Not sure" || a === "Prefer not to disclose",
  );

  let assessment: Assessment;
  if (declared.length) assessment = "CONDITIONS_DECLARED";
  else if (!answered || optedOut) assessment = "UNDETERMINED";
  else assessment = unsure ? "UNDETERMINED" : "NO_CONDITIONS_DECLARED";
  // A skipped section (consent given but nothing answered) is still unassessed.
  if (
    !answered &&
    !health.dietaryRestrictions &&
    !health.professionalGuidance
  )
    assessment = "NOT_ASSESSED";
  if (assessment === "UNDETERMINED" || assessment === "NOT_ASSESSED")
    notices.push("unknown");

  return {
    assessment,
    conditions: rules.map(({ condition }) => condition),
    withheld,
    clinicianEditable,
    notices: unique(notices),
    requiresProfessionalReview: withheld.length > 0,
    clinicianValues,
  };
}
