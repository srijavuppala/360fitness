// Food text search over open data: USDA FoodData Central and Open Food Facts.
//
// Both sources are mapped to one FoodCandidate shape so the app never needs
// provider-specific parsing:
//
//   { id, name, brand, barcode, source, dataType, basis, per100, servings }
//
// `per100` is nutrition per 100 g (or 100 ml when basis is 'ml'). A nutrient
// the source does not report stays null — it is never turned into 0.
// `servings` are amounts in `basis` units; '100 g' is always present.

const USDA_ENDPOINT = 'https://api.nal.usda.gov/fdc/v1/foods/search';
// Search-a-licious; the legacy cgi/search.pl endpoint is frequently
// unavailable and heavily rate limited.
const OFF_ENDPOINT = 'https://search.openfoodfacts.org/search';
// Open Food Facts asks every client to identify itself.
const OFF_USER_AGENT = 'Fitness360/0.1 (food search)';

const MAX_LIMIT = 25;
const DEFAULT_LIMIT = 20;
const MAX_SERVINGS = 6;

// FDC nutrient ids. Foundation foods often report energy only as Atwater
// general (2047) or specific (2048) factors instead of 1008.
const USDA_ENERGY_IDS = [1008, 2047, 2048];
const USDA_NUTRIENT_IDS = { protein: 1003, carbs: 1005, fat: 1004 };

// Per-100 plausibility caps; anything above is a data-entry error.
const PER_100_MAX = { kcal: 950, protein: 100, carbs: 100, fat: 100 };

export class FoodSearchError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Validate callable input. Returns a normalized { query, limit }. */
export function validateSearchRequest(data) {
  const raw = data?.query;
  if (typeof raw !== 'string') throw new FoodSearchError('invalid-argument', 'Enter a food to search for.');
  const query = raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (query.length < 2) throw new FoodSearchError('invalid-argument', 'Type at least 2 characters.');
  if (query.length > 80) throw new FoodSearchError('invalid-argument', 'Search for up to 80 characters.');
  let limit = DEFAULT_LIMIT;
  if (data.limit !== undefined) {
    if (!Number.isInteger(data.limit) || data.limit < 1 || data.limit > MAX_LIMIT)
      throw new FoodSearchError('invalid-argument', `Limit must be a whole number from 1 to ${MAX_LIMIT}.`);
    limit = data.limit;
  }
  return { query, limit };
}

function nutrientValue(value, key) {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isFinite(number) || number < 0 || number > PER_100_MAX[key]) return null;
  return Math.round(number * 10) / 10;
}

function hasAnyNutrient(per100) {
  return Object.values(per100).some((value) => value !== null);
}

function cleanText(value, max = 120) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
}

function cleanBarcode(value) {
  const digits = typeof value === 'string' ? value.trim() : '';
  return /^\d{8,14}$/.test(digits) ? digits : null;
}

/** Barcodes compare equal across UPC-A / EAN-13 / GTIN-14 zero padding. */
function barcodeKey(barcode) {
  return barcode ? barcode.replace(/^0+/, '') : null;
}

function addServing(servings, label, amount) {
  if (!label || !Number.isFinite(amount) || amount <= 0 || amount > 5000) return;
  const rounded = Math.round(amount * 10) / 10;
  if (servings.some((serving) => serving.label === label)) return;
  if (servings.length < MAX_SERVINGS) servings.push({ label, amount: rounded });
}

// --- USDA FoodData Central --------------------------------------------------

function usdaBasis(unit) {
  const key = String(unit ?? '').trim().toLowerCase();
  if (['g', 'grm', 'gram', 'grams'].includes(key)) return 'g';
  if (['ml', 'mlt', 'milliliter', 'millilitre'].includes(key)) return 'ml';
  return null;
}

