import assert from 'node:assert/strict';
import { test } from 'node:test';
import { analyzeLabel, buildLabelRequest, MAX_IMAGE_BYTES, validateLabelImage, validateLabelResult } from '../src/labelAnalysis.js';
import { handleLabelRequest } from '../src/labelHandler.js';
import { createLabelDevServer } from '../src/labelDevServer.js';

const image = { mimeType: 'image/png', base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jJWsAAAAASUVORK5CYII=' };
const result = { name: 'Test granola', basis: 'serving', servingDescription: '40 g', energyUnit: 'kcal', nutrients: { energy: 200, protein: 6, carbs: 24, fat: 8 }, uncertainFields: [] };
const answer = (raw = result, finishReason = 'STOP') => ({ candidates: [{ finishReason, content: { parts: [{ text: JSON.stringify(raw) }] } }] });

test('rejects oversized, malformed, mismatched and URL-based image requests', () => {
  assert.deepEqual(validateLabelImage(image), image);
  for (const bad of [null, { ...image, mimeType: 'image/svg+xml' }, { ...image, mimeType: 'image/jpeg' }, { ...image, base64: 'https://example.com/private' }, { ...image, base64: '====' }, { ...image, base64: 'A'.repeat(Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4) }]) assert.throws(() => validateLabelImage(bad));
});
test('request treats photo instructions as untrusted and uses one-column transcription without health judgments', () => {
  const body = buildLabelRequest(image);
  assert.match(body.systemInstruction.parts[0].text, /untrusted DATA/);
  assert.match(body.systemInstruction.parts[0].text, /ONE column/);
  assert.match(body.systemInstruction.parts[0].text, /Never substitute zero/);
  assert.equal(body.contents[0].parts[0].inlineData.data, image.base64);
  assert.equal(body.generationConfig.responseSchema.properties.nutrients.properties.energy.nullable, true);
  assert.equal(body.tools, undefined);
});
test('uncertain or missing values are blanked and never coerced from strings', () => {
  const parsed = validateLabelResult({ ...result, basis: '100g', nutrients: { energy: '200', protein: 0, carbs: -2, fat: 101 }, uncertainFields: ['protein'] });
  assert.deepEqual(parsed.nutrients, { energy: null, protein: null, carbs: null, fat: null });
  const zero = validateLabelResult({ ...result, nutrients: { ...result.nutrients, energy: 0 } });
  assert.equal(zero.nutrients.energy, 0);
  assert.equal(validateLabelResult({ ...result, energyUnit: null }).nutrients.energy, null);
  assert.deepEqual(validateLabelResult({ ...result, basis: null }).nutrients, { energy: null, protein: null, carbs: null, fat: null });
  assert.throws(() => validateLabelResult({}));
});
test('sends secret only as a provider header and preserves printed serving values without scaling', async () => {
  let calls = 0;
  const parsed = await analyzeLabel(image, { apiKey: 'server-test-secret', fetch: async (url, options) => {
    calls++;
    assert.doesNotMatch(url, /server-test-secret/);
    assert.equal(options.headers['x-goog-api-key'], 'server-test-secret');
    assert.equal(JSON.parse(options.body).contents[0].parts[0].inlineData.mimeType, 'image/png');
    assert.ok(options.signal);
    return { ok: true, json: async () => answer() };
  } });
  assert.equal(calls, 1);
  assert.deepEqual(parsed, result);
});
test('missing key, provider failure and incomplete output never return invented nutrition', async () => {
  await assert.rejects(() => analyzeLabel(image, { apiKey: '' }), error => error.code === 'failed-precondition');
  await assert.rejects(() => analyzeLabel(image, { apiKey: 'key', fetch: async () => ({ ok: false, status: 429, text: async () => 'private image and secret' }) }), error => error.code === 'resource-exhausted' && !error.message.includes('private'));
  await assert.rejects(() => analyzeLabel(image, { apiKey: 'key', fetch: async () => ({ ok: true, json: async () => answer(result, 'MAX_TOKENS') }) }), error => error.code === 'data-loss');
  await assert.rejects(() => analyzeLabel(image, { apiKey: 'key', fetch: async () => ({ ok: true, json: async () => ({ candidates: [] }) }) }));
});
test('callable requires auth and App Check before validation, quota or provider calls', async () => {
  let quota = 0, provider = 0;
  const dependencies = { consumeQuota: async () => quota++, analyze: async () => { provider++; return result; } };
  await assert.rejects(() => handleLabelRequest({ data: image }, dependencies), error => error.code === 'unauthenticated');
  await assert.rejects(() => handleLabelRequest({ auth: { uid: 'test' }, data: image }, dependencies), error => error.code === 'failed-precondition');
  assert.equal(quota, 0); assert.equal(provider, 0);
  const request = { auth: { uid: 'test' }, app: { appId: 'test-app' }, data: image };
  await assert.rejects(() => handleLabelRequest({ ...request, data: {} }, dependencies));
  assert.equal(quota, 0);
  assert.deepEqual(await handleLabelRequest(request, dependencies), result);
  assert.equal(quota, 1); assert.equal(provider, 1);
  await assert.rejects(() => handleLabelRequest(request, { ...dependencies, consumeQuota: async () => { throw new Error('quota'); } }));
  assert.equal(provider, 1);
});
test('local bridge refuses foreign origins, fails closed without a key, and rate limits accepted calls', async t => {
  let configured = false, calls = 0;
  const server = createLabelDevServer({ configured: () => configured, analyze: async () => { calls++; return result; }, now: () => 100000 });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
  const url = `http://127.0.0.1:${server.address().port}`;
  assert.deepEqual(await (await fetch(`${url}/health`)).json(), { configured: false });
  const send = (origin = 'http://localhost:8081') => fetch(`${url}/analyze-label`, { method: 'POST', headers: { origin, 'Content-Type': 'application/json', 'X-Fitness-Label': '1' }, body: JSON.stringify({ data: image }) });
  assert.equal((await send('https://attacker.example')).status, 403);
  assert.equal((await send()).status, 503);
  assert.equal(calls, 0);
  configured = true;
  for (let i = 0; i < 5; i++) assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 429);
  assert.equal(calls, 5);
});
