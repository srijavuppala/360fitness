import {
  Condition,
  exclusiveConditions,
  HealthProfile,
  KIDNEY,
} from "./health";

/**
 * Health-context evaluation. It answers one question: given what the user
 * chose to tell us, which general estimates may be shown as they are, which
 * need personalising, and which must come from a clinician?
 *
 * It computes no nutrition values and contains no medical thresholds or
 * formulas. All it holds is a reviewable nutrient-impact map. Every condition
 * classifies each nutrient it affects as CONDITION_SENSITIVE or
 * CLINICIAN_DEFINED; conditions are combined only by taking the stricter
 * classification for a nutrient, never by averaging numbers. Entries marked
 * "assumption" need registered-dietitian approval before release.
 */
export type NutrientKey = "kcal" | "protein" | "carbs" | "fat" | "fiber";
export type Impact = "UNAFFECTED" | "CONDITION_SENSITIVE" | "CLINICIAN_DEFINED";

export type Assessment =
  /** No health answers were given (never asked, skipped, or no consent). */
  | "NOT_ASSESSED"
  /** The user declined to say, or chose answers that leave the picture open. */
  | "UNDETERMINED"
  | "NO_CONDITIONS_DECLARED"
  | "CONDITIONS_DECLARED";

export type NoticeKey =
  | "kidney"
  | "kidney-dialysis-unknown"
  | "sensitive"
  | "general-condition"
  | "guidance"
  | "expired"
  | "life-stage"
  | "unknown";

export type ContextReason =
  | "HEALTH_NOT_ASSESSED"
  | "CKD_DIALYSIS_UNKNOWN"
  | "CLINICIAN_TARGET_REQUIRED"
  | "CLINICIAN_TARGET_EXPIRED"
  | "LIFE_STAGE_PATH_REQUIRED"
  | "CONDITION_RULE_CONFLICT";

export type ConditionRule = {
  impacts: Partial<Record<NutrientKey, Exclude<Impact, "UNAFFECTED">>>;
  notice: NoticeKey;
};

export const conditionRules: Partial<Record<Condition, ConditionRule>> = {
  // Protein needs differ before and during dialysis and depend on labs and
  // treatment. The general estimate may be shown and flagged. It is not a
  // kidney-specific protein target, and dialysis status does not change the grams.
  [KIDNEY]: { impacts: { protein: "CLINICIAN_DEFINED" }, notice: "kidney" },
  // Carbohydrate guidance depends on the clinician's plan; no fixed low-carb share.
  "Diabetes (Type 1 / Type 2)": {
    impacts: { carbs: "CONDITION_SENSITIVE" },
    notice: "sensitive",
  },
  // The guide routes liver disease to a clinician pathway, but it does not
  // name which nutrients to change. No gram target is invented.
  "Liver-related condition": { impacts: {}, notice: "general-condition" },
  // Sodium and fluid are not tracked. Hypertension, heart and thyroid have
  // no approved calorie or macro adjustment in the guide.
  "High blood pressure (Hypertension)": {
    impacts: {},
    notice: "general-condition",
  },
  "Heart-related condition": { impacts: {}, notice: "general-condition" },
  "Thyroid-related condition": { impacts: {}, notice: "general-condition" },
  "Other health condition": { impacts: {}, notice: "general-condition" },
};

/** Nutrients for which a clinician-entered value may replace "needs personalisation". */
export const clinicianEditableNutrients: readonly NutrientKey[] = ["protein"];

export type HealthContext = {
  assessment: Assessment;
  conditions: Condition[];
  impact: Record<NutrientKey, Impact>;
  /** CLINICIAN_DEFINED and still without a valid clinician value. */
  withheld: NutrientKey[];
  conditionSensitive: NutrientKey[];
  clinicianDefined: NutrientKey[];
  notices: NoticeKey[];
  reasons: ContextReason[];
  /**
   * Nutrients where two selected conditions assign different impacts.
   * No number is chosen between them.
   */
  conflicts: NutrientKey[];
  /** Pregnancy or breastfeeding: needs a pathway this app does not have. */
  lifeStageOutOfScope: boolean;
  clinicianValues: Partial<
    Record<NutrientKey, { value: number; enteredAt: string; source: string }>
  >;
};

const unique = <T>(items: T[]) => [...new Set(items)];
const rank: Record<Impact, number> = {
  UNAFFECTED: 0,
  CONDITION_SENSITIVE: 1,
  CLINICIAN_DEFINED: 2,
};
const nutrients: NutrientKey[] = ["kcal", "protein", "carbs", "fat", "fiber"];

/**
 * Combine condition rules without averaging or inventing gram targets.
 * A stricter class may replace a weaker one (kidney protein stays
 * clinician-defined when diabetes is also selected). Two different classes
 * on the same nutrient are recorded as a conflict and left clinician-defined
 * so no personalised number is produced.
 */
