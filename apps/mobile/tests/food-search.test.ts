import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  basketMeal,
  candidateFood,
  type FoodCandidate,
  foodHistory,
  mapOffHit,
  parseCandidates,
  repeatFood,
} from "../src/domain/food-search";
import { emptyPrep, makeBatch, validatePrep } from "../src/domain/meal-prep";
import { type Entry, recordMeal, validateMeal } from "../src/domain/meals";
import { initialState } from "../src/domain/fixtures";
import { createFoodSearch } from "../src/services/food-search";

// Shared with the server tests so both mappers see the same real payload.
const offBanana = JSON.parse(
  readFileSync(
    new URL(
      "../../../functions/test/fixtures/off-search-banana.json",
      import.meta.url,
    ),
    "utf8",
  ),
) as { hits: unknown[] };

const banana: FoodCandidate = {
  id: "usda:173944",
  name: "Bananas, raw",
  brand: null,
  barcode: null,
  source: "usda",
  dataType: "SR Legacy",
  basis: "g",
  per100: { kcal: 89, protein: 1.1, carbs: 22.8, fat: null },
  servings: [
    { label: "1 medium (118 g)", amount: 118 },
    { label: "100 g", amount: 100 },
  ],
};

test("Open Food Facts hits map like the server mapper and drop empty products", () => {
  const mapped = offBanana.hits.map(mapOffHit).filter(Boolean);
  assert.deepEqual(
    mapped.map((food) => food!.id),
    ["off:01129441", "off:8857122695117", "off:00517706"],
  );
  assert.deepEqual(mapped[2], {
    id: "off:00517706",
    name: "Banana",
    brand: "M&S",
    barcode: "00517706",
    source: "openfoodfacts",
    dataType: null,
    basis: "g",
    per100: { kcal: 81, protein: 1.2, carbs: 20.3, fat: 0.1 },
    servings: [{ label: "100 g", amount: 100 }],
  });
  assert.equal(
    mapOffHit({
      code: "12345678",
      product_name: "Kj only",
      nutriments: { "energy-kj_100g": 418.4 },
    })!.per100.kcal,
    100,
  );
  for (const bad of [
    null,
    "x",
    { code: "abc", product_name: "X", nutriments: { "energy-kcal_100g": 1 } },
  ])
    assert.equal(mapOffHit(bad), null);
});

test("server results are validated rather than trusted", () => {
  assert.deepEqual(parseCandidates({ results: [banana] }), [banana]);
  const tampered = [
    { ...banana, id: "javascript:alert(1)" },
    { ...banana, source: "other" },
    {
      ...banana,
      per100: { kcal: 5000, protein: null, carbs: null, fat: null },
    },
    { ...banana, servings: [{ label: "", amount: 100 }] },
    null,
  ];
  assert.deepEqual(parseCandidates({ results: tampered }), []);
  assert.throws(() => parseCandidates(null));
});

test("a chosen portion scales per-100 nutrition and keeps unknowns unknown", () => {
  const food = candidateFood(banana, 118, 2);
  assert.equal(food.quantity, 236);
  assert.equal(food.unit, "g");
  assert.equal(food.source, "search");
  assert.equal(food.sourceId, "usda:173944");
  assert.ok(Math.abs(food.nutrition.kcal! - 210.04) < 0.001);
  assert.equal(food.nutrition.fat, null);
  assert.throws(() => candidateFood(banana, 118, 0));
  assert.throws(() => candidateFood(banana, 5000, 3));
  const branded = candidateFood(
    { ...banana, brand: "Chiquita", barcode: "12345678" },
    100,
  );
  assert.equal(branded.name, "Bananas, raw (Chiquita)");
  assert.equal(branded.sourceBarcode, "12345678");
});

test("a basket becomes a valid draft meal, and search foods are valid in prep plans", () => {
  const foods = [
    candidateFood(banana, 118),
    candidateFood(banana, 100),
    candidateFood(banana, 50),
  ];
  const meal = basketMeal(foods, "Lunch");
  assert.equal(meal.slot, "Lunch");
  assert.equal(meal.name, "Bananas, raw + 2 more");
  validateMeal(meal);
  assert.equal(
    basketMeal(foods.slice(0, 2), "Snack").name,
    "Bananas, raw + Bananas, raw",
  );
  assert.throws(() => basketMeal([], "Lunch"));
  // A searched food can become a prep ingredient without failing validation.
  const batch = makeBatch(meal, "2026-10-20", 2);
  assert.doesNotThrow(() => validatePrep({ ...emptyPrep(), batches: [batch] }));
});

