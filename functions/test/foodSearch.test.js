import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { nextSearchUsage } from '../src/accessPolicy.js';
import {
  createFoodSearch,
  FoodSearchError,
  handleFoodSearchRequest,
  mapOpenFoodFactsProduct,
  mapUsdaFood,
  mergeResults,
  validateSearchRequest,
} from '../src/foodSearch.js';

const fixture = (name) => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const usdaBanana = fixture('usda-search-banana.json');
const offBanana = fixture('off-search-banana.json');

const json = (body) => ({ ok: true, json: async () => body });
/** Routes by host so tests never touch the network. */
function fakeFetch({ usda = () => json(usdaBanana), off = () => json(offBanana) } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    const target = new URL(url);
    calls.push({ url: target, init });
    if (target.host === 'api.nal.usda.gov') return usda(target, init);
    if (target.host === 'search.openfoodfacts.org') return off(target, init);
    throw new Error(`unexpected host ${target.host}`);
  };
  return { fetch, calls };
}

describe('validateSearchRequest', () => {
  it('normalizes whitespace and applies the default limit', () => {
    assert.deepEqual(validateSearchRequest({ query: '  greek \n yogurt ' }), { query: 'greek yogurt', limit: 20 });
  });

  it('rejects missing, short, long and non-string queries', () => {
    for (const data of [undefined, {}, { query: 5 }, { query: ' a ' }, { query: 'x'.repeat(81) }])
      assert.throws(() => validateSearchRequest(data), (error) => error.code === 'invalid-argument');
  });

  it('accepts a whole-number limit from 1 to 25 only', () => {
    assert.equal(validateSearchRequest({ query: 'egg', limit: 5 }).limit, 5);
    for (const limit of [0, 26, 2.5, '5'])
      assert.throws(() => validateSearchRequest({ query: 'egg', limit }), (error) => error.code === 'invalid-argument');
  });
});

describe('mapUsdaFood', () => {
  const byId = (id) => usdaBanana.foods.find((food) => food.fdcId === id);

  it('maps a generic SR Legacy food per 100 g', () => {
    assert.deepEqual(mapUsdaFood(byId(173944)), {
      id: 'usda:173944',
      name: 'Bananas, raw',
      brand: null,
      barcode: null,
      source: 'usda',
      dataType: 'SR Legacy',
      basis: 'g',
      per100: { kcal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 },
      servings: [{ label: '100 g', amount: 100 }],
    });
  });

  it('maps a branded food with its label serving and barcode', () => {
    const food = mapUsdaFood(byId(2012128));
    assert.equal(food.dataType, 'Branded');
    assert.equal(food.barcode, '016459200441');
    assert.deepEqual(food.per100, { kcal: 312, protein: 12.5, carbs: 40.6, fat: 6.3 });
    assert.deepEqual(food.servings, [{ label: '2 Tbsp (32 g)', amount: 32 }, { label: '100 g', amount: 100 }]);
  });

  it('falls back to Atwater energy when 1008 is absent', () => {
    const food = mapUsdaFood({ fdcId: 1, description: 'Kale, raw', dataType: 'Foundation', foodNutrients: [{ nutrientId: 2047, value: 43 }] });
    assert.deepEqual(food.per100, { kcal: 43, protein: null, carbs: null, fat: null });
  });

  it('includes portion weights when the record has them', () => {
    const food = mapUsdaFood({
      ...byId(173944),
      foodMeasures: [
        { disseminationText: '1 medium', gramWeight: 118 },
        { disseminationText: 'Quantity not specified', gramWeight: 118 },
      ],
    });
    assert.deepEqual(food.servings, [{ label: '1 medium (118 g)', amount: 118 }, { label: '100 g', amount: 100 }]);
  });

  it('keeps unreported or implausible nutrients unknown instead of zero', () => {
    const food = mapUsdaFood({ fdcId: 2, description: 'Odd', foodNutrients: [{ nutrientId: 1008, value: 50 }, { nutrientId: 1003, value: 400 }, { nutrientId: 1004, value: -1 }] });
    assert.deepEqual(food.per100, { kcal: 50, protein: null, carbs: null, fat: null });
  });

  it('drops records without a name, id or any nutrition', () => {
    assert.equal(mapUsdaFood({ fdcId: 3, description: '', foodNutrients: [{ nutrientId: 1008, value: 1 }] }), null);
    assert.equal(mapUsdaFood({ description: 'No id', foodNutrients: [{ nutrientId: 1008, value: 1 }] }), null);
    assert.equal(mapUsdaFood({ fdcId: 4, description: 'Empty', foodNutrients: [] }), null);
    assert.equal(mapUsdaFood(undefined), null);
  });
});

