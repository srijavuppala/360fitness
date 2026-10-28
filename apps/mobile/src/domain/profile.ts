import type { AppState, Goal } from "./meals";

export const options = {
  age: [
    "Under 18",
    "18–24",
    "25–34",
    "35–44",
    "45–54",
    "55–64",
    "65+",
    "Prefer not to say",
  ],
  sex: ["Female", "Male", "Prefer not to say"],
  weeklyPace: [
    "Gentle · 0.25 kg a week",
    "Steady · 0.5 kg a week",
    "Faster · 0.75 kg a week",
  ],
  primaryGoal: [
    "Build consistent habits",
    "Understand my nutrition",
    "Support my fitness",
  ],
  activity: [
    "Mostly sitting",
    "Lightly active",
    "Moderately active",
    "Very active",
    "Varies day to day",
  ],
  diet: [
    "No specific diet",
    "Vegetarian",
    "Vegan",
    "Pescatarian",
    "Flexitarian",
    "Halal",
    "Kosher",
    "Other",
  ],
  allergies: [
    "None known",
    "Milk",
    "Eggs",
    "Peanuts",
    "Tree nuts",
    "Wheat",
    "Soy",
    "Fish",
    "Shellfish",
    "Sesame",
    "Other",
    "Not sure",
  ],
} as const;

type OptionKey = keyof typeof options;
export type AnswerKey =
  | OptionKey
  | "heightCm"
  | "currentWeightKg"
  | "targetWeightKg"
  | "outcome"
  | "dietOther"
  | "allergyOther";
export type ProfileAnswers = Partial<Record<AnswerKey, string | string[]>>;
export type ProfileDraft = {
  version: 1;
  answers: ProfileAnswers;
  step: number;
  /** Optional focused question; step remains the legacy group index. */
  question?: AnswerKey | "review";
};
export type PersonalProfile = {
  /** Version 1 profiles used a weight-or-waist metric; see migrateProfileAnswers. */
  version: 2;
  answers: ProfileAnswers;
  updatedAt: string;
};
export type Question = {
  key: AnswerKey;
  label: string;
  kind: "single" | "multi" | "text" | "number" | "time";
  required?: boolean;
  maxLength?: number;
  hint?: string;
  when?: { key: OptionKey; value: string };
  /** Inclusive bounds for number questions. */
  min?: number;
  max?: number;
  unit?: string;
};
export const profileSteps: {
  title: string;
  subtitle: string;
  questions: Question[];
}[] = [
  {
    title: "Start with you.",
    subtitle:
      "A baseline in your own terms. You can keep personal details private.",
    questions: [
      { key: "age", label: "Your age range", kind: "single", required: true },
      {
        key: "sex",
        label: "Sex for calorie estimates",
        kind: "single",
        required: true,
        hint: "Used only in the standard formula for resting energy use. Prefer not to say uses an average of the two.",
      },
      {
        key: "heightCm",
        label: "Your height",
        kind: "number",
        required: true,
        min: 100,
        max: 250,
        unit: "cm",
      },
      {
        key: "currentWeightKg",
        label: "Your current weight",
        kind: "number",
        required: true,
        min: 25,
        max: 350,
        unit: "kg",
      },
    ],
  },
  {
    title: "Find your why.",
    subtitle: "What would meaningful progress look like for you?",
    questions: [
      {
        key: "primaryGoal",
        label: "Your primary goal",
        kind: "single",
        required: true,
      },
      {
        key: "targetWeightKg",
        label: "Your target weight",
        kind: "number",
        required: true,
        min: 25,
        max: 350,
        unit: "kg",
        hint: "Enter your current weight to maintain it. Your daily calorie and nutrient targets are estimated from this goal; they are not medical advice.",
      },
      {
        key: "weeklyPace",
        label: "How quickly to reach it",
        kind: "single",
        required: true,
        hint: "A slower pace is easier to sustain. Targets never go below a safe daily minimum.",
      },
      {
        key: "outcome",
        label: "Your desired outcome",
        kind: "text",
        required: true,
        hint: "For example: cook at home three evenings a week. Include units if you enter a number.",
      },
    ],
  },
  {
    title: "Fit your real life.",
    subtitle: "Tell us what a typical week looks like.",
    questions: [
      {
        key: "activity",
        label: "Typical activity level",
        kind: "single",
        required: true,
        hint: "Used to estimate how many calories you use in a typical day.",
      },
    ],
  },
  {
    title: "Food, your way.",
    subtitle: "So we can match meals to how you eat.",
    questions: [
      { key: "diet", label: "Diet preference", kind: "single", required: true },
      {
        key: "dietOther",
        label: "Describe your diet preference",
        kind: "text",
        required: true,
        when: { key: "diet", value: "Other" },
      },
      {
        key: "allergies",
        label: "Food allergies",
        kind: "multi",
        required: true,
        hint: "Select all that apply, or choose None known / Not sure. Always check the package; this app does not certify allergy safety.",
      },
      {
        key: "allergyOther",
        label: "Other food allergies",
        kind: "text",
        required: true,
        when: { key: "allergies", value: "Other" },
      },
    ],
  },
];
const allQuestions = profileSteps.flatMap((step) => step.questions);
const exclusiveOptions = [
  "None known",
  "Not sure",
  "No preference yet",
  "None",
];
export const goalLabels: Record<Goal, string> = {
  habits: options.primaryGoal[0],
  nutrition: options.primaryGoal[1],
  fitness: options.primaryGoal[2],
};