/** Map one FDC search hit to a FoodCandidate, or null when unusable. */
export function mapUsdaFood(food) {
  const name = cleanText(food?.description);
  if (!name || !Number.isInteger(food?.fdcId)) return null;
  const nutrients = Array.isArray(food.foodNutrients) ? food.foodNutrients : [];
  const read = (id) => {
    const match = nutrients.find((nutrient) => (nutrient?.nutrientId ?? nutrient?.nutrient?.id) === id);
    return match ? (match.value ?? match.amount) : undefined;
  };
  const energy = USDA_ENERGY_IDS.map(read).find((value) => value !== undefined);
  const per100 = {
    kcal: nutrientValue(energy, 'kcal'),
    protein: nutrientValue(read(USDA_NUTRIENT_IDS.protein), 'protein'),
    carbs: nutrientValue(read(USDA_NUTRIENT_IDS.carbs), 'carbs'),
    fat: nutrientValue(read(USDA_NUTRIENT_IDS.fat), 'fat'),
  };
  if (!hasAnyNutrient(per100)) return null;

  const branded = food.dataType === 'Branded';
  // Branded label nutrients are normalized by FDC to per 100 g or 100 ml.
  const basis = branded ? (usdaBasis(food.servingSizeUnit) ?? 'g') : 'g';
  const servings = [];
  if (branded) {
    const size = Number(food.servingSize);
    if (usdaBasis(food.servingSizeUnit) === basis && Number.isFinite(size)) {
      const household = cleanText(food.householdServingFullText, 40);
      const metric = `${Math.round(size * 10) / 10} ${basis}`;
      addServing(servings, household ? `${household} (${metric})` : metric, size);
    }
  }
  for (const measure of Array.isArray(food.foodMeasures) ? food.foodMeasures : []) {
    const text = cleanText(measure?.disseminationText, 40);
    if (text && text.toLowerCase() !== 'quantity not specified')
      addServing(servings, `${text} (${Math.round(measure.gramWeight)} g)`, measure.gramWeight);
  }
  addServing(servings, `100 ${basis}`, 100);

  return {
    id: `usda:${food.fdcId}`,
    name,
    brand: branded ? cleanText(food.brandName ?? food.brandOwner, 80) : null,
    barcode: branded ? cleanBarcode(food.gtinUpc) : null,
    source: 'usda',
    dataType: cleanText(food.dataType, 40),
    basis,
    per100,
    servings,
  };
}