describe('mapOpenFoodFactsProduct', () => {
  it('maps a product with nutrition and keeps its barcode', () => {
    const product = offBanana.hits.find((hit) => hit.code === '00517706');
    assert.deepEqual(mapOpenFoodFactsProduct(product), {
      id: 'off:00517706',
      name: 'Banana',
      brand: 'M&S',
      barcode: '00517706',
      source: 'openfoodfacts',
      dataType: null,
      basis: 'g',
      per100: { kcal: 81, protein: 1.2, carbs: 20.3, fat: 0.1 },
      servings: [{ label: '100 g', amount: 100 }],
    });
  });

  it('drops products without any nutrition', () => {
    assert.equal(mapOpenFoodFactsProduct(offBanana.hits.find((hit) => hit.code === '2000000151418')), null);
  });

  it('derives kcal from kJ when only kilojoules are given', () => {
    const food = mapOpenFoodFactsProduct({ code: '9310653103173', product_name: 'Yogurt', nutriments: { 'energy-kj_100g': 418.4 } });
    assert.equal(food.per100.kcal, 100);
  });

  it('accepts CSV brands and a stated serving', () => {
    const food = mapOpenFoodFactsProduct({
      code: '12345678', product_name: 'Oat drink', brands: ' Oatly , Other ',
      serving_quantity: 250, serving_quantity_unit: 'ml', serving_size: '1 glass',
      nutriments: { 'energy-kcal_100g': 46 },
    });
    assert.equal(food.brand, 'Oatly');
    assert.equal(food.basis, 'ml');
    assert.deepEqual(food.servings, [{ label: '1 glass (250 ml)', amount: 250 }, { label: '100 ml', amount: 100 }]);
  });

  it('rejects malformed barcodes', () => {
    assert.equal(mapOpenFoodFactsProduct({ code: 'abc', product_name: 'X', nutriments: { 'energy-kcal_100g': 1 } }), null);
  });
});

describe('mergeResults', () => {
  const usda = usdaBanana.foods.map(mapUsdaFood).filter(Boolean);
  const off = offBanana.hits.map(mapOpenFoodFactsProduct).filter(Boolean);

  it('puts generic foods first, then alternates branded USDA and Open Food Facts', () => {
    const ids = mergeResults(usda, off, 25).map((food) => food.id);
    assert.deepEqual(ids, [
      'usda:173945', 'usda:173944', 'usda:1105073', 'usda:167629',
      'usda:2012128', 'off:01129441',
      'usda:2011468', 'off:8857122695117',
      'off:00517706',
    ]);
  });

  it('hides an Open Food Facts product already returned by USDA, ignoring zero padding', () => {
    const duplicate = { ...off[0], id: 'off:16459200441', barcode: '16459200441' };
    assert.ok(!mergeResults(usda, [duplicate], 25).some((food) => food.id === duplicate.id));
  });

  it('respects the limit', () => {
    assert.equal(mergeResults(usda, off, 3).length, 3);
  });
});