export function choicesFor(key: AnswerKey): readonly string[] {
  return key in options ? options[key as OptionKey] : [];
}
/** Within this many kg of the current weight, the goal is to maintain. */
export const MAINTAIN_TOLERANCE_KG = 0.5;

/** Target minus current weight, or null until both are valid numbers. */
export function weightChangeKg(answers: ProfileAnswers): number | null {
  const valid = (key: "currentWeightKg" | "targetWeightKg") => {
    const value = answers[key];
    if (typeof value !== "string" || !/^\d+(\.\d{1,2})?$/.test(value.trim()))
      return null;
    const amount = Number(value);
    return amount >= 25 && amount <= 350 ? amount : null;
  };
  const current = valid("currentWeightKg");
  const target = valid("targetWeightKg");
  return current === null || target === null ? null : target - current;
}

export function visibleQuestion(
  question: Question,
  answers: ProfileAnswers,
): boolean {
  if (question.key === "weeklyPace") {
    const change = weightChangeKg(answers);
    return change !== null && Math.abs(change) > MAINTAIN_TOLERANCE_KG;
  }
  if (!question.when) return true;
  const value = answers[question.when.key];
  return Array.isArray(value)
    ? value.includes(question.when.value)
    : value === question.when.value;
}
export function toggleSelection(selected: string[], value: string): string[] {
  if (selected.includes(value))
    return selected.filter((item) => item !== value);
  if (exclusiveOptions.includes(value)) return [value];
  return [
    ...selected.filter((item) => !exclusiveOptions.includes(item)),
    value,
  ];
}
export function changeAnswer(
  answers: ProfileAnswers,
  key: AnswerKey,
  value: string | string[],
): ProfileAnswers {
  const next = { ...answers, [key]: value };
  // Remove answers to hidden questions so private/stale details are not retained.
  for (const question of allQuestions)
    if (!visibleQuestion(question, next)) delete next[question.key];
  return next;
}

