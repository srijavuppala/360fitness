import { analyzeLabel, LabelError, validateLabelImage } from './labelAnalysis.js';

/** Shared callable boundary; dependencies are injectable for auth/quota tests. */
export async function handleLabelRequest(request, { consumeQuota, analyze = analyzeLabel }) {
  if (!request.auth?.uid) throw new LabelError('unauthenticated', 'An app session is required for photo analysis.');
  if (!request.app) throw new LabelError('failed-precondition', 'App verification is required for photo analysis.');
  const image = validateLabelImage(request.data);
  await consumeQuota(request.auth.uid);
  return analyze(image);
}