describe('createFoodSearch', () => {
  it('queries both sources with the right parameters and keeps the key in a header', async () => {
    const { fetch, calls } = fakeFetch();
    const search = createFoodSearch({ usdaApiKey: 'test-key', fetch });
    const result = await search({ query: 'banana', limit: 10 });
    assert.deepEqual(result.sources, { usda: 'ok', openFoodFacts: 'ok' });
    assert.equal(result.cached, false);
    assert.equal(result.results[0].id, 'usda:173945');
    const usda = calls.find((call) => call.url.host === 'api.nal.usda.gov');
    assert.equal(usda.url.searchParams.get('query'), 'banana');
    assert.equal(usda.url.searchParams.get('pageSize'), '10');
    assert.equal(usda.url.searchParams.get('dataType'), 'Foundation,SR Legacy,Branded');
    assert.doesNotMatch(usda.url.href, /test-key/);
    assert.equal(usda.init.headers['x-api-key'], 'test-key');
    const off = calls.find((call) => call.url.host === 'search.openfoodfacts.org');
    assert.equal(off.url.searchParams.get('q'), 'banana');
    assert.match(off.init.headers['User-Agent'], /^Fitness360\//);
  });

  it('serves repeat queries from cache until the entry expires', async () => {
    let clock = 0;
    const { fetch, calls } = fakeFetch();
    const search = createFoodSearch({ usdaApiKey: 'k', fetch, now: () => clock, ttlMs: 1000 });
    await search({ query: 'banana', limit: 10 });
    const again = await search({ query: 'Banana', limit: 10 });
    assert.equal(again.cached, true);
    assert.equal(calls.length, 2);
    clock = 1001;
    assert.equal((await search({ query: 'banana', limit: 10 })).cached, false);
    assert.equal(calls.length, 4);
  });

  it('evicts the least recently used entry', async () => {
    const { fetch, calls } = fakeFetch();
    const search = createFoodSearch({ usdaApiKey: 'k', fetch, maxEntries: 2 });
    await search({ query: 'aa', limit: 5 });
    await search({ query: 'bb', limit: 5 });
    await search({ query: 'aa', limit: 5 }); // aa is now most recent
    await search({ query: 'cc', limit: 5 }); // evicts bb
    const before = calls.length;
    assert.equal((await search({ query: 'aa', limit: 5 })).cached, true);
    assert.equal((await search({ query: 'bb', limit: 5 })).cached, false);
    assert.equal(calls.length, before + 2);
  });

  it('returns partial results when one source fails, without caching them', async () => {
    const { fetch, calls } = fakeFetch({ off: () => ({ ok: false, status: 503, json: async () => ({}) }) });
    const search = createFoodSearch({ usdaApiKey: 'k', fetch });
    const result = await search({ query: 'banana', limit: 25 });
    assert.deepEqual(result.sources, { usda: 'ok', openFoodFacts: 'unavailable' });
    assert.ok(result.results.every((food) => food.source === 'usda'));
    await search({ query: 'banana', limit: 25 });
    assert.equal(calls.length, 4);
  });

  it('treats a non-JSON maintenance page as unavailable', async () => {
    const { fetch } = fakeFetch({ off: () => ({ ok: true, json: async () => JSON.parse('<!DOCTYPE html>') }) });
    const result = await createFoodSearch({ usdaApiKey: 'k', fetch })({ query: 'banana', limit: 5 });
    assert.equal(result.sources.openFoodFacts, 'unavailable');
  });

  it('works on Open Food Facts alone when no USDA key is configured', async () => {
    const { fetch, calls } = fakeFetch();
    const result = await createFoodSearch({ fetch })({ query: 'banana', limit: 25 });
    assert.deepEqual(result.sources, { usda: 'not-configured', openFoodFacts: 'ok' });
    assert.ok(calls.every((call) => call.url.host !== 'api.nal.usda.gov'));
    assert.equal(result.results.length, 3);
  });

  it('fails with a manual-entry hint when every source fails', async () => {
    const failing = () => { throw new Error('network down'); };
    const search = createFoodSearch({ usdaApiKey: 'k', fetch: fakeFetch({ usda: failing, off: failing }).fetch });
    await assert.rejects(() => search({ query: 'banana', limit: 5 }), (error) =>
      error instanceof FoodSearchError && error.code === 'unavailable' && /manually/.test(error.message));
  });
});

describe('handleFoodSearchRequest', () => {
  const data = { query: 'banana' };
  const deps = () => {
    const counts = { quota: 0, search: 0 };
    return {
      counts,
      consumeQuota: async () => { counts.quota++; },
      search: async (input) => { counts.search++; return { input }; },
    };
  };

  it('requires a signed-in session and App Check before any quota or provider work', async () => {
    const d = deps();
    await assert.rejects(() => handleFoodSearchRequest({ data }, d), (error) => error.code === 'unauthenticated');
    await assert.rejects(() => handleFoodSearchRequest({ data, auth: { uid: 'u' } }, d), (error) => error.code === 'failed-precondition');
    assert.deepEqual(d.counts, { quota: 0, search: 0 });
  });

  it('validates input before spending quota', async () => {
    const d = deps();
    await assert.rejects(() => handleFoodSearchRequest({ data: { query: 'a' }, auth: { uid: 'u' }, app: {} }, d));
    assert.deepEqual(d.counts, { quota: 0, search: 0 });
  });

  it('consumes quota then searches with the normalized input', async () => {
    const d = deps();
    const result = await handleFoodSearchRequest({ data: { query: ' banana ' }, auth: { uid: 'u' }, app: {} }, d);
    assert.deepEqual(result, { input: { query: 'banana', limit: 20 } });
    assert.deepEqual(d.counts, { quota: 1, search: 1 });
  });

  it('stops when the quota is exhausted', async () => {
    const d = deps();
    d.consumeQuota = async () => { throw new FoodSearchError('resource-exhausted', 'Search limit reached.'); };
    await assert.rejects(() => handleFoodSearchRequest({ data, auth: { uid: 'u' }, app: {} }, d), (error) => error.code === 'resource-exhausted');
    assert.equal(d.counts.search, 0);
  });
});

describe('nextSearchUsage', () => {
  const now = Date.UTC(2026, 9, 19, 12, 0, 30);
  it('allows 30 searches a minute and 600 a day', () => {
    assert.equal(nextSearchUsage({ day: '2026-10-19', minute: Math.floor(now / 60000), daily: 10, recent: 30 }, now), null);
    assert.equal(nextSearchUsage({ day: '2026-10-19', minute: 0, daily: 600, recent: 0 }, now), null);
    assert.deepEqual(nextSearchUsage({ day: '2026-10-18', minute: 0, daily: 600, recent: 30 }, now), {
      day: '2026-10-19', minute: Math.floor(now / 60000), daily: 1, recent: 1,
    });
  });
});