/** Drafts may be incomplete but must have a bounded, known structure. */
export function validateAnswerShape(
  value: unknown,
): asserts value is ProfileAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Saved profile answers could not be opened.");
  for (const [key, answer] of Object.entries(value)) {
    const question = allQuestions.find((item) => item.key === key);
    if (!question) throw new Error("Unknown profile question.");
    const choices = choicesFor(question.key);
    if (question.kind === "multi") {
      if (
        !Array.isArray(answer) ||
        answer.some(
          (item) => typeof item !== "string" || !choices.includes(item),
        ) ||
        new Set(answer).size !== answer.length ||
        (answer.length > 1 &&
          answer.some((item) => exclusiveOptions.includes(item)))
      )
        throw new Error("Invalid profile selection.");
    } else if (
      typeof answer !== "string" ||
      answer.length > (question.maxLength ?? 300) ||
      (question.kind === "single" && answer !== "" && !choices.includes(answer))
    )
      throw new Error("Invalid profile answer.");
  }
}
/** Keep canonical HH:mm storage compatible with existing saved profiles. */
export function normalizeCheckInTime(value: string): string | null {
  const text = value.trim();
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) return text;
  const match = /^(0?[1-9]|1[0-2]):([0-5]\d)\s*(AM|PM)$/i.exec(text);
  if (!match) return null;
  const hour =
    (Number(match[1]) % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

export function formatCheckInTime(value: string): string {
  const normalized = normalizeCheckInTime(value);
  if (!normalized) return value;
  const [hour, minute] = normalized.split(":");
  return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) >= 12 ? "PM" : "AM"}`;
}

export function stepErrors(
  answers: ProfileAnswers,
  step: number,
): Partial<Record<AnswerKey, string>> {
  const errors: Partial<Record<AnswerKey, string>> = {};
  for (const q of profileSteps[step]?.questions ?? []) {
    if (!visibleQuestion(q, answers)) continue;
    const value = answers[q.key];
    const missing =
      value === undefined ||
      (typeof value === "string" ? !value.trim() : value.length === 0);
    if (missing) {
      if (q.required)
        errors[q.key] = `Please answer: ${q.label.toLowerCase()}.`;
      continue;
    }
    if (q.kind === "number") {
      const text = String(value).trim();
      const amount = Number(text);
      const min = q.min ?? 0;
      const max = q.max ?? 100000;
      if (
        !/^\d+(\.\d{1,2})?$/.test(text) ||
        !Number.isFinite(amount) ||
        amount < min ||
        amount > max
      )
        errors[q.key] = q.unit
          ? `Enter ${q.label.toLowerCase()} from ${min} to ${max} ${q.unit}, with at most two decimal places.`
          : `Enter zero or a positive amount, up to ${max.toLocaleString("en-US")}, with at most two decimal places.`;
    }
    if (q.kind === "time" && normalizeCheckInTime(String(value)) === null)
      errors[q.key] =
        "Enter a time from 1:00 to 12:59 with AM or PM, such as 7:30 PM.";
  }
  return errors;
}
const POUNDS_TO_KG = 0.45359237;

function knownAnswerKey(key: string): key is AnswerKey {
  return allQuestions.some((question) => question.key === key);
}

function stripUnknownAnswers(
  source: Record<string, unknown>,
): ProfileAnswers {
  const cleaned: ProfileAnswers = {};
  for (const [key, value] of Object.entries(source)) {
    if (knownAnswerKey(key)) cleaned[key] = value as ProfileAnswers[AnswerKey];
  }
  return cleaned;
}

function firstIncomplete(
  answers: ProfileAnswers,
): { step: number; question: AnswerKey } | null {
  const step = profileSteps.findIndex(
    (_, index) => Object.keys(stepErrors(answers, index)).length > 0,
  );
  if (step === -1) return null;
  const question = profileSteps[step].questions.find(
    (q) =>
      visibleQuestion(q, answers) &&
      stepErrors(answers, step)[q.key] !== undefined,
  )?.key;
  return question ? { step, question } : { step, question: profileSteps[step].questions[0].key };
}

function repairDraft(draft: ProfileDraft): ProfileDraft {
  const answers = migrateProfileAnswers(draft.answers) as ProfileAnswers;
  if (draft.question === "review" || draft.step >= profileSteps.length)
    return { version: 1, answers, step: profileSteps.length, question: "review" };
  if (
    draft.question &&
    profileSteps.some((group) =>
      group.questions.some((q) => q.key === draft.question),
    )
  ) {
    const step = profileSteps.findIndex((group) =>
      group.questions.some((q) => q.key === draft.question),
    );
    return { version: 1, answers, step, question: draft.question };
  }
  const incomplete = firstIncomplete(answers);
  if (incomplete)
    return {
      version: 1,
      answers,
      step: incomplete.step,
      question: incomplete.question,
    };
  return { version: 1, answers, step: profileSteps.length, question: "review" };
}

/**
 * Convert answers saved before body stats replaced the weight-or-waist metric.
 * A weight carries over as current weight; a waist value is dropped rather than
 * relabelled. Retired survey keys are stripped so old JSON still loads.
 */
export function migrateProfileAnswers(answers: unknown): unknown {
  if (!answers || typeof answers !== "object" || Array.isArray(answers))
    return answers;
  const source = answers as Record<string, unknown>;
  let rest: Record<string, unknown> = source;
  if ("metric" in source || "metricValue" in source) {
    const { metric, metricValue, ...without } = source;
    rest = without;
    const amount =
      typeof metricValue === "string" && /^\d+(\.\d{1,2})?$/.test(metricValue)
        ? Number(metricValue)
        : null;
    const kg =
      amount === null
        ? null
        : metric === "Weight (kg)"
          ? amount
          : metric === "Weight (lb)"
            ? Math.round(amount * POUNDS_TO_KG * 10) / 10
            : null;
    if (kg !== null && kg >= 25 && kg <= 350 && !("currentWeightKg" in rest))
      rest.currentWeightKg = String(kg);
  }
  return stripUnknownAnswers(rest);
}

/**
 * Version 1 profiles lack the body stats that targets need, so they reopen as
 * a draft at the first unanswered question instead of failing to load.
 */
export function migrateSavedProfile(
  profile: unknown,
  draft: unknown,
): { profile?: PersonalProfile; profileDraft?: ProfileDraft } {
  const result: { profile?: PersonalProfile; profileDraft?: ProfileDraft } =
    {};
  if (draft && typeof draft === "object")
    result.profileDraft = repairDraft(draft as ProfileDraft);
  if (!profile || typeof profile !== "object") return result;
  const saved = profile as {
    version?: unknown;
    answers?: unknown;
    updatedAt?: unknown;
  };
  const answers = migrateProfileAnswers(saved.answers);
  try {
    validateAnswerShape(answers);
  } catch {
    if (!result.profileDraft)
      result.profileDraft = {
        version: 1,
        answers: {},
        step: 0,
        question: "age",
      };
    return result;
  }
  const incomplete = firstIncomplete(answers);
  if (saved.version !== 1) {
    if (!incomplete && typeof saved.updatedAt === "string")
      result.profile = {
        version: 2,
        answers,
        updatedAt: saved.updatedAt,
      };
    else if (!result.profileDraft && incomplete)
      result.profileDraft = {
        version: 1,
        answers,
        step: incomplete.step,
        question: incomplete.question,
      };
    return result;
  }
  if (result.profileDraft) return result;
  if (!incomplete)
    result.profile = {
      version: 2,
      answers,
      updatedAt: String((profile as PersonalProfile).updatedAt),
    };
  else
    result.profileDraft = {
      version: 1,
      answers,
      step: incomplete.step,
      question: incomplete.question,
    };
  return result;
}

export function validateProfile(profile: PersonalProfile): void {
  if (
    !profile ||
    profile.version !== 2 ||
    typeof profile.updatedAt !== "string" ||
    !Number.isFinite(Date.parse(profile.updatedAt))
  )
    throw new Error("Saved profile could not be opened.");
  validateAnswerShape(profile.answers);
  for (let step = 0; step < profileSteps.length; step++) {
    const error = Object.values(stepErrors(profile.answers, step))[0];
    if (error) throw new Error(error);
  }
}
export function validateProfileDraft(draft: ProfileDraft): void {
  if (
    !draft ||
    draft.version !== 1 ||
    !Number.isInteger(draft.step) ||
    draft.step < 0 ||
    draft.step > profileSteps.length
  )
    throw new Error("Saved profile draft could not be opened.");
  validateAnswerShape(draft.answers);
  if (
    draft.question !== undefined &&
    (draft.question === "review"
      ? draft.step !== profileSteps.length
      : !profileSteps[draft.step]?.questions.some(
          (q) => q.key === draft.question,
        ))
  )
    throw new Error("Saved profile position could not be opened.");
}
export function saveProfile(
  state: AppState,
  answers: ProfileAnswers,
): AppState {
  validateAnswerShape(answers);
  const cleaned: ProfileAnswers = {};
  for (const q of allQuestions) {
    if (!visibleQuestion(q, answers)) continue;
    const answer = answers[q.key];
    if (Array.isArray(answer) && answer.length) cleaned[q.key] = [...answer];
    else if (typeof answer === "string" && answer.trim())
      cleaned[q.key] = answer.trim();
  }
  const profile: PersonalProfile = {
    version: 2,
    answers: cleaned,
    updatedAt: new Date().toISOString(),
  };
  validateProfile(profile);
  const goal = (Object.keys(goalLabels) as Goal[]).find(
    (key) => goalLabels[key] === cleaned.primaryGoal,
  )!;
  const { profileDraft: _draft, ...rest } = state;
  return {
    ...rest,
    profile,
    goal,
    onboarding: state.onboarding === "complete" ? "complete" : "routine",
  };
}
export function answerLabel(answers: ProfileAnswers, key: AnswerKey): string {
  const value = answers[key];
  if (Array.isArray(value)) return value.join(", ") || "Not set";
  const unit = allQuestions.find((q) => q.key === key)?.unit;
  return value?.trim() ? (unit ? `${value.trim()} ${unit}` : value.trim()) : "Not set";
}
