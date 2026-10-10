import { newId, type Meal, type Nutrients } from "./meals";

export type Product = {
  barcode: string;
  name: string;
  brands: string;
  ingredients: string;
  allergens: string[];
  traces: string[];
  grade: "a" | "b" | "c" | "d" | "e" | null;
  nova: number | null;
  nutrition: Nutrients;
  sugars: number | null;
  saturatedFat: number | null;
  salt: number | null;
  fiber: number | null;
  levels: Record<
    "sugars" | "saturated-fat" | "salt" | "fat",
    "low" | "moderate" | "high" | null
  >;
  serving: string;
  sourceUrl: string;
};

/** GTIN check digit; preserve leading zeros and reject URLs/QR payloads. */
export function normalizeBarcode(raw: string): string {
  const code = raw.trim().replace(/[ -]/g, "");
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(code) || /^0+$/.test(code))
    throw new Error(
      "Enter the 8, 12, 13 or 14 digits printed below a food barcode.",
    );
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce(
      (total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1),
      0,
    );
  if ((10 - (sum % 10)) % 10 !== check)
    throw new Error(
      "The barcode check digit does not match. Check the printed number and try again.",
    );
  return code.length === 12
    ? `0${code}`
    : code.length === 14 && code.startsWith("0")
      ? code.slice(1)
      : code;
}
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function text(value: unknown, max = 160): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function tags(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((x): x is string => typeof x === "string")
        .slice(0, 40)
        .map((x) =>
          x
            .replace(/^[a-z]{2}:/, "")
            .replace(/-/g, " ")
            .slice(0, 100),
        )
    : [];
}
function nutrient(value: unknown, max = 100): number | null {
  if (
    typeof value !== "number" &&
    !(typeof value === "string" && /^\d+(\.\d+)?$/.test(value))
  )
    return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= max ? n : null;
}
export function parseProduct(raw: unknown, requested: string): Product {
  const response = object(raw);
  if (response.status === 0)
    throw new Error(
      "Product not found. Try the printed barcode or enter this food manually.",
    );
  const p = object(response.product);
  if (response.status !== 1 || !Object.keys(p).length)
    throw new Error(
      "The product service returned incomplete data. Try again later.",
    );
  const barcode = normalizeBarcode(requested);
  if (p.code && normalizeBarcode(String(p.code)) !== barcode)
    throw new Error(
      "The returned product does not match this barcode. Check the package.",
    );
  const n = object(p.nutriments);
  const grade = text(p.nutriscore_grade || p.nutrition_grades).toLowerCase();
  const levels = object(p.nutrient_levels);
  const kcal = nutrient(n["energy-kcal_100g"], 1000);
  const kj = nutrient(n["energy-kj_100g"], 4184);
  const level = (key: string) =>
    ["low", "moderate", "high"].includes(String(levels[key]))
      ? (levels[key] as "low" | "moderate" | "high")
      : null;
  return {
    barcode,
    name: text(p.product_name_en) || text(p.product_name) || "Unnamed product",
    brands: text(p.brands),
    ingredients:
      text(p.ingredients_text_en, 12000) || text(p.ingredients_text, 12000),
    allergens: tags(p.allergens_tags),
    traces: tags(p.traces_tags),
    grade: /^[abcde]$/.test(grade) ? (grade as Product["grade"]) : null,
    nova: [1, 2, 3, 4].includes(Number(p.nova_group))
      ? Number(p.nova_group)
      : null,
    nutrition: {
      kcal: kcal ?? (kj === null ? null : kj / 4.184),
      protein: nutrient(n.proteins_100g),
      carbs: nutrient(n.carbohydrates_100g),
      fat: nutrient(n.fat_100g),
    },
    sugars: nutrient(n.sugars_100g),
    saturatedFat: nutrient(n["saturated-fat_100g"]),
    salt: nutrient(n.salt_100g),
    fiber: nutrient(n.fiber_100g),
    levels: {
      sugars: level("sugars"),
      "saturated-fat": level("saturated-fat"),
      salt: level("salt"),
      fat: level("fat"),
    },
    serving: text(p.serving_size),
    sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
  };
}
export function productSummary(p: Product): string {
  if (!p.grade) return "Not enough data to rate";
  if (p.grade === "a" || p.grade === "b")
    return "More favorable nutrition profile";
  if (p.grade === "c") return "Mixed nutrition profile";
  return "Less favorable nutrition profile";
}
export function productMeal(
  p: Product,
  quantity: number,
  unit: "g" | "ml",
): Meal {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000)
    throw new Error("Choose a portion greater than 0 and up to 1,000 g or ml.");
  if (!["g", "ml"].includes(unit))
    throw new Error("Check the label and select grams or milliliters.");
  if (Object.values(p.nutrition).every((x) => x === null))
    throw new Error(
      "No nutrition was found. Enter this food manually from the label.",
    );
  return {
    id: newId(),
    name: p.name.slice(0, 100),
    slot: "Snack",
    foods: [
      {
        id: newId(),
        name: p.name.slice(0, 80),
        quantity,
        unit,
        nutrition: Object.fromEntries(
          Object.entries(p.nutrition).map(([key, value]) => [
            key,
            value === null ? null : (value * quantity) / 100,
          ]),
        ) as Nutrients,
        source: "barcode",
        sourceBarcode: p.barcode,
      },
    ],
  };
}

export function formatProductValue(value: number | null): string {
  if (value === null) return "—";
  if (value > 0 && value < 0.01) return "<0.01";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
