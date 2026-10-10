import { analyzeMealPrep, validatePrepInput } from './mealPrepAnalysis.js';
import { createServer } from 'node:http';
import { analyzeLabel, LabelError, MAX_IMAGE_BYTES, validateLabelImage } from './labelAnalysis.js';
import { analyzeMealPhoto } from './mealPhotoAnalysis.js';
import { nextAnalysisUsage } from './accessPolicy.js';

// Loopback-only developer bridge. Never deploy this server or expose it through a tunnel.
export function createLabelDevServer({ analyze = analyzeLabel, analyzeMeal = analyzeMealPhoto, analyzePrep = analyzeMealPrep, configured = () => !!process.env.GEMINI_API_KEY, now = Date.now } = {}) {
  let usage = {};
  const origins = new Set(['http://localhost:8081', 'http://127.0.0.1:8081', 'http://localhost:8082', 'http://127.0.0.1:8082']);
  return createServer(async (req, res) => {
    const origin = req.headers.origin;
    const host = req.headers.host;
    const port = req.socket.localPort;
    const send = (status, body) => {
      if (res.destroyed) return;
      res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
      res.end(JSON.stringify(body));
    };
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(host) || (origin && !origins.has(origin))) return send(403, { error: { status: 'PERMISSION_DENIED', message: 'Local preview origin required.' } });
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Fitness-Label');
      return send(204, {});
    }
    if (req.method === 'GET' && req.url === '/health') return send(200, { configured: configured() });
    if (req.method !== 'POST' || !['/analyze-label', '/analyze-meal-photo', '/analyze-meal-prep'].includes(req.url)) return send(404, { error: { status: 'NOT_FOUND', message: 'Not found.' } });
    if (!origin || req.headers['x-fitness-label'] !== '1' || req.headers['content-type'] !== 'application/json') return send(403, { error: { status: 'PERMISSION_DENIED', message: 'Use the local app preview.' } });
    if (!configured()) return send(503, { error: { status: 'FAILED_PRECONDITION', message: 'Add GEMINI_API_KEY to the server’s .env.label.local file and restart the photo AI server.' } });
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > (req.url === '/analyze-meal-prep' ? 32768 : Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 4096)) {
          send(413, { error: { status: 'INVALID_ARGUMENT', message: 'Choose a smaller label photo.' } });
          req.destroy();
          return;
        }
        chunks.push(chunk);
      }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new LabelError('invalid-argument', 'The image request could not be read.'); }
      const isPrep = req.url === '/analyze-meal-prep';
      const image = isPrep ? validatePrepInput(body?.data) : validateLabelImage(body?.data);
      const next = nextAnalysisUsage(usage, now());
      if (!next) throw new LabelError('resource-exhausted', 'Photo analysis limit reached. Try later or enter the label manually.');
      usage = next;
      const result = await (isPrep ? analyzePrep : req.url === '/analyze-meal-photo' ? analyzeMeal : analyze)(image, { signal: controller.signal });
      send(200, { result });
    } catch (error) {
      const code = error instanceof LabelError ? error.code : 'internal';
      const status = { 'invalid-argument': 400, 'resource-exhausted': 429, 'failed-precondition': 503, unavailable: 503 }[code] ?? 500;
      send(status, { error: { status: code.replaceAll('-', '_').toUpperCase(), message: error instanceof LabelError ? error.message : 'Photo analysis could not finish.' } });
    }
  });
}
