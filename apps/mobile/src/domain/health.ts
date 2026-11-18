/**
 * Optional health context collected during onboarding. It is deliberately kept
 * out of `ProfileAnswers`: profile answers are validated, required and backed up
 * to the cloud as a unit, whereas health information is optional, consented
 * separately and stays on this device unless the user opts in to a backup.
 */
export const conditionOptions = [
  "Kidney-related condition",
  "Diabetes (Type 1 / Type 2)",
  "High blood pressure (Hypertension)",
  "Liver-related condition",
  "Thyroid-related condition",
  "Heart-related condition",
  "Other health condition",
  "None of the above",
  "Prefer not to disclose",
] as const;
export const answerOptions = [
  "Yes",
  "No",
  "Not sure",
  "Prefer not to disclose",
] as const;

export type Condition = (typeof conditionOptions)[number];
export type HealthAnswer = (typeof answerOptions)[number];

export const KIDNEY: Condition = "Kidney-related condition";
export const OTHER_CONDITION: Condition = "Other health condition";
/** Selecting either of these clears (and is cleared by) every other condition. */
export const exclusiveConditions: readonly Condition[] = [
  "None of the above",
  "Prefer not to disclose",
];

export const HEALTH_VERSION = 1;
export const NOTE_MAX_LENGTH = 200;
export const OTHER_MAX_LENGTH = 100;
/**
 * Data-entry sanity bounds for a clinician-provided protein target in grams a
 * day. These only reject typos; they are not clinical limits and the app does
 * not judge whether a clinician's value is appropriate.
 */
export const CLINICIAN_PROTEIN_MIN_G = 1;
export const CLINICIAN_PROTEIN_MAX_G = 500;

export type ClinicianProtein = {
  /** Grams per day, exactly as entered by the user from their care team. */
  grams: number;
  enteredAt: string;
};
export type HealthProfile = {
  version: 1;
  /** When the user agreed to this app storing the answers below. */
  consentGivenAt: string;
  conditions?: Condition[];
  conditionOther?: string;
  dietaryRestrictions?: HealthAnswer;
  dietaryRestrictionsNote?: string;
  professionalGuidance?: HealthAnswer;
  professionalGuidanceNote?: string;
  clinicianProtein?: ClinicianProtein;
  updatedAt: string;
};

export function toggleCondition(
  selected: readonly Condition[],
  value: Condition,
): Condition[] {
  if (selected.includes(value)) return selected.filter((c) => c !== value);
  if (exclusiveConditions.includes(value)) return [value];
  return [...selected.filter((c) => !exclusiveConditions.includes(c)), value];
}

const isoDate = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 40 &&
  Number.isFinite(Date.parse(value));

/**
 * Throws a generic message on any problem. It never echoes the offending
 * value, so health answers cannot leak through error text or logs.
 */
export function validateHealthProfile(
  value: unknown,
): asserts value is HealthProfile {
  const fail = (): never => {
    throw new Error("Saved health information could not be opened.");
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) fail();
  const h = value as Record<string, unknown>;
  const allowed = [
    "version",
    "consentGivenAt",
    "conditions",
    "conditionOther",
    "dietaryRestrictions",
    "dietaryRestrictionsNote",
    "professionalGuidance",
    "professionalGuidanceNote",
    "clinicianProtein",
    "updatedAt",
  ];
  if (Object.keys(h).some((key) => !allowed.includes(key))) fail();
  if (h.version !== HEALTH_VERSION) fail();
  if (!isoDate(h.consentGivenAt) || !isoDate(h.updatedAt)) fail();

  const text = (field: string, max: number) => {
    const v = h[field];
    if (v !== undefined && (typeof v !== "string" || !v.trim() || v.length > max))
      fail();
  };
  if (h.conditions !== undefined) {
    const list = h.conditions;
    if (
      !Array.isArray(list) ||
      !list.length ||
      list.some((c) => !conditionOptions.includes(c)) ||
      new Set(list).size !== list.length ||
      (list.length > 1 && list.some((c) => exclusiveConditions.includes(c)))
    )
      fail();
  }
  const conditions = (h.conditions as Condition[] | undefined) ?? [];
  text("conditionOther", OTHER_MAX_LENGTH);
  if (h.conditionOther !== undefined && !conditions.includes(OTHER_CONDITION))
    fail();
  for (const [field, note] of [
    ["dietaryRestrictions", "dietaryRestrictionsNote"],
    ["professionalGuidance", "professionalGuidanceNote"],
  ] as const) {
    if (h[field] !== undefined && !answerOptions.includes(h[field] as never))
      fail();
    text(note, NOTE_MAX_LENGTH);
    if (h[note] !== undefined && h[field] !== "Yes") fail();
  }
  if (h.clinicianProtein !== undefined) {
    const p = h.clinicianProtein as Record<string, unknown> | null;
    if (
      !p ||
      typeof p !== "object" ||
      Object.keys(p).some((k) => k !== "grams" && k !== "enteredAt") ||
      typeof p.grams !== "number" ||
      !Number.isInteger(p.grams) ||
      p.grams < CLINICIAN_PROTEIN_MIN_G ||
      p.grams > CLINICIAN_PROTEIN_MAX_G ||
      !isoDate(p.enteredAt)
    )
      fail();
  }
}