test("history counts confirmed foods only and keeps the latest portion", () => {
  let state = initialState();
  const day = (
    date: string,
    quantity: number,
    status: Entry["status"] = "confirmed",
  ) => {
    const food = candidateFood(banana, quantity);
    state = recordMeal(state, basketMeal([food], "Snack"), date, status);
  };
  day("2026-10-01", 100);
  day("2026-10-03", 150);
  day("2026-10-04", 999, "skipped");
  const yogurt = {
    ...candidateFood(banana, 170),
    name: "Greek yogurt",
    sourceId: undefined,
  };
  state = recordMeal(
    state,
    basketMeal([yogurt], "Breakfast"),
    "2026-10-02",
    "confirmed",
  );

  const fromSearch = foodHistory(
    state.entries.filter((e) => e.date >= "2026-10-01"),
  );
  const bananaItem = fromSearch.find((item) => item.key === "usda:173944")!;
  assert.equal(bananaItem.count, 2);
  assert.equal(bananaItem.food.quantity, 150);
  assert.equal(bananaItem.lastDate, "2026-10-03");
  assert.ok(fromSearch.some((item) => item.key === "greek yogurt|g"));
  assert.equal(fromSearch[0].key, "usda:173944");

  const frequent = foodHistory(state.entries, "frequent");
  assert.ok(
    frequent.findIndex((i) => i.key === "usda:173944") <
      frequent.findIndex((i) => i.key === "greek yogurt|g"),
  );
  assert.ok(
    !foodHistory(state.entries, "recent", new Set(["usda:173944"])).some(
      (i) => i.key === "usda:173944",
    ),
  );

  const again = repeatFood(bananaItem.food);
  assert.notEqual(again.id, bananaItem.food.id);
  assert.deepEqual(again.nutrition, bananaItem.food.nutrition);
});

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

test("Expo Go searches Open Food Facts directly", async () => {
  const urls: string[] = [];
  const search = createFoodSearch({
    route: "direct",
    fetcher: async (url) => {
      urls.push(String(url));
      return json(offBanana);
    },
  });
  const outcome = await search("  banana  ");
  assert.equal(outcome.route, "direct");
  assert.equal(outcome.results.length, 3);
  assert.match(
    urls[0],
    /^https:\/\/search\.openfoodfacts\.org\/search\?q=banana&/,
  );
  assert.deepEqual(await search("a"), { results: [], route: "direct" });
  assert.equal(urls.length, 1);
});

test("signed builds use the callable and fall back to open data if it fails", async () => {
  const calls: { url: string; body?: string; headers?: HeadersInit }[] = [];
  const connect = async () => ({
    url: "https://us-central1-demo.cloudfunctions.net/analyzeLabelCallable",
    headers: { Authorization: "Bearer t", "X-Firebase-AppCheck": "a" },
  });
  const server = createFoodSearch({
    route: "server",
    connect,
    fetcher: async (url, init) => {
      calls.push({
        url: String(url),
        body: init?.body as string,
        headers: init?.headers,
      });
      return json({ result: { results: [banana] } });
    },
  });
  assert.deepEqual(await server("banana"), {
    results: [banana],
    route: "server",
  });
  assert.equal(
    calls[0].url,
    "https://us-central1-demo.cloudfunctions.net/searchFoodsCallable",
  );
  assert.deepEqual(JSON.parse(calls[0].body!), {
    data: { query: "banana", limit: 20 },
  });

  const fallback = createFoodSearch({
    route: "server",
    connect,
    fetcher: async (url) =>
      String(url).includes("cloudfunctions")
        ? json({ error: { status: "NOT_FOUND" } }, 404)
        : json(offBanana),
  });
  assert.equal((await fallback("banana")).route, "direct");

  const limited = createFoodSearch({
    route: "server",
    connect,
    fetcher: async () => json({ error: { status: "RESOURCE_EXHAUSTED" } }, 429),
  });
  await assert.rejects(() => limited("banana"), /limit reached/);
});

test("browser preview and outages give a manual-entry message", async () => {
  const web = createFoodSearch({ route: "unavailable", fetcher: fetch });
  await assert.rejects(() => web("banana"), /runs in the phone app/);
  const down = createFoodSearch({
    route: "direct",
    fetcher: async () => json({}, 503),
  });
  await assert.rejects(() => down("banana"), /enter a food manually/);
  const slow = createFoodSearch({
    route: "direct",
    timeoutMs: 10,
    fetcher: (_url, init) =>
      new Promise((_, reject) =>
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        ),
      ),
  });
  await assert.rejects(() => slow("banana"), /took too long/);
  const controller = new AbortController();
  const pending = createFoodSearch({
    route: "direct",
    fetcher: (_url, init) =>
      new Promise((_, reject) =>
        init?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        ),
      ),
  })("banana", controller.signal);
  controller.abort();
  await assert.rejects(() => pending, /cancelled/);
});
