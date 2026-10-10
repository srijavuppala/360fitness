import { createLabelDevServer } from '../src/labelDevServer.js';
const server = createLabelDevServer();
server.requestTimeout = 45000;
server.headersTimeout = 10000;
server.listen(8787, '127.0.0.1', () => {
  console.log('Label AI preview server: http://127.0.0.1:8787 (local browser preview only)');
  console.log(process.env.GEMINI_API_KEY ? 'Gemini key configured.' : 'Waiting for GEMINI_API_KEY in .env.label.local; restart after adding it.');
});
server.on('error', () => { console.error('Could not start photo AI server. Check whether port 8787 is already in use.'); process.exitCode = 1; });
