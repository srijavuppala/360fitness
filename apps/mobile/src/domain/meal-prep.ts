import {
  AppState,
  copyMeal,
  Food,
  localDate,
  Meal,
  newId,
  recordMeal,
  validateMeal,
} from "./meals";

export type PrepBatch = {
  id: string;
  date: string;
  servings: number;
  meal: Meal;
  prepared: boolean;
  note: string;
  guide?: { steps: string[]; completed: number };
};
export type MealPrep = { version: 1; batches: PrepBatch[]; checked: string[] };
export const emptyPrep = (): MealPrep => ({
  version: 1,
  batches: [],
  checked: [],
});
export function validPrepDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^20\d\d-\d{2}-\d{2}$/.test(value))
    return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDate(date) === value;
}
export function weekDays(date: string): string[] {
  if (!validPrepDate(date)) throw new Error("Choose a valid prep date.");
  const day = new Date(`${date}T12:00:00`);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, offset) =>
    localDate(
      new Date(day.getFullYear(), day.getMonth(), day.getDate() + offset, 12),
    ),
  );
}
export function moveWeek(date: string, direction: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + direction * 7);
  return localDate(next);
}
const text = (value: unknown, max: number) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;
export function validatePrepBatch(value: PrepBatch): void {
  if (
    !value ||
    !text(value.id, 100) ||
    !validPrepDate(value.date) ||
    !Number.isInteger(value.servings) ||
    value.servings < 1 ||
    value.servings > 20 ||
    typeof value.prepared !== "boolean" ||
    typeof value.note !== "string" ||
    value.note.length > 1200
  )
    throw new Error("A prep batch needs a valid day and 1–20 servings.");
  if (
    !value.meal ||
    !Array.isArray(value.meal.foods) ||
    value.meal.foods.length > 12
  )
    throw new Error("Use 1–12 ingredients per prep recipe.");
  validateMeal(value.meal);
  if (
    value.guide !== undefined &&
    (!value.guide ||
      !Array.isArray(value.guide.steps) ||
      value.guide.steps.length < 1 ||
      value.guide.steps.length > 8 ||
      value.guide.steps.some((step) => !text(step, 600)) ||
      !Number.isInteger(value.guide.completed) ||
      value.guide.completed < 0 ||
      value.guide.completed > value.guide.steps.length)
  )
    throw new Error("The saved prep steps could not be opened.");
  if (!text(value.meal.id, 100)) throw new Error("Invalid recipe ID.");
  const ids = new Set();
  for (const food of value.meal.foods) {
    if (
      !food ||
      !text(food.id, 100) ||
      ids.has(food.id) ||
      !text(food.name, 100) ||
      !text(food.unit, 30) ||
      !["sample", "manual", "ai", "barcode"].includes(food.source)
    )
      throw new Error("Each ingredient needs a unique ID, name and unit.");
    ids.add(food.id);
  }
}
export function validatePrep(value: MealPrep): void {
  if (
    !value ||
    value.version !== 1 ||
    !Array.isArray(value.batches) ||
    value.batches.length > 40 ||
    !Array.isArray(value.checked) ||
    value.checked.length > 480 ||
    value.checked.some((key) => !text(key, 320)) ||
    new Set(value.checked).size !== value.checked.length
  )
    throw new Error("The saved meal prep plan could not be opened.");
  value.batches.forEach(validatePrepBatch);
  if (
    new Set(value.batches.map((batch) => batch.id)).size !==
    value.batches.length
  )
    throw new Error("Duplicate prep batch.");
  if (JSON.stringify(value).length > 180000)
    throw new Error(
      "Your prep plan is too large to save. Remove an older batch.",
    );
}
export function makeBatch(
  meal: Meal,
  date: string,
  servings: number,
  note = "",
): PrepBatch {
  const batch = {
    id: newId(),
    date,
    servings,
    meal: copyMeal(meal),
    prepared: false,
    note,
  };
  validatePrepBatch(batch);
  return batch;
}
export function saveBatch(state: AppState, batch: PrepBatch): AppState {
  validatePrepBatch(batch);
  const current = state.mealPrep ?? emptyPrep();
  const mealPrep = {
    ...current,
    batches: [...current.batches.filter((item) => item.id !== batch.id), batch],
    checked: [],
  };
  // Changing a recipe/quantity invalidates the old shopping checklist rather than
  // claiming the newly increased quantity has already been purchased.
  validatePrep(mealPrep);
  return { ...state, mealPrep };
}
export type GroceryItem = {
  key: string;
  name: string;
  unit: string;
  quantity: number;
};
/** Advance from the expected step only; repeated taps cannot skip a step. */
export function advancePrepStep(
  state: AppState,
  id: string,
  expected: number,
): AppState {
  const prep = state.mealPrep ?? emptyPrep();
  const batch = prep.batches.find((item) => item.id === id);
  if (
    !batch?.guide ||
    batch.guide.completed !== expected ||
    expected >= batch.guide.steps.length
  )
    return state;
  const mealPrep = {
    ...prep,
    batches: prep.batches.map((item) =>
      item.id === id
        ? { ...item, guide: { ...batch.guide!, completed: expected + 1 } }
        : item,
    ),
  };
  validatePrep(mealPrep);
  return { ...state, mealPrep };
}
export function groceryList(prep: MealPrep, week: string): GroceryItem[] {
  const days = weekDays(week);
  const groups = new Map<string, Omit<GroceryItem, "key">>();
  for (const batch of prep.batches.filter((b) => days.includes(b.date)))
    for (const food of batch.meal.foods) {
      const key = JSON.stringify([
        food.name.trim().toLowerCase(),
        food.unit.trim().toLowerCase(),
      ]);
      const previous = groups.get(key);
      groups.set(key, {
        name: previous?.name ?? food.name,
        unit: food.unit,
        quantity: (previous?.quantity ?? 0) + food.quantity * batch.servings,
      });
    }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({
      ...value,
      quantity: Math.round(value.quantity * 1000000) / 1000000,
      key: `${days[0]}|${key}|${Math.round(value.quantity * 1000000) / 1000000}`,
    }));
}
export function toggleGrocery(state: AppState, key: string): AppState {
  const prep = state.mealPrep ?? emptyPrep();
  const checked = prep.checked.includes(key)
    ? prep.checked.filter((item) => item !== key)
    : [...prep.checked, key];
  const mealPrep = { ...prep, checked };
  validatePrep(mealPrep);
  return { ...state, mealPrep };
}
/** Prep is never intake. This explicit action logs one portion, idempotently per day. */
export function logPrepPortion(
  state: AppState,
  batch: PrepBatch,
  date: string,
): AppState {
  validatePrepBatch(batch);
  return recordMeal(
    state,
    { ...copyMeal(batch.meal), id: `prep-${batch.id}` },
    date,
    "confirmed",
  );
}
export function parsePrepSuggestion(raw: unknown): {
  meal: Meal;
  note: string;
} {
  if (!raw || typeof raw !== "object")
    throw new Error("The recipe result could not be read.");
  const data = raw as { name: string; foods: Food[]; note: string };
  const meal: Meal = {
    id: newId(),
    name: data.name,
    slot: "Lunch",
    foods: Array.isArray(data.foods)
      ? data.foods.map((food) => ({
          ...food,
          id: newId(),
          source: "ai" as const,
        }))
      : [],
  };
  validatePrepBatch({
    id: "review",
    date: localDate(),
    servings: 1,
    meal,
    prepared: false,
    note: data.note,
  });
  return { meal, note: data.note };
}
