import { AppState, copyMeal, Food, Meal } from "./meals";

const food = (
  id: string,
  name: string,
  quantity: number,
  unit: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
): Food => ({
  id,
  name,
  quantity,
  unit,
  nutrition: { kcal, protein, carbs, fat },
  source: "sample",
});

export const sampleMeals: Meal[] = [
  {
    id: "breakfast",
    name: "Oats, yogurt & berries",
    slot: "Breakfast",
    foods: [
      food("oats", "Rolled oats", 40, "g", 150, 5, 27, 3),
      food("yogurt", "Greek yogurt", 150, "g", 100, 15, 6, 2),
      food("berries", "Mixed berries", 100, "g", 50, 1, 12, 0.5),
    ],
  },
  {
    id: "lunch",
    name: "Chickpea crunch bowl",
    slot: "Lunch",
    foods: [
      food("chickpeas", "Cooked chickpeas", 150, "g", 246, 13, 41, 4),
      food("salad", "Mixed salad vegetables", 200, "g", 64, 3, 12, 1),
      food("dressing", "Tahini dressing", 30, "g", 150, 4, 5, 13),
    ],
  },
  {
    id: "dinner",
    name: "Tofu & rice nourish bowl",
    slot: "Dinner",
    foods: [
      food("rice", "Cooked rice", 180, "g", 234, 4, 51, 1),
      food("tofu", "Firm tofu", 150, "g", 216, 22, 5, 12),
      food("vegetables", "Roasted vegetables", 150, "g", 90, 2, 14, 3),
    ],
  },
];

export function initialState(): AppState {
  return {
    version: 1,
    onboarding: "welcome",
    goal: "habits",
    templates: sampleMeals.map(copyMeal),
    entries: [],
  };
}
