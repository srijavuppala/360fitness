import { Meal, newId } from "./meals";
import { makeBatch, PrepBatch } from "./meal-prep";

export type PrepRecipe = {
  id: string;
  name: string;
  category: "Breakfast" | "Lunch";
  minutes: number;
  description: string;
  ingredients: readonly (readonly [
    name: string,
    quantity: number,
    unit: string,
  ])[];
  steps: readonly string[];
};

// Original assembly ideas, not verified nutrient data or allergy recommendations.
// Quantities are edible, ready-to-use amounts for one serving.
export const prepRecipes: readonly PrepRecipe[] = [
  {
    id: "berry-yogurt",
    name: "Berry yogurt pots",
    category: "Breakfast",
    minutes: 10,
    description: "Creamy yogurt, berries and a crunchy topping.",
    ingredients: [
      ["Pasteurized plain Greek yogurt", 170, "g"],
      ["Fresh blueberries", 80, "g"],
      ["Ready-to-eat granola", 30, "g"],
    ],
    steps: [
      "Divide the yogurt between your serving containers.",
      "Add the blueberries. Keep the granola separate and add it when you eat for more crunch.",
    ],
  },
  {
    id: "peach-cottage",
    name: "Peach & cottage cheese",
    category: "Breakfast",
    minutes: 10,
    description: "A fruit bowl with a spoonful of pumpkin seeds.",
    ingredients: [
      ["Pasteurized cottage cheese", 150, "g"],
      ["Fresh peach, pitted", 120, "g"],
      ["Ready-to-eat pumpkin seeds", 15, "g"],
    ],
    steps: [
      "Slice the peaches and divide the cottage cheese between your containers.",
      "Add the peach slices. Pack the pumpkin seeds separately to add when serving.",
    ],
  },
  {
    id: "banana-wrap",
    name: "Banana peanut butter wrap",
    category: "Breakfast",
    minutes: 10,
    description: "A simple roll-up to assemble when you eat.",
    ingredients: [
      ["Ready-to-eat whole-wheat tortilla", 1, "piece"],
      ["Peanut butter", 25, "g"],
      ["Banana, peeled", 100, "g"],
    ],
    steps: [
      "Portion the peanut butter and tortillas. Keep bananas whole until you are ready to eat.",
      "At serving time, peel and slice the banana. Spread peanut butter on a tortilla, add banana and roll it up.",
    ],
  },
  {
    id: "chickpea-lemon",
    name: "Lemon chickpea crunch",
    category: "Lunch",
    minutes: 15,
    description: "Chickpeas, cucumber and tomatoes with lemon.",
    ingredients: [
      ["Canned chickpeas, drained", 150, "g"],
      ["Fresh cucumber", 100, "g"],
      ["Fresh cherry tomatoes", 80, "g"],
      ["Lemon juice", 15, "ml"],
      ["Olive oil", 5, "ml"],
    ],
    steps: [
      "Drain the canned chickpeas. Dice the cucumber and halve the tomatoes.",
      "Mix the lemon juice and olive oil, then toss with the chickpeas and vegetables. Divide evenly between your containers.",
    ],
  },
  {
    id: "white-bean-pita",
    name: "White bean pita pockets",
    category: "Lunch",
    minutes: 15,
    description: "Mashed beans and crisp carrot, packed separately.",
    ingredients: [
      ["Canned white beans, drained", 140, "g"],
      ["Ready-to-eat whole-wheat pita", 1, "piece"],
      ["Fresh carrot", 60, "g"],
      ["Lemon juice", 10, "ml"],
      ["Olive oil", 5, "ml"],
    ],
    steps: [
      "Drain the canned beans, then mash with lemon juice and olive oil. Grate the carrot.",
      "Portion the bean filling and carrot. Keep the pita separate and fill it when you are ready to eat.",
    ],
  },
  {
    id: "hummus-wrap",
    name: "Hummus veggie wraps",
    category: "Lunch",
    minutes: 15,
    description: "Colorful vegetables with ready-to-eat hummus.",
    ingredients: [
      ["Ready-to-eat hummus", 70, "g"],
      ["Ready-to-eat whole-wheat tortilla", 1, "piece"],
      ["Fresh bell pepper", 80, "g"],
      ["Fresh cucumber", 80, "g"],
    ],
    steps: [
      "Cut the pepper and cucumber into thin strips. Portion the hummus and vegetables into containers.",
      "Keep tortillas separate. When serving, spread hummus on a tortilla, add the vegetables and roll it up.",
    ],
  },
];

export function batchFromRecipe(
  recipe: PrepRecipe,
  date: string,
  servings: number,
): PrepBatch {
  const meal: Meal = {
    id: newId(),
    name: recipe.name,
    slot: recipe.category,
    foods: recipe.ingredients.map(([name, quantity, unit]) => ({
      id: newId(),
      name,
      quantity,
      unit,
      source: "manual",
      nutrition: { kcal: null, protein: null, carbs: null, fat: null },
      estimateNote:
        "Starter recipe: nutrition has not been calculated. Use your product label to fill it in.",
    })),
  };
  return {
    ...makeBatch(
      meal,
      date,
      servings,
      "An editable starter recipe. Nutrition is unknown until you enter label values. Check every product label for your dietary needs and allergies. Follow package storage instructions. Prep time is approximate; some recipes are assembled when serving.",
    ),
    guide: {
      completed: 0,
      steps: [
        "Wash your hands and rinse fresh produce under running water. Gather the batch amounts shown in Ingredients. Use clean utensils and containers.",
        ...recipe.steps,
        "Your components are portioned. Refrigerate perishable ingredients promptly and follow each product’s storage instructions. Keep toppings or bread separate where the recipe suggests it.",
      ],
    },
  };
}
