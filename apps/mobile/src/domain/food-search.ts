import {
  Entry,
  Food,
  Meal,
  newId,
  nutrientKeys,
  Nutrients,
  Slot,
} from "./meals";

/**
 * One searchable food. Same shape as the server's searchFoodsCallable
 * (functions/src/foodSearch.js) so either route can feed the search screen.
 */
export type FoodCandidate = {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  source: "usda" | "openfoodfacts";
  dataType: string | null;
  basis: "g" | "ml";
  /** Nutrition per 100 g or 100 ml; null means the source did not report it. */
  per100: Nutrients;
  /** Amounts in `basis` units; the last one is always 100. */
  servings: { label: string; amount: number }[];
};

const PER_100_MAX: Record<keyof Nutrients, number> = {
  kcal: 950,
  protein: 100,
  carbs: 100,
  fat: 100,
};

function nutrient(value: unknown, key: keyof Nutrients): number | null {
  const number =
    typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (
    typeof number !== "number" ||
    !Number.isFinite(number) ||
    number < 0 ||
    number > PER_100_MAX[key]
  )
    return null;
  return Math.round(number * 10) / 10;
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean ? clean.slice(0, max) : null;
}

const known = (per100: Nutrients) =>
  nutrientKeys.some((key) => per100[key] !== null);

/** Map an Open Food Facts search-a-licious hit; mirrors the server mapper. */
export function mapOffHit(hit: unknown): FoodCandidate | null {
  if (!hit || typeof hit !== "object") return null;
  const product = hit as Record<string, unknown>;
  const name =
    text(product.product_name_en, 120) ?? text(product.product_name, 120);
  const barcode =
    typeof product.code === "string" && /^\d{8,14}$/.test(product.code.trim())
      ? product.code.trim()
      : null;
  if (!name || !barcode) return null;
  const n = (product.nutriments ?? {}) as Record<string, unknown>;
  const kilojoules = Number(n["energy-kj_100g"]);
  const per100: Nutrients = {
    kcal:
      nutrient(n["energy-kcal_100g"], "kcal") ??
      (Number.isFinite(kilojoules) && kilojoules > 0
        ? nutrient(kilojoules / 4.184, "kcal")
        : null),
    protein: nutrient(n.proteins_100g, "protein"),
    carbs: nutrient(n.carbohydrates_100g, "carbs"),
    fat: nutrient(n.fat_100g, "fat"),
  };
  if (!known(per100)) return null;
  const brands = Array.isArray(product.brands)
    ? product.brands
    : String(product.brands ?? "").split(",");
  return {
    id: `off:${barcode}`,
    name,
    brand: brands.map((value) => text(value, 80)).find(Boolean) ?? null,
    barcode,
    source: "openfoodfacts",
    dataType: null,
    basis: "g",
    per100,
    servings: [{ label: "100 g", amount: 100 }],
  };
}

/** Validate a server response; anything malformed is dropped, not trusted. */
export function parseCandidates(raw: unknown): FoodCandidate[] {
  const list = (raw as { results?: unknown })?.results;
  if (!Array.isArray(list))
    throw new Error("Search results could not be read.");
  return list.flatMap((item): FoodCandidate[] => {
    const c = item as Partial<FoodCandidate> | null;
    if (
      !c ||
      typeof c.id !== "string" ||
      !/^(usda|off):[0-9]{1,14}$/.test(c.id) ||
      !text(c.name, 120) ||
      (c.source !== "usda" && c.source !== "openfoodfacts") ||
      (c.basis !== "g" && c.basis !== "ml") ||
      !c.per100 ||
      !Array.isArray(c.servings)
    )
      return [];
    const per100 = Object.fromEntries(
      nutrientKeys.map((key) => [key, nutrient(c.per100![key], key)]),
    ) as Nutrients;
    const servings = c.servings
      .filter(
        (s) =>
          s &&
          text(s.label, 60) &&
          Number.isFinite(s.amount) &&
          s.amount > 0 &&
          s.amount <= 5000,
      )
      .slice(0, 6)
      .map((s) => ({ label: text(s.label, 60)!, amount: s.amount }));
    if (!known(per100) || !servings.length) return [];
    return [
      {
        id: c.id,
        name: text(c.name, 120)!,
        brand: text(c.brand, 80),
        barcode: typeof c.barcode === "string" ? c.barcode : null,
        source: c.source,
        dataType: text(c.dataType, 40),
        basis: c.basis,
        per100,
        servings,
      },
    ];
  });
}

/** A food snapshot for `count` × `amount` of a candidate. */
export function candidateFood(
  candidate: FoodCandidate,
  amount: number,
  count = 1,
): Food {
  const quantity = amount * count;
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000)
    throw new Error("Choose an amount greater than 0 and up to 10,000.");
  const rounded = Math.round(quantity * 10) / 10;
  const name = candidate.brand
    ? `${candidate.name} (${candidate.brand})`
    : candidate.name;
  return {
    id: newId(),
    name: name.slice(0, 80),
    quantity: rounded,
    unit: candidate.basis,
    nutrition: Object.fromEntries(
      nutrientKeys.map((key) => [
        key,
        candidate.per100[key] === null
          ? null
          : (candidate.per100[key]! * rounded) / 100,
      ]),
    ) as Nutrients,
    source: "search",
    sourceId: candidate.id,
    ...(candidate.barcode ? { sourceBarcode: candidate.barcode } : {}),
  };
}

/** A draft meal for review. Nothing is recorded until the user confirms it. */
export function basketMeal(foods: Food[], slot: Slot): Meal {
  if (!foods.length) throw new Error("Add at least one food.");
  if (foods.length > 30) throw new Error("Add up to 30 foods.");
  const names = foods.map((food) => food.name.replace(/ \(.*\)$/, ""));
  const name =
    names.length <= 2
      ? names.join(" + ")
      : `${names[0]} + ${names.length - 1} more`;
  return { id: newId(), name: name.slice(0, 100), slot, foods };
}

export type HistoryItem = {
  key: string;
  food: Food;
  count: number;
  lastDate: string;
};

/**
 * Foods from confirmed entries only — a skipped or drafted meal never
 * appears. Each item keeps the most recently logged portion.
 */
export function foodHistory(
  entries: Entry[],
  sort: "recent" | "frequent" = "recent",
  hidden: ReadonlySet<string> = new Set(),
): HistoryItem[] {
  const items = new Map<string, HistoryItem>();
  const ordered = entries
    .filter((entry) => entry.status === "confirmed")
    .sort((a, b) =>
      a.date === b.date
        ? a.updatedAt.localeCompare(b.updatedAt)
        : a.date.localeCompare(b.date),
    );
  for (const entry of ordered)
    for (const food of entry.foods) {
      const key =
        food.sourceId ??
        `${food.name.trim().toLowerCase()}|${food.unit.trim().toLowerCase()}`;
      if (hidden.has(key)) continue;
      const previous = items.get(key);
      items.set(key, {
        key,
        food,
        count: (previous?.count ?? 0) + 1,
        lastDate: entry.date,
      });
    }
  const list = [...items.values()];
  list.sort((a, b) =>
    sort === "frequent" && a.count !== b.count
      ? b.count - a.count
      : b.lastDate.localeCompare(a.lastDate),
  );
  return list;
}

/** Fresh ids so re-adding a history food never shares identity with the original. */
export function repeatFood(food: Food): Food {
  return { ...food, id: newId(), nutrition: { ...food.nutrition } };
}