export function mergeConditionRules(rules: readonly ConditionRule[]): {
  impact: Record<NutrientKey, Impact>;
  conflicts: NutrientKey[];
  notices: NoticeKey[];
} {
  const impact = Object.fromEntries(
    nutrients.map((key) => [key, "UNAFFECTED"]),
  ) as Record<NutrientKey, Impact>;
  const conflicts: NutrientKey[] = [];
  const notices: NoticeKey[] = [];
  const seen: Partial<Record<NutrientKey, Exclude<Impact, "UNAFFECTED">>> = {};
  for (const rule of rules) {
    notices.push(rule.notice);
    for (const key of nutrients) {
      const level = rule.impacts[key];
      if (!level) continue;
      const previous = seen[key];
      if (previous && previous !== level) conflicts.push(key);
      seen[key] = level;
      if (rank[level] > rank[impact[key]]) impact[key] = level;
    }
  }
  for (const key of conflicts) impact[key] = "CLINICIAN_DEFINED";
  return { impact, conflicts: unique(conflicts), notices: unique(notices) };
}

/**
 * Missing health data is never read as "no conditions": it is NOT_ASSESSED.
 * Fails closed for the affected nutrient: an unreadable or expired clinician
 * value is treated as absent, so the nutrient stays withheld.
 */
export function evaluateHealthContext(
  health: HealthProfile | undefined,
  now = new Date(),
): HealthContext {
  const impact = Object.fromEntries(
    nutrients.map((key) => [key, "UNAFFECTED"]),
  ) as Record<NutrientKey, Impact>;
  const context: HealthContext = {
    assessment: "NOT_ASSESSED",
    conditions: [],
    impact,
    withheld: [],
    conditionSensitive: [],
    clinicianDefined: [],
    notices: ["unknown"],
    reasons: ["HEALTH_NOT_ASSESSED"],
    conflicts: [],
    lifeStageOutOfScope: false,
    clinicianValues: {},
  };
  if (!health) return context;

  const reasons: ContextReason[] = [];
  const notices: NoticeKey[] = [];
  if (health.lifeStage === "Pregnant" || health.lifeStage === "Breastfeeding") {
    context.lifeStageOutOfScope = true;
    context.reasons = ["LIFE_STAGE_PATH_REQUIRED"];
    context.notices = ["life-stage"];
    context.conflicts = [];
    context.assessment = "CONDITIONS_DECLARED";
    return context;
  }

  const declared = (health.conditions ?? []).filter(
    (c) => !exclusiveConditions.includes(c),
  );
  const matched = declared.flatMap((c) => {
    const rule = conditionRules[c];
    return rule ? [{ condition: c, rule }] : [];
  });
  const merged = mergeConditionRules(matched.map(({ rule }) => rule));
  for (const key of nutrients) impact[key] = merged.impact[key];
  notices.push(...merged.notices);
  if (merged.conflicts.length) reasons.push("CONDITION_RULE_CONFLICT");
  context.conflicts = merged.conflicts;

  const today = now.toISOString().slice(0, 10);
  const stored = health.clinicianProtein;
  if (stored && impact.protein === "CLINICIAN_DEFINED") {
    if (!stored.source?.trim()) reasons.push("CLINICIAN_TARGET_REQUIRED");
    else if (stored.reviewBy && stored.reviewBy < today) {
      reasons.push("CLINICIAN_TARGET_EXPIRED");
      notices.push("expired");
    } else
      context.clinicianValues.protein = {
        value: stored.grams,
        enteredAt: stored.enteredAt,
        source: stored.source,
      };
  }

  context.clinicianDefined = nutrients.filter(
    (key) => impact[key] === "CLINICIAN_DEFINED",
  );
  context.conditionSensitive = nutrients.filter(
    (key) => impact[key] === "CONDITION_SENSITIVE",
  );
  context.withheld = context.clinicianDefined.filter(
    (key) => !context.clinicianValues[key],
  );
  if (context.withheld.length) {
    if (!reasons.includes("CLINICIAN_TARGET_EXPIRED"))
      reasons.push("CLINICIAN_TARGET_REQUIRED");
  }
  if (
    declared.includes(KIDNEY) &&
    (!health.kidneyDialysis || health.kidneyDialysis === "Not sure")
  ) {
    reasons.push("CKD_DIALYSIS_UNKNOWN");
    notices.push("kidney-dialysis-unknown");
  }
  if (
    health.professionalGuidance === "Yes" ||
    health.dietaryRestrictions === "Yes"
  )
    notices.push("guidance");

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
  if (!answered && !health.dietaryRestrictions && !health.professionalGuidance)
    assessment = "NOT_ASSESSED";
  if (assessment === "UNDETERMINED" || assessment === "NOT_ASSESSED") {
    notices.push("unknown");
    reasons.push("HEALTH_NOT_ASSESSED");
  }

  context.assessment = assessment;
  context.conditions = matched.map(({ condition }) => condition);
  context.notices = unique(notices);
  context.reasons = unique(reasons);
  return context;
}
