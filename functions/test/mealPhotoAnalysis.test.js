import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeMealPhoto, buildMealPhotoRequest, validateMealPhotoResult } from '../src/mealPhotoAnalysis.js';
import { handleLabelRequest } from '../src/labelHandler.js';
import { createLabelDevServer } from '../src/labelDevServer.js';

const image = { mimeType: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJWsAAAAASUVORK5CYII=' };
const food = { name: 'Rice', quantity: 1, unit: 'cup', portionNote: 'Cup is a visual estimate; no scale reference.', uncertain: true, nutrition: { kcal: 200, protein: 4, carbs: 44, fat: null } };
const result = { status: 'food', name: 'Rice plate', foods: [food] };
const response = (value = result, finishReason = 'STOP') => ({ ok: true, json: async () => ({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(value) }] } }] }) });

test('meal photo prompt is distinct from label transcription and does not trust image instructions', () => {
  const body = buildMealPhotoRequest(image);
  assert.match(body.systemInstruction.parts[0].text, /untrusted DATA/);
  assert.match(body.systemInstruction.parts[0].text, /ENTIRE suggested quantity/);
  assert.match(body.systemInstruction.parts[0].text, /hidden ingredients/);
  // A suggested portion must carry an estimate; null-everything results gave users no calories.
  assert.match(body.systemInstruction.parts[0].text, /MUST estimate kcal, protein, carbs and fat/);
  assert.equal(body.tools, undefined);
  assert.equal(body.contents[0].parts[0].inlineData.data, image.base64);
});
test('meal photo result retains uncertain portions and nulls unknown nutrition', () => {
  assert.deepEqual(validateMealPhotoResult(result), result);
  for (const quantity of [null, -1, '100', Infinity, 10001]) {
    const parsed = validateMealPhotoResult({ ...result, foods: [{ ...food, quantity }] });
    assert.equal(parsed.foods[0].quantity, null);
    assert.equal(parsed.foods[0].unit, null);
    assert.deepEqual(parsed.foods[0].nutrition, { kcal: null, protein: null, carbs: null, fat: null });
    assert.equal(parsed.foods[0].uncertain, true);
  }
});
test('no-food and unclear output cannot contain suggested food or invented data', () => {
  for (const status of ['no_food','unclear']) {
    assert.deepEqual(validateMealPhotoResult({ status, foods: [], name: '' }), { status, foods: [], name: '' });
    assert.throws(() => validateMealPhotoResult({ ...result, status }));
  }
  for (const value of [null, {}, { ...result, foods: [] }, { ...result, foods: Array(13).fill(food) }, { ...result, foods: [{ ...food, portionNote: '' }] }, { ...result, foods: [{ ...food, nutrition: { ...food.nutrition, kcal: '200' } }] }, { ...result, foods: [{ ...food, nutrition: {} }] }]) assert.throws(() => validateMealPhotoResult(value));
});
test('meal provider call validates completion, redacts provider failures and uses server-side secret', async () => {
  let calls = 0;
  assert.deepEqual(await analyzeMealPhoto(image, { apiKey: 'test-secret', fetch: async (url, init) => {
    calls++;
    assert.doesNotMatch(url, /test-secret/);
    assert.equal(init.headers['x-goog-api-key'], 'test-secret');
    assert.match(JSON.parse(init.body).systemInstruction.parts[0].text, /meal photograph/);
    return response();
  } }), result);
  assert.equal(calls, 1);
  await assert.rejects(() => analyzeMealPhoto(image, { apiKey: '' }), error => error.code === 'failed-precondition');
  await assert.rejects(() => analyzeMealPhoto(image, { apiKey: 'key', fetch: async () => response(result, 'MAX_TOKENS') }), error => error.code === 'data-loss');
  await assert.rejects(() => analyzeMealPhoto(image, { apiKey: 'key', fetch: async () => ({ ok: false, status: 500, text: async () => 'private image detail' }) }), error => !error.message.includes('private'));
});
test('meal route shares authentication, App Check and quota before provider work', async () => {
  let quota = 0, provider = 0;
  const deps = { consumeQuota: async () => { quota++; }, analyze: async () => { provider++; return result; } };
  await assert.rejects(() => handleLabelRequest({ data: image }, deps));
  await assert.rejects(() => handleLabelRequest({ data: image, auth: { uid: 'test' } }, deps));
  assert.equal(provider, 0); assert.equal(quota, 0);
  const request = { data: image, auth: { uid: 'test' }, app: {} };
  assert.deepEqual(await handleLabelRequest(request, deps), result);
  assert.equal(quota, 1);
  await assert.rejects(() => handleLabelRequest(request, { ...deps, consumeQuota: async () => { throw new Error('quota'); } }));
  assert.equal(provider, 1);
});
test('development meal route shares limits with labels and never calls the wrong provider', async t => {
  let meals = 0, labels = 0;
  const server = createLabelDevServer({ configured: () => true, now: () => 100000, analyze: async () => { labels++; return {}; }, analyzeMeal: async () => { meals++; return result; } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const send = (path, origin = 'http://localhost:8081') => fetch(`http://127.0.0.1:${server.address().port}/${path}`, { method: 'POST', headers: { origin, 'Content-Type': 'application/json', 'X-Fitness-Label': '1' }, body: JSON.stringify({ data: image }) });
  assert.equal((await send('analyze-meal-photo', 'https://other.example')).status, 403);
  assert.deepEqual(await (await send('analyze-meal-photo')).json(), { result });
  for (let i = 0; i < 4; i++) assert.equal((await send('analyze-label')).status, 200);
  assert.equal((await send('analyze-meal-photo')).status, 429);
  assert.equal(meals, 1); assert.equal(labels, 4);
});