/** Parse a user-typed clinician protein value (whole grams per day). */
export function parseClinicianProtein(input: string): number | null {
  const text = input.trim();
  if (!/^\d{1,3}$/.test(text)) return null;
  const grams = Number(text);
  return grams >= CLINICIAN_PROTEIN_MIN_G && grams <= CLINICIAN_PROTEIN_MAX_G
    ? grams
    : null;
}

export type HealthDraft = {
  conditions: Condition[];
  conditionOther: string;
  dietaryRestrictions?: HealthAnswer;
  dietaryRestrictionsNote: string;
  professionalGuidance?: HealthAnswer;
  professionalGuidanceNote: string;
  clinicianProtein: string;
};

export function draftFromHealth(health?: HealthProfile): HealthDraft {
  return {
    conditions: [...(health?.conditions ?? [])],
    conditionOther: health?.conditionOther ?? "",
    dietaryRestrictions: health?.dietaryRestrictions,
    dietaryRestrictionsNote: health?.dietaryRestrictionsNote ?? "",
    professionalGuidance: health?.professionalGuidance,
    professionalGuidanceNote: health?.professionalGuidanceNote ?? "",
    clinicianProtein: health?.clinicianProtein
      ? String(health.clinicianProtein.grams)
      : "",
  };
}

/**
 * Build the stored profile from the form. Notes are only kept while they apply,
 * so removing "Other" or switching an answer away from "Yes" drops the text.
 * Every question is optional; an empty draft stores consent with no answers.
 */
export function healthFromDraft(
  draft: HealthDraft,
  previous: HealthProfile | undefined,
  now = new Date(),
): HealthProfile {
  const stamp = now.toISOString();
  const trim = (v: string) => v.trim();
  const health: HealthProfile = {
    version: HEALTH_VERSION,
    consentGivenAt: previous?.consentGivenAt ?? stamp,
    updatedAt: stamp,
  };
  if (draft.conditions.length) health.conditions = [...draft.conditions];
  if (draft.conditions.includes(OTHER_CONDITION) && trim(draft.conditionOther))
    health.conditionOther = trim(draft.conditionOther);
  for (const [field, note] of [
    ["dietaryRestrictions", "dietaryRestrictionsNote"],
    ["professionalGuidance", "professionalGuidanceNote"],
  ] as const) {
    const answer = draft[field];
    if (answer) health[field] = answer;
    if (answer === "Yes" && trim(draft[note])) health[note] = trim(draft[note]);
  }
  if (draft.conditions.includes(KIDNEY) && trim(draft.clinicianProtein)) {
    const grams = parseClinicianProtein(draft.clinicianProtein);
    if (grams === null)
      throw new Error(
        `Enter a whole number of grams from ${CLINICIAN_PROTEIN_MIN_G} to ${CLINICIAN_PROTEIN_MAX_G}.`,
      );
    health.clinicianProtein =
      previous?.clinicianProtein?.grams === grams
        ? previous.clinicianProtein
        : { grams, enteredAt: stamp };
  }
  validateHealthProfile(health);
  return health;
}
