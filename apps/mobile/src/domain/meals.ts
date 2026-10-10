import { MealPrep, validatePrep } from "./meal-prep";
import {
  PersonalProfile,
  ProfileDraft,
  validateProfile,
  validateProfileDraft,
} from "./profile";

export type Slot = "Breakfast" | "Lunch" | "Dinner" | "Snack";
export type Nutrients = {
  kcal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};
export type Food = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  nutrition: Nutrients;
  source: "sample" | "manual" | "ai" | "barcode";
  sourceBarcode?: string;
  estimateNote?: string;
};
export type Meal = { id: string; name: string; slot: Slot; foods: Food[] };
export type Entry = Meal & {
  date: string;
  status: "confirmed" | "skipped";
  updatedAt: string;
};
export type Goal = "habits" | "nutrition" | "fitness";
export type AppState = {
  version: 1;
  onboarding: "welcome" | "goals" | "routine" | "complete";
  goal: Goal;
  mealPrep?: MealPrep;
  profile?: PersonalProfile;
  profileDraft?: ProfileDraft;
  templates: Meal[];
  entries: Entry[];
};
export const nutrientKeys = ["kcal", "protein", "carbs", "fat"] as const;
export const slots: Slot[] = ["Breakfast", "Lunch", "Dinner", "Snack"];

export function copyMeal(meal: Meal): Meal {
  return {
    ...meal,
    foods: meal.foods.map((food) => ({
      ...food,
      nutrition: { ...food.nutrition },
    })),
  };
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function lastDays(count: number, now = new Date()): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - (count - index - 1),
      12,
    );
    return localDate(date);
  });
}

export function sumNutrition(foods: Food[]): Nutrients {
  const total: Nutrients = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const key of nutrientKeys) {
    total[key] = foods.some((food) => food.nutrition[key] === null)
      ? null
      : foods.reduce((sum, food) => sum + (food.nutrition[key] ?? 0), 0);
  }
  return total;
}

export function dailyNutrition(entries: Entry[], date: string): Nutrients {
  return sumNutrition(
    entries
      .filter((entry) => entry.date === date && entry.status === "confirmed")
      .flatMap((entry) => entry.foods),
  );
}

export function scaleFood(food: Food, quantity: number): Food {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000)
    throw new Error("Enter a quantity between 0 and 10,000.");
  const factor = quantity / food.quantity;
  return {
    ...food,
    quantity,
    nutrition: Object.fromEntries(
      nutrientKeys.map((key) => [
        key,
        food.nutrition[key] === null ? null : food.nutrition[key]! * factor,
      ]),
    ) as Nutrients,
  };
}

export function validateMeal(meal: Meal): void {
  if (!meal.id || !meal.name.trim() || meal.name.length > 100)
    throw new Error("Give your meal a name (up to 100 characters).");
  if (!slots.includes(meal.slot)) throw new Error("Choose a meal time.");
  if (!meal.foods.length || meal.foods.length > 30)
    throw new Error("Add between 1 and 30 foods.");
  for (const food of meal.foods) {
    if (!food.name.trim() || !food.unit.trim())
      throw new Error("Each food needs a name and serving unit.");
    if (
      !Number.isFinite(food.quantity) ||
      food.quantity <= 0 ||
      food.quantity > 10000
    )
      throw new Error(
        "Food quantities must be greater than zero and at most 10,000.",
      );
    for (const key of nutrientKeys) {
      const value = food.nutrition[key];
      if (
        value !== null &&
        (!Number.isFinite(value) || value < 0 || value > 10000)
      )
        throw new Error(
          "Nutrition values must be between 0 and 10,000, or left blank.",
        );
    }
  }
}

/** Replace one day's entry for a template; retries cannot duplicate intake. */
export function recordMeal(
  state: AppState,
  meal: Meal,
  date: string,
  status: Entry["status"],
): AppState {
  validateMeal(meal);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error("Choose a valid date.");
  const entry: Entry = {
    ...copyMeal(meal),
    date,
    status,
    updatedAt: new Date().toISOString(),
  };
  return {
    ...state,
    entries: [
      ...state.entries.filter(
        (item) => !(item.id === meal.id && item.date === date),
      ),
      entry,
    ],
  };
}

export function formatValue(value: number | null): string {
  return value === null ? "—" : Math.round(value).toLocaleString();
}

export function newId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function parseSavedState(raw: string): AppState {
  const value = JSON.parse(raw) as AppState;
  if (
    value.version !== 1 ||
    !["welcome", "goals", "routine", "complete"].includes(value.onboarding) ||
    !["habits", "nutrition", "fitness"].includes(value.goal) ||
    !Array.isArray(value.templates) ||
    !Array.isArray(value.entries)
  ) {
    throw new Error(
      "Saved data could not be opened. It has not been overwritten.",
    );
  }
  if (value.mealPrep !== undefined) validatePrep(value.mealPrep);
  if (value.profile !== undefined) validateProfile(value.profile);
  if (value.profileDraft !== undefined)
    validateProfileDraft(value.profileDraft);
  value.templates.forEach(validateMeal);
  value.entries.forEach((entry) => {
    validateMeal(entry);
    if (
      !["confirmed", "skipped"].includes(entry.status) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)
    )
      throw new Error("A saved entry could not be opened.");
  });
  return value;
}
