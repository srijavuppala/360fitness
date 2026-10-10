export {
  localDate,
  lastDays,
  sumNutrition,
  dailyNutrition,
  formatValue,
  scaleFood,
  slots,
  validateMeal,
  copyMeal,
} from "../../../mobile/src/domain/meals";
export type {
  Meal,
  Food,
  Entry,
  Nutrients,
  Slot,
} from "../../../mobile/src/domain/meals";
export {
  historyDays,
  averageLogged,
} from "../../../mobile/src/domain/analytics";
export {
  parseMealEstimate,
  generateMealPrompt,
} from "../../../mobile/src/domain/mealAnalysis";
export { calorieTrackerNotice } from "../../../mobile/src/domain/thirdPartyNotices";
import {
  validateMeal,
  type Meal,
  type Entry,
  type Food,
} from "../../../mobile/src/domain/meals";
import { sampleMeals } from "../../../mobile/src/domain/fixtures";

export type Profile = {
  name: string;
  goal: "habits" | "nutrition" | "fitness";
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  water: number;
};
export type WaterEntry = {
  id: string;
  date: string;
  ml: number;
  createdAt: string;
};
export type WebState = {
  version: 1;
  profile: Profile;
  templates: Meal[];
  entries: Entry[];
  water: WaterEntry[];
};
export const id = () => crypto.randomUUID();
export const emptyState = (): WebState => ({
  version: 1,
  profile: {
    name: "",
    goal: "habits",
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
    water: 2000,
  },
  templates: [],
  entries: [],
  water: [],
});
export const starterMeals = sampleMeals;
const nutrients = (
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
) => ({ kcal, protein, carbs, fat });
export const foodLibrary: Food[] = [
  {
    id: "oats",
    name: "Rolled oats",
    quantity: 40,
    unit: "g",
    nutrition: nutrients(150, 5, 27, 3),
    source: "sample",
  },
  {
    id: "yogurt",
    name: "Plain Greek yogurt",
    quantity: 150,
    unit: "g",
    nutrition: nutrients(90, 15, 6, 0),
    source: "sample",
  },
  {
    id: "berries",
    name: "Mixed berries",
    quantity: 100,
    unit: "g",
    nutrition: nutrients(60, 1, 14, 0),
    source: "sample",
  },
  {
    id: "chicken",
    name: "Grilled chicken breast",
    quantity: 100,
    unit: "g",
    nutrition: nutrients(165, 31, 0, 3.6),
    source: "sample",
  },
  {
    id: "rice",
    name: "Cooked brown rice",
    quantity: 100,
    unit: "g",
    nutrition: nutrients(123, 2.7, 25.6, 1),
    source: "sample",
  },
  {
    id: "egg",
    name: "Large egg",
    quantity: 1,
    unit: "egg",
    nutrition: nutrients(72, 6.3, 0.4, 4.8),
    source: "sample",
  },
  {
    id: "avocado",
    name: "Avocado",
    quantity: 100,
    unit: "g",
    nutrition: nutrients(160, 2, 8.5, 14.7),
    source: "sample",
  },
  {
    id: "banana",
    name: "Banana",
    quantity: 1,
    unit: "medium",
    nutrition: nutrients(105, 1.3, 27, 0.4),
    source: "sample",
  },
  {
    id: "salmon",
    name: "Cooked salmon",
    quantity: 100,
    unit: "g",
    nutrition: nutrients(206, 22, 0, 12),
    source: "sample",
  },
  {
    id: "tofu",
    name: "Firm tofu",
    quantity: 100,
    unit: "g",
    nutrition: nutrients(144, 17.3, 2.8, 8.7),
    source: "sample",
  },
  {
    id: "chickpeas",
    name: "Cooked chickpeas",
    quantity: 100,
    unit: "g",
    nutrition: nutrients(164, 8.9, 27.4, 2.6),
    source: "sample",
  },
  {
    id: "bread",
    name: "Wholegrain bread",
    quantity: 1,
    unit: "slice",
    nutrition: nutrients(90, 4, 15, 1.5),
    source: "sample",
  },
];
export function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}
function validId(value: unknown) {
  return typeof value === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(value);
}
export function validateState(state: WebState): WebState {
  if (
    !state ||
    state.version !== 1 ||
    !state.profile ||
    !Array.isArray(state.entries) ||
    !Array.isArray(state.templates) ||
    !Array.isArray(state.water)
  )
    throw new Error("This backup is not a supported 360° Fitness file.");
  const p = state.profile;
  if (
    typeof p.name !== "string" ||
    p.name.length > 60 ||
    !["habits", "nutrition", "fitness"].includes(p.goal)
  )
    throw new Error("Check your name and focus.");
  for (const key of ["kcal", "protein", "carbs", "fat"] as const)
    if (
      p[key] !== null &&
      (typeof p[key] !== "number" ||
        !Number.isFinite(p[key]) ||
        p[key]! <= 0 ||
        p[key]! > 10000)
    )
      throw new Error(
        "Targets must be positive numbers up to 10,000, or left blank.",
      );
  if (!Number.isFinite(p.water) || p.water < 250 || p.water > 10000)
    throw new Error("Choose a water target from 250 to 10,000 ml.");
  for (const meal of [...state.templates, ...state.entries]) {
    validateMeal(meal);
    if (
      !validId(meal.id) ||
      meal.foods.some(
        (f) =>
          !validId(f.id) ||
          f.name.length > 80 ||
          f.unit.length > 24 ||
          !["ai", "sample", "manual", "barcode"].includes(f.source),
      )
    )
      throw new Error("A meal contains unsupported data.");
  }
  for (const e of state.entries)
    if (
      !validDate(e.date) ||
      !["confirmed", "skipped"].includes(e.status) ||
      typeof e.updatedAt !== "string"
    )
      throw new Error("A logged meal has an invalid date or status.");
  for (const w of state.water)
    if (
      !validId(w.id) ||
      !validDate(w.date) ||
      !Number.isFinite(w.ml) ||
      w.ml <= 0 ||
      w.ml > 2000 ||
      typeof w.createdAt !== "string"
    )
      throw new Error("A water entry is invalid.");
  for (const values of [
    state.templates.map((x) => x.id),
    state.entries.map((x) => x.date + x.id),
    state.water.map((x) => x.id),
  ])
    if (new Set(values).size !== values.length)
      throw new Error("This file contains duplicate records.");
  return state;
}
export function parseBackup(raw: string) {
  if (raw.length > 5_000_000)
    throw new Error("Choose a backup smaller than 5 MB.");
  return validateState(JSON.parse(raw));
}
export function logMeal(
  state: WebState,
  meal: Meal,
  date: string,
  status: Entry["status"] = "confirmed",
): WebState {
  const entry: Entry = {
    ...structuredClone(meal),
    date,
    status,
    updatedAt: new Date().toISOString(),
  };
  return validateState({
    ...state,
    entries: [
      ...state.entries.filter((x) => !(x.id === meal.id && x.date === date)),
      entry,
    ],
  });
}
export function recordMap(state: WebState): Record<string, unknown> {
  return Object.fromEntries([
    ["profile", { kind: "profile", value: state.profile }],
    ...state.templates.map((value) => [
      `template-${value.id}`,
      { kind: "template", value },
    ]),
    ...state.entries.map((value) => [
      `entry-${value.date}-${value.id}`,
      { kind: "entry", value },
    ]),
    ...state.water.map((value) => [
      `water-${value.id}`,
      { kind: "water", value },
    ]),
  ]);
}
export function stateFromRecords(records: unknown[]): WebState {
  const next = emptyState();
  for (const raw of records) {
    const r = raw as { kind: string; value: unknown };
    if (!r || !r.value) throw new Error("Saved data could not be opened.");
    switch (r.kind) {
      case "profile":
        next.profile = r.value as Profile;
        break;
      case "entry":
        next.entries.push(r.value as Entry);
        break;
      case "template":
        next.templates.push(r.value as Meal);
        break;
      case "water":
        next.water.push(r.value as WaterEntry);
        break;
      default:
        throw new Error("Unsupported saved record.");
    }
  }
  return validateState(next);
}
export function changedRecords(before: WebState, after: WebState) {
  const a = recordMap(before),
    b = recordMap(after);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key]))
    .map((key) => ({ key, value: b[key] ?? null }));
}
