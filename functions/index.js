import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { setGlobalOptions } from 'firebase-functions/v2/options';
import { logger } from 'firebase-functions';

import { InvalidInput, parseMeal } from './src/parseMeal.js';
import {hasRecentAuthentication, nextAnalysisUsage} from './src/accessPolicy.js';
import { handleLabelRequest } from './src/labelHandler.js';
import { analyzeMealPrep, handlePrepRequest } from './src/mealPrepAnalysis.js';
import { analyzeMealPhoto } from './src/mealPhotoAnalysis.js';
import { analyzeLabel, LabelError } from './src/labelAnalysis.js';

initializeApp();
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });

const photoCallable = (analyze, handle = handleLabelRequest) => onCall(
  { enforceAppCheck: true, secrets: ['GEMINI_API_KEY'], timeoutSeconds: 45, memory: '256MiB', maxInstances: 3, concurrency: 2 },
  async (request) => {
    try {
      return await handle(request, {
        analyze,
        consumeQuota: async (uid) => {
          const ref = getFirestore().doc(`analysisUsage/${uid}`);
          await getFirestore().runTransaction(async (transaction) => {
            const snapshot = await transaction.get(ref);
            const next = nextAnalysisUsage(snapshot.data());
            if (!next) throw new LabelError('resource-exhausted', 'Analysis limit reached. Try later or enter the label manually.');
            transaction.set(ref, next);
          });
        },
      });
    } catch (error) {
      if (error instanceof LabelError) throw new HttpsError(error.code, error.message);
      // No image, extracted text, credentials or user identifiers in logs.
      logger.error('Photo analysis failed', { code: 'photo-analysis-failed' });
      throw new HttpsError('internal', 'Photo analysis could not finish. Please try again.');
    }
  },
);

export const analyzeMealPrepCallable = photoCallable(analyzeMealPrep, handlePrepRequest);

export const analyzeLabelCallable = photoCallable(analyzeLabel);
export const analyzeMealPhotoCallable = photoCallable(analyzeMealPhoto);

/**
 * Parse a plain-language meal description into structured items.
 *
 * Callable rather than HTTP so Firebase checks the caller's auth token for us,
 * and App Check keeps it callable only from the real app. The Gemini key lives
 * in Secret Manager and is never sent to the client.
 */
export const parseMealCallable = onCall(
  {
    enforceAppCheck: true,
    secrets: ['GEMINI_API_KEY', 'USDA_API_KEY'],
    timeoutSeconds: 60,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in to use the meal parser.');
    }

    // Server-owned counter is outside the client-writable user namespace.
    const usageRef = getFirestore().doc(`analysisUsage/${request.auth.uid}`);
    await getFirestore().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(usageRef);
      const next = nextAnalysisUsage(snapshot.data());
      if (!next) throw new HttpsError('resource-exhausted', 'Analysis limit reached. Try later or log your meal manually.');
      transaction.set(usageRef, next);
    });

    try {
      return await parseMeal({
        text: request.data?.text,
        slot: request.data?.slot,
      });
    } catch (error) {
      if (error instanceof InvalidInput) {
        throw new HttpsError('invalid-argument', error.message);
      }
      // Log without the meal text — it is the user's private data.
      logger.error('parseMeal failed', {
        uid: request.auth.uid,
        code: 'meal-analysis-failed',
      });
      throw new HttpsError(
        'internal',
        "I couldn't read that just now. Try again in a moment.",
      );
    }
  },
);

/**
 * Delete the signed-in user's data and their auth record.
 *
 * `recursiveDelete` clears every subcollection under `users/{uid}`, which a
 * client-side delete cannot do.
 */
export const deleteAccount = onCall(
  { enforceAppCheck: true, timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in first.');
    }
    if (!hasRecentAuthentication(request.auth.token.auth_time)) {
      throw new HttpsError('failed-precondition', 'Sign in again before deleting your account.');
    }
    const uid = request.auth.uid;

    const firestore = getFirestore();
    await firestore.recursiveDelete(firestore.doc(`users/${uid}`));
    await firestore.doc(`analysisUsage/${uid}`).delete();
    await firestore.doc(`mobileProfiles/${uid}`).delete();
    await firestore.doc(`mobileMealPrep/${uid}`).delete();
    await getAuth().deleteUser(uid);

    logger.info('Account deleted', { uid });
    return { deleted: true };
  },
);
