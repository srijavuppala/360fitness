import { Meal, newId, Nutrients, nutrientKeys, validateMeal } from "./meals";

export type LabelFields = Record<keyof Nutrients, string>;
export type LabelBasis = "100g" | "100ml" | "serving";
export const emptyLabel: LabelFields = {
  kcal: "",
  protein: "",
  carbs: "",
  fat: "",
};

function decimal(
  raw: string,
  name: string,
  max: number,
  optional = false,
): number | null {
  const text = raw.trim();
  if (!text && optional) return null;
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text))
    throw new Error(
      `${name}: enter a number using a decimal point, or leave unknown nutrition blank.`,
    );
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0 || value > max)
    throw new Error(`${name} must be between 0 and ${max.toLocaleString()}.`);
  return value;
}

export function labelNutrition(
  fields: LabelFields,
  energyUnit: "kcal" | "kJ",
): Nutrients {
  const energy = decimal(
    fields.kcal,
    "Energy",
    energyUnit === "kJ" ? 41840 : 10000,
    true,
  );
  return {
    kcal:
      energy === null ? null : energyUnit === "kJ" ? energy / 4.184 : energy,
    protein: decimal(fields.protein, "Protein", 10000, true),
    carbs: decimal(fields.carbs, "Carbohydrates", 10000, true),
    fat: decimal(fields.fat, "Fat", 10000, true),
  };
}

export function labelPortion(
  fields: LabelFields,
  energyUnit: "kcal" | "kJ",
  basis: LabelBasis,
  portion: string,
): Nutrients {
  const nutrition = labelNutrition(fields, energyUnit);
  const quantity = decimal(
    portion,
    "Your portion",
    basis === "serving" ? 100 : 10000,
  )!;
  if (!quantity) throw new Error("Your portion must be greater than zero.");
  if (nutrientKeys.every((key) => nutrition[key] === null))
    throw new Error("Enter at least one nutrition value from the label.");
  const factor = basis === "serving" ? quantity : quantity / 100;
  const result = Object.fromEntries(
    nutrientKeys.map((key) => [
      key,
      nutrition[key] === null ? null : nutrition[key]! * factor,
    ]),
  ) as Nutrients;
  if (nutrientKeys.some((key) => result[key] !== null && result[key]! > 10000))
    throw new Error(
      "This portion exceeds the meal editor’s limits. Check the label basis and portion.",
    );
  return result;
}

export function labelMeal(input: {
  name: string;
  fields: LabelFields;
  energyUnit: "kcal" | "kJ";
  basis: LabelBasis;
  portion: string;
  checked: boolean;
  source?: "manual" | "ai";
}): Meal {
  if (!input.checked)
    throw new Error("Check the values and portion against the label first.");
  const nutrition = labelPortion(
    input.fields,
    input.energyUnit,
    input.basis,
    input.portion,
  );
  const meal: Meal = {
    id: newId(),
    name: input.name.trim(),
    slot: "Snack",
    foods: [
      {
        id: newId(),
        name: input.name.trim(),
        quantity: Number(input.portion.trim()),
        unit:
          input.basis === "100g"
            ? "g"
            : input.basis === "100ml"
              ? "ml"
              : "serving",
        nutrition,
        source: input.source ?? "manual",
      },
    ],
  };
  validateMeal(meal);
  return meal;
}

/** Conservative single-column English label-text import. Never infer a serving basis. */
export function readLabelText(text: string): {
  fields: LabelFields;
  energyUnit: "kcal" | "kJ";
  found: number;
} {
  if (text.length > 6000)
    throw new Error("Paste up to 6,000 characters from one nutrition column.");
  const matches: Record<keyof Nutrients, string[]> = {
    kcal: [],
    protein: [],
    carbs: [],
    fat: [],
  };
  let energyUnit: "kcal" | "kJ" = "kcal";
  const number = "(\\d+(?:\\.\\d+)?|\\.\\d+)";
  for (const line of text.split(/\r?\n/).map((line) => line.trim())) {
    // Anchors avoid confusing saturated fat, sugars, % DV, or a second column with totals.
    const macro = line.match(
      new RegExp(
        `^(protein|(?:total\\s+)?carbohydrates?|(?:total\\s+)?fat)\\s*:?\\s*${number}\\s*g(?:\\s+\\d+(?:\\.\\d+)?\\s*%)?$`,
        "i",
      ),
    );
    if (macro) {
      const key = /protein/i.test(macro[1])
        ? "protein"
        : /carbo/i.test(macro[1])
          ? "carbs"
          : "fat";
      matches[key].push(macro[2]);
    }
    const calories = line.match(
      new RegExp(`^(?:calories|energy)\\s*:?\\s*${number}\\s*(kcal|kj)?$`, "i"),
    );
    if (calories && (/^calories/i.test(line) || calories[2])) {
      matches.kcal.push(calories[1]);
      energyUnit = calories[2]?.toLowerCase() === "kj" ? "kJ" : "kcal";
    }
  }
  if (nutrientKeys.some((key) => matches[key].length > 1))
    throw new Error(
      "More than one nutrition column was found. Paste only one column, or enter values manually.",
    );
  const fields = Object.fromEntries(
    nutrientKeys.map((key) => [key, matches[key][0] ?? ""]),
  ) as LabelFields;
  labelNutrition(fields, energyUnit);
  const found = nutrientKeys.filter((key) => fields[key] !== "").length;
  if (!found)
    throw new Error(
      "No unambiguous values found. Use one line per value, such as ‘Protein 6 g’, or enter them below.",
    );
  return { fields, energyUnit, found };
}
