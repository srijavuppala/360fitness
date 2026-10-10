import assert from "node:assert/strict";
import { test } from "node:test";
import {
  formatProductValue,
  normalizeBarcode,
  parseProduct,
  productMeal,
  productSummary,
} from "../src/domain/product-scan";
import { createProductLookup } from "../src/services/product-lookup";
import { initialState } from "../src/domain/fixtures";
import { parseSavedState, recordMeal, validateMeal } from "../src/domain/meals";

const barcode = "3017620422003";
function payload(extra: Record<string, unknown> = {}) {
  return {
    status: 1,
    product: {
      code: barcode,
      product_name: "Test spread",
      nutriscore_grade: "e",
      nutriments: {
        "energy-kcal_100g": 500,
        proteins_100g: 10,
        carbohydrates_100g: 50,
        fat_100g: 30,
        sugars_100g: 40,
      },
      nutrient_levels: { sugars: "high" },
      allergens_tags: ["en:milk"],
      ...extra,
    },
  };
}
test("GTIN validation preserves leading zeros and normalizes UPC/EAN equivalence", () => {
  assert.equal(normalizeBarcode("3017 620422003"), barcode);
  assert.equal(normalizeBarcode("036000291452"), "0036000291452");
  assert.equal(normalizeBarcode("03017620422003"), barcode);
  for (const invalid of [
    "3017620422004",
    "https://example.com",
    "00000000",
    "123",
    "１２３４５６７８",
  ])
    assert.throws(() => normalizeBarcode(invalid));
});
test("unknown nutrients stay unknown; malformed grades and values do not become a favorable rating", () => {
  const p = parseProduct(
    payload({
      nutriscore_grade: "unknown",
      nutriments: {
        "energy-kcal_100g": "",
        proteins_100g: false,
        fat_100g: -2,
        carbohydrates_100g: 200,
      },
    }),
    barcode,
  );
  assert.deepEqual(p.nutrition, {
    kcal: null,
    protein: null,
    carbs: null,
    fat: null,
  });
  assert.equal(productSummary(p), "Not enough data to rate");
  assert.throws(() => productMeal(p, 30, "g"), /No nutrition/);
});
test("normalizes kJ energy but never confuses calories with kilojoules or missing zero values", () => {
  const p = parseProduct(
    payload({ nutriments: { "energy-kj_100g": 418.4, proteins_100g: 0 } }),
    barcode,
  );
  assert.ok(Math.abs(p.nutrition.kcal! - 100) < 0.001);
  assert.equal(p.nutrition.protein, 0);
  assert.equal(p.nutrition.carbs, null);
});
test("rejects absent, malformed and mismatched product results", () => {
  assert.throws(() => parseProduct({ status: 0 }, barcode), /not found/);
  assert.throws(
    () => parseProduct({ status: 1, product: [] }, barcode),
    /incomplete/,
  );
  assert.throws(
    () => parseProduct(payload({ code: "0036000291452" }), barcode),
    /does not match/,
  );
});
test("portion creates an unsaved draft with attribution and scales once through persisted meal flow", () => {
  const p = parseProduct(payload(), barcode);
  const meal = productMeal(p, 30, "g");
  const state = initialState();
  assert.equal(state.entries.length, 0);
  assert.equal(meal.foods[0].nutrition.kcal, 150);
  assert.equal(meal.foods[0].nutrition.protein, 3);
  assert.equal(meal.foods[0].source, "barcode");
  assert.equal(meal.foods[0].sourceBarcode, barcode);
  validateMeal(meal);
  assert.throws(() => productMeal(p, NaN, "g"));
  assert.throws(() => productMeal(p, 0, "ml"));
  assert.throws(() => productMeal(p, 1001, "g"));
  const saved = recordMeal(state, meal, "2026-10-07", "confirmed");
  assert.equal(
    parseSavedState(JSON.stringify(saved)).entries[0].foods[0].sourceBarcode,
    barcode,
  );
});
test("empty allergen data is retained as missing evidence; returned text is rendered as text", () => {
  const p = parseProduct(
    payload({
      allergens_tags: [],
      ingredients_text: "<script>not executable</script>",
      nova_group: 9,
    }),
    barcode,
  );
  assert.deepEqual(p.allergens, []);
  assert.equal(p.nova, null);
  assert.equal(p.ingredients, "<script>not executable</script>");
});
test("lookup caches valid results for ten minutes and rejects invalid scans before requesting", async () => {
  let calls = 0;
  let clock = 1000;
  const lookup = createProductLookup(
    async () => {
      calls++;
      return new Response(JSON.stringify(payload()));
    },
    () => clock,
  );
  await assert.rejects(() => lookup("123"));
  assert.equal(calls, 0);
  assert.equal((await lookup(barcode)).cached, false);
  assert.equal((await lookup(barcode)).cached, true);
  assert.equal(calls, 1);
  clock += 600001;
  assert.equal((await lookup(barcode)).cached, false);
  assert.equal(calls, 2);
});
test("service errors are actionable and failed results are not cached", async () => {
  let calls = 0;
  const lookup = createProductLookup(async () => {
    calls++;
    return new Response("", { status: 429 });
  });
  await assert.rejects(() => lookup(barcode), /Wait a minute/);
  await assert.rejects(() => lookup(barcode));
  assert.equal(calls, 2);
  await assert.rejects(
    () =>
      createProductLookup(async () => new Response("", { status: 404 }))(
        barcode,
      ),
    /not found/,
  );
  await assert.rejects(
    () =>
      createProductLookup(async () => {
        throw new TypeError("Network failed");
      })(barcode),
    /connection/,
  );
  await assert.rejects(
    () => createProductLookup(async () => new Response("not JSON"))(barcode),
    /unreadable/,
  );
});
test("lookup cancels on departure and times out without leaving a request behind", async () => {
  const abortable: typeof fetch = async (_url, options) =>
    new Promise((_resolve, reject) =>
      options?.signal?.addEventListener(
        "abort",
        () => reject(new Error("aborted")),
        { once: true },
      ),
    );
  const controller = new AbortController();
  const pending = createProductLookup(abortable)(barcode, controller.signal);
  controller.abort();
  await assert.rejects(() => pending, /cancelled/);
  await assert.rejects(
    () => createProductLookup(abortable, Date.now, 5)(barcode),
    /timed out/,
  );
});

test("small salt values remain visible instead of rounding to zero", () => {
  assert.equal(formatProductValue(0.107), "0.11");
  assert.equal(formatProductValue(0.001), "<0.01");
  assert.equal(formatProductValue(0), "0");
  assert.equal(formatProductValue(null), "—");
});
