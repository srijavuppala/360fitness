import { Meal, newId, Nutrients, nutrientKeys, validateMeal } from "./meals";

export type DetectedFood = {
  name: string;
  quantity: number | null;
  unit: string | null;
  portionNote: string;
  uncertain: boolean;
  nutrition: Nutrients;
};
export type MealPhotoResult = {
  status: "food" | "no_food" | "unclear";
  name: string;
  foods: DetectedFood[];
};

export function parseMealPhoto(raw: unknown): MealPhotoResult {
  const fail = (): never => {
    throw new Error(
      "The meal photo result is incomplete. Try another photo or add foods manually.",
    );
  };
  const text = (value: unknown, limit: number): value is string =>
    typeof value === "string" && !!value.trim() && value.length <= limit;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail();
  const data = raw as Record<string, unknown>;
  if (
    !["food", "no_food", "unclear"].includes(String(data.status)) ||
    !Array.isArray(data.foods)
  )
    return fail();
  if (data.status !== "food") {
    if (data.foods.length) return fail();
    return {
      status: data.status as "no_food" | "unclear",
      name: "",
      foods: [],
    };
  }
  if (!text(data.name, 100) || !data.foods.length || data.foods.length > 12)
    return fail();
  const foods = data.foods.map((item: unknown): DetectedFood => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return fail();
    const food = item as Record<string, unknown>;
    if (
      !text(food.name, 100) ||
      !text(food.portionNote, 300) ||
      typeof food.uncertain !== "boolean" ||
      !food.nutrition ||
      typeof food.nutrition !== "object" ||
      Array.isArray(food.nutrition)
    )
      return fail();
    const hasPortion =
      typeof food.quantity === "number" &&
      Number.isFinite(food.quantity) &&
      food.quantity > 0 &&
      food.quantity <= 10000 &&
      text(food.unit, 30);
    const values = food.nutrition as Record<string, unknown>;
    const nutrition: Nutrients = {
      kcal: null,
      protein: null,
      carbs: null,
      fat: null,
    };
    for (const key of nutrientKeys) {
      const value = values[key];
      if (
        value !== null &&
        (typeof value !== "number" ||
          !Number.isFinite(value) ||
          value < 0 ||
          value > 10000)
      )
        return fail();
      nutrition[key] = hasPortion ? (value as number | null) : null;
    }
    return {
      name: food.name.trim(),
      quantity: hasPortion ? (food.quantity as number) : null,
      unit: hasPortion ? (food.unit as string).trim() : null,
      portionNote: food.portionNote.trim(),
      uncertain: food.uncertain || !hasPortion,
      nutrition,
    };
  });
  return { status: "food", name: data.name.trim(), foods };
}

/** Relative pictured portions keep unmeasurable portions editable without invented weights. */
export function mealPhotoDraft(result: MealPhotoResult): Meal {
  const parsed = parseMealPhoto(result);
  if (parsed.status !== "food")
    throw new Error(
      "No foods are available to review. Choose another photo or enter foods manually.",
    );
  const meal: Meal = {
    id: newId(),
    name: parsed.name,
    slot: "Snack",
    foods: parsed.foods.map((food) => ({
      id: newId(),
      name: food.name,
      quantity: food.quantity ?? 1,
      unit: food.unit ?? "pictured portion",
      nutrition: { ...food.nutrition },
      source: "ai",
      estimateNote: `${food.quantity === null ? "Amount unknown: 1 pictured portion is a placeholder, not a measured serving. " : "Photo estimate; check the portion. "}${food.uncertain ? "Uncertain identification or portion. " : ""}${food.portionNote}`,
    })),
  };
  validateMeal(meal);
  return meal;
}