export async function searchUsda(query, { apiKey, fetch: fetchImpl = globalThis.fetch, pageSize = DEFAULT_LIMIT, timeoutMs = 6000 } = {}) {
  const url = new URL(USDA_ENDPOINT);
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', String(pageSize));
  url.searchParams.set('dataType', 'Foundation,SR Legacy,Branded');
  const response = await fetchImpl(url, {
    headers: { 'x-api-key': apiKey, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`USDA search failed (${response.status})`);
  const payload = await response.json();
  return (Array.isArray(payload?.foods) ? payload.foods : []).map(mapUsdaFood).filter(Boolean);
}

// --- Open Food Facts --------------------------------------------------------

const OFF_FIELDS = 'code,product_name,product_name_en,brands,nutriments,serving_quantity,serving_quantity_unit,serving_size';

/** Map one Open Food Facts product to a FoodCandidate, or null when unusable. */
export function mapOpenFoodFactsProduct(product) {
  const name = cleanText(product?.product_name_en) ?? cleanText(product?.product_name);
  const barcode = cleanBarcode(product?.code);
  if (!name || !barcode) return null;
  const n = product.nutriments ?? {};
  // Some labels only state kilojoules; 1 kcal = 4.184 kJ.
  const kilojoules = Number(n['energy-kj_100g']);
  const per100 = {
    kcal: nutrientValue(n['energy-kcal_100g'], 'kcal') ??
      (Number.isFinite(kilojoules) && kilojoules > 0 ? nutrientValue(kilojoules / 4.184, 'kcal') : null),
    protein: nutrientValue(n.proteins_100g, 'protein'),
    carbs: nutrientValue(n.carbohydrates_100g, 'carbs'),
    fat: nutrientValue(n.fat_100g, 'fat'),
  };
  if (!hasAnyNutrient(per100)) return null;
  const basis = String(product.serving_quantity_unit ?? '').toLowerCase() === 'ml' ? 'ml' : 'g';
  const servings = [];
  const size = Number(product.serving_quantity);
  if (Number.isFinite(size)) {
    const label = cleanText(product.serving_size, 40);
    const metric = `${Math.round(size * 10) / 10} ${basis}`;
    addServing(servings, label && !label.includes(metric) ? `${label} (${metric})` : (label ?? metric), size);
  }
  addServing(servings, `100 ${basis}`, 100);
  // Search-a-licious returns brands as an array; the product API as a CSV string.
  const brands = Array.isArray(product.brands) ? product.brands : String(product.brands ?? '').split(',');
  const brand = brands.map((value) => cleanText(value, 80)).find(Boolean) ?? null;
  return {
    id: `off:${barcode}`,
    name,
    brand,
    barcode,
    source: 'openfoodfacts',
    dataType: null,
    basis,
    per100,
    servings,
  };
}

export async function searchOpenFoodFacts(query, { fetch: fetchImpl = globalThis.fetch, pageSize = DEFAULT_LIMIT, timeoutMs = 6000 } = {}) {
  const url = new URL(OFF_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('page_size', String(pageSize));
  url.searchParams.set('fields', OFF_FIELDS);
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': OFF_USER_AGENT, Accept: 'application/json' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Open Food Facts search failed (${response.status})`);
  const payload = await response.json();
  return (Array.isArray(payload?.hits) ? payload.hits : []).map(mapOpenFoodFactsProduct).filter(Boolean);
}

// --- Merging ----------------------------------------------------------------

/**
 * Generic USDA foods (Foundation, SR Legacy) first — they are the most
 * reliable and what "banana" usually means — then branded USDA and Open Food
 * Facts products alternately. A barcode seen in USDA hides the same OFF item.
 */
export function mergeResults(usda, off, limit) {
  const generic = usda.filter((food) => food.dataType !== 'Branded');
  const branded = usda.filter((food) => food.dataType === 'Branded');
  const seen = new Set(branded.map((food) => barcodeKey(food.barcode)).filter(Boolean));
  const products = off.filter((food) => !seen.has(barcodeKey(food.barcode)));
  const merged = [...generic];
  for (let index = 0; index < Math.max(branded.length, products.length); index++) {
    if (branded[index]) merged.push(branded[index]);
    if (products[index]) merged.push(products[index]);
  }
  const ids = new Set();
  return merged.filter((food) => !ids.has(food.id) && ids.add(food.id)).slice(0, limit);
}

/**
 * Build a cached search function. Results are cached only when every
 * configured source answered, so a transient outage is not remembered.
 */
export function createFoodSearch({
  usdaApiKey,
  fetch: fetchImpl = globalThis.fetch,
  now = Date.now,
  ttlMs = 10 * 60 * 1000,
  maxEntries = 300,
  timeoutMs = 6000,
} = {}) {
  const cache = new Map();
  return async function searchFoods({ query, limit }) {
    const key = `${query.toLowerCase()}|${limit}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < ttlMs) {
      cache.delete(key);
      cache.set(key, hit); // refresh LRU position
      return { ...hit.value, cached: true };
    }
    const options = { fetch: fetchImpl, pageSize: limit, timeoutMs };
    const [usda, off] = await Promise.allSettled([
      usdaApiKey ? searchUsda(query, { ...options, apiKey: usdaApiKey }) : Promise.resolve(null),
      searchOpenFoodFacts(query, options),
    ]);
    const status = (result) => (result.status === 'rejected' ? 'unavailable' : result.value === null ? 'not-configured' : 'ok');
    const sources = { usda: status(usda), openFoodFacts: status(off) };
    if (!Object.values(sources).includes('ok'))
      throw new FoodSearchError('unavailable', 'Food search is unavailable right now. You can still enter a food manually.');
    const value = {
      query,
      results: mergeResults(usda.value ?? [], off.status === 'fulfilled' ? off.value : [], limit),
      sources,
    };
    if (!Object.values(sources).includes('unavailable')) {
      cache.set(key, { at: now(), value });
      while (cache.size > maxEntries) cache.delete(cache.keys().next().value);
    }
    return { ...value, cached: false };
  };
}

/** Callable boundary; dependencies are injectable for auth/quota tests. */
export async function handleFoodSearchRequest(request, { search, consumeQuota }) {
  if (!request.auth?.uid) throw new FoodSearchError('unauthenticated', 'An app session is required for food search.');
  if (!request.app) throw new FoodSearchError('failed-precondition', 'App verification is required for food search.');
  const input = validateSearchRequest(request.data);
  await consumeQuota(request.auth.uid);
  return search(input);
}
