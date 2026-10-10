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
  metric: [
    "Weight (kg)",
    "Weight (lb)",
    "Waist (cm)",
    "Waist (in)",
    "Prefer not to share",
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
  schedule: [
    "Regular daytime",
    "Evenings or nights",
    "Rotating shifts",
    "Flexible",
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
  mealTiming: [
    "Regular mealtimes",
    "Small meals throughout the day",
    "Later in the day",
    "Varies day to day",
  ],
  nutritionPriority: [
    "Balanced meals",
    "More protein",
    "More fiber",
    "More variety",
    "Still exploring",
  ],
  workouts: [
    "Walking",
    "Running",
    "Strength training",
    "Cycling",
    "Swimming",
    "Yoga or mobility",
    "Sports",
    "Other",
    "No preference yet",
  ],
  workoutFrequency: [
    "Not currently",
    "1–2 days a week",
    "3–4 days a week",
    "5+ days a week",
    "Varies week to week",
  ],
  tracking: [
    "Quick meal check-ins",
    "Photos and label scans",
    "Detailed food and portions",
    "A mix of methods",
  ],
  notifications: ["Off", "Once daily", "Meal reminders", "A few times a week"],
  voice: [
    "Comfortable with voice",
    "Maybe — let me choose each time",
    "Text only",
  ],
  wearables: [
    "None",
    "Apple Watch",
    "Fitbit",
    "Garmin",
    "Oura",
    "WHOOP",
    "Samsung Galaxy Watch",
    "Smart scale",
    "Other",
  ],
} as const;

type OptionKey = keyof typeof options;
export type AnswerKey =
  | OptionKey
  | "metricValue"
  | "outcome"
  | "dietOther"
  | "dietPlan"
  | "allergyOther"
  | "avoidedFoods"
  | "checkInTime"
  | "groceryBudget";
export type ProfileAnswers = Partial<Record<AnswerKey, string | string[]>>;
export type ProfileDraft = {
  version: 1;
  answers: ProfileAnswers;
  step: number;
  /** Optional focused question; step remains the legacy group index. */
  question?: AnswerKey | "review";
};
export type PersonalProfile = {
  version: 1;
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
        key: "metric",
        label: "Your baseline metric",
        kind: "single",
        required: true,
      },
      {
        key: "metricValue",
        label: "Current measurement",
        kind: "number",
        required: true,
        hint: "Use the unit you selected above. This does not set a calorie target.",
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
      },
      { key: "schedule", label: "Work schedule or routine", kind: "single" },
    ],
  },
  {
    title: "Food, your way.",
    subtitle: "Your preferences and the foods you look out for.",
    questions: [
      { key: "diet", label: "Diet preference", kind: "single", required: true },
      {
        key: "dietPlan",
        label: "Describe your usual diet",
        kind: "text",
        maxLength: 1000,
        hint: "Tell us what you usually eat, your meal times and changes you’d like to make. Type or use your voice. This does not create a meal plan or log food.",
      },
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
      {
        key: "avoidedFoods",
        label: "Foods you avoid",
        kind: "text",
        hint: "Preferences or intolerances, separate from the allergies above.",
      },
      { key: "mealTiming", label: "Typical meal timing", kind: "single" },
      { key: "nutritionPriority", label: "Nutrition priority", kind: "single" },
    ],
  },
  {
    title: "Move your way.",
    subtitle: "A starting point for future workout suggestions.",
    questions: [
      {
        key: "workouts",
        label: "Workout preferences",
        kind: "multi",
        required: true,
      },
      {
        key: "workoutFrequency",
        label: "Current workout frequency",
        kind: "single",
        required: true,
      },
    ],
  },
  {
    title: "Set your rhythm.",
    subtitle: "Choose how you would like to track and check in.",
    questions: [
      {
        key: "tracking",
        label: "Preferred tracking style",
        kind: "single",
        required: true,
      },
      {
        key: "notifications",
        label: "Preferred notification frequency",
        kind: "single",
        required: true,
      },
      {
        key: "voice",
        label: "Voice-based daily check-ins",
        kind: "single",
        required: true,
      },
      {
        key: "checkInTime",
        label: "Preferred check-in time",
        kind: "time",
        required: true,
        hint: "Use your local time with AM or PM, for example 7:30 PM. Saving this does not schedule a reminder.",
      },
    ],
  },
  {
    title: "A little further ahead.",
    subtitle: "Optional details for future features. Skip either question.",
    questions: [
      {
        key: "groceryBudget",
        label: "Weekly grocery budget (USD)",
        kind: "number",
        hint: "For your household. Enter an amount, or leave blank.",
      },
      {
        key: "wearables",
        label: "Wearables or smart scales you use",
        kind: "multi",
        hint: "This records interest only. No device is connected and no health data is imported.",
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
export function visibleQuestion(
  question: Question,
  answers: ProfileAnswers,
): boolean {
  if (question.key === "metricValue")
    return !!answers.metric && answers.metric !== "Prefer not to share";
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
      if (
        !/^\d+(\.\d{1,2})?$/.test(text) ||
        !Number.isFinite(amount) ||
        amount > 100000 ||
        (q.key === "metricValue" ? amount <= 0 : amount < 0)
      )
        errors[q.key] =
          `Enter ${q.key === "metricValue" ? "a positive amount" : "zero or a positive amount"}, up to 100,000, with at most two decimal places.`;
    }
    if (q.kind === "time" && normalizeCheckInTime(String(value)) === null)
      errors[q.key] =
        "Enter a time from 1:00 to 12:59 with AM or PM, such as 7:30 PM.";
  }
  return errors;
}
export function validateProfile(profile: PersonalProfile): void {
  if (
    !profile ||
    profile.version !== 1 ||
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
  if (typeof cleaned.checkInTime === "string") {
    cleaned.checkInTime =
      normalizeCheckInTime(cleaned.checkInTime) ?? cleaned.checkInTime;
  }
  const profile: PersonalProfile = {
    version: 1,
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
  if (key === "checkInTime" && value?.trim()) return formatCheckInTime(value);
  return value?.trim() || "Not set";
}
