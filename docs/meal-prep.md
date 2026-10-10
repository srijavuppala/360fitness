# Meal prep — implementation and connection status

Implemented October 8, 2026 in the React Native / Expo app.

## Try it

My Plan → Meal prep for the week → select a prep day → Plan a prep batch.

**Browse starter recipes** opens six original assembly ideas, split into Breakfast and Lunch: berry yogurt pots, peach and cottage cheese, banana peanut butter wraps, lemon chickpea crunch, white bean pita pockets and hummus veggie wraps. All use ready-to-eat ingredients; nutrition is deliberately unknown until product-label values are entered. Times are approximate. These are editable ideas, not clinically personalized recommendations or allergy guarantees.

Save a starter, then tap **Start guided prep**. Four short steps appear one at a time, with a separate ingredient view scaled to the full batch. Completed steps persist locally and are included in explicit Firebase backups. You can pause, resume after reopening, and review earlier steps. Completing the guide does not mark the batch prepared or log intake; those remain explicit actions. Changing servings resets step progress, while editing/removing ingredients removes the original guide so it cannot give instructions for a changed recipe. Existing batches without guides remain compatible.

Recipe choices and usual meals open separate screens, with three usual meals per page. Recipe library and longest guide screen were checked at 375 × 667 without vertical overflow at default font size. Accessibility overflow remains available for enlarged text and keyboard use. Basic produce handling follows [FDA produce preparation guidance](https://www.fda.gov/consumers/consumer-updates/7-tips-cleaning-fruits-vegetables); users should follow product storage instructions.

Use a usual meal, create a recipe manually, or describe a recipe for Gemini analysis. Describe ingredient amounts for the whole batch and choose 1–20 servings. The AI response is converted by the model into explicit per-serving ingredients and estimated nutrition, with human review required before saving. The app validates the returned data; it cannot verify that the model's estimates or arithmetic are factually correct. Edit any ingredient to correct quantities or nutrition.

The main screen has a week selector, daily batches and a grocery checklist. Ingredient review and groceries are paged to reduce scrolling. Recipe notes open separately. Prepared is a planning status, not food intake. Log one serving explicitly after eating; repeated taps cannot duplicate the same batch's intake for that day. Use History to review a logged entry.

## Data and boundaries

- Optional `AppState.mealPrep` version 1 preserves compatibility with old local data.
- A batch stores a meal snapshot, prep date, serving count, prepared flag and notes. Editing a usual meal later does not silently alter a planned batch.
- Grocery quantities sum matching ingredient names and units multiplied by batch servings. No automatic raw/cooked, weight/volume or unit conversions. Unknown nutrients remain unknown, not zero. Recipe or serving edits reset shopping checks so increased quantities are not marked purchased.
- Limits: 40 batches total, 12 ingredients per batch, 1–20 servings, 180,000-character cloud payload. Older batches can be removed without deleting already logged food.
- AI can suggest ingredients and estimate nutrition; it does not certify allergies, dietary suitability, medical outcomes or food storage safety. The starter library includes assembly instructions, but this is not a validated cooking or food-storage guide.

## Gemini

The supplied key was accepted by the Gemini API and was stored only in the ignored `functions/.env.label.local` file with owner-only permissions. No key is included in app configuration, exported bundles, this document or Git.

`analyzeMealPrepCallable` uses `GEMINI_API_KEY` from Firebase Secret Manager, App Check, Firebase Auth and the existing shared per-user analysis quotas (5/minute, 50/day). `GEMINI_PREP_MODEL` can select a model; default `gemini-2.5-flash`. Responses use a structured schema, bounded runtime validation, a 30-second provider timeout and sanitized errors.

The loopback developer bridge exposes `/analyze-meal-prep` on port 8787 only to the localhost/127.0.0.1 Expo previews on ports 8081 and 8082. It is not a phone-accessible or production service. Stop/restart it after server configuration changes. A real Gemini request also succeeded end to end in the browser preview.

The description is sent only when the user taps Analyse. Including the saved diet/allergy fields is a separate explicit checkbox, initially off. Other onboarding answers and meal history are not sent. Users review AI ingredients and portions before saving.

## Firebase

`mobileMealPrep/{uid}` stores a private, bounded versioned JSON backup with a server timestamp, revision and generation ID. Firestore rules require a verified owner, reject foreign/unverified writes and enforce revision progression. The nested payload is validated by the client before use; it is private backup data, not server-authoritative nutrition. Stale writes fail instead of overwriting another device's newer plan.

The cloud panel subscribes in real time, shows offline/cache status and keeps local changes separate. Save explicitly uploads this device's plan. Restore requires review and replaces only meal prep. Signing in never silently uploads or replaces local data. Account switches invalidate pending restore operations. Account deletion also removes this backup collection document.

**Live Firebase is not connected yet:** no project ID or app configuration has been selected. The existing CLI account could not list projects. Need the user's project ID, working project access, Firebase client app configuration, deployed rules/functions, enabled auth and production App Check configuration. Native AI additionally needs a configured development/distribution build; Expo Go uses saved/manual recipes and keyboard dictation. Do not weaken App Check to bypass this requirement.

After choosing the project, store the server key in Secret Manager using Firebase's secret tooling without exposing it in command arguments, configure the public Firebase client identifiers, deploy the scoped rules/functions and test on both phones. Cloud deployment and signed builds have not been performed in this change.

## Validation

Latest recipe-library increment: 85 mobile tests pass, including isolated recipe copies, unknown nutrition, scaled groceries, idempotent guide progress, unchanged shopping checks/intake, persisted progress and corrupt guide rejection. Browser checks cover recipe selection/save, batch amounts, pause/reload/resume, previous-step review and guide completion. Screenshots: `meal-prep-starters.png` and `meal-prep-guide.png`.

- Mobile unit tests: plan validation, old state migration, serving multiplication, grocery grouping, explicit/idempotent intake, cancellation, malformed AI results and corrupt cloud payload rejection.
- Backend tests: auth/attestation/input validation precede quota/analysis; provider error sanitization, structured output checks and local-origin enforcement.
- Firestore emulator: verified owner access, account isolation, payload bounds, revision/generation checks, and two-device live updates with stale-write rejection.
- Browser: real Gemini analysis, explicit review/save, prep status persistence, grocery quantities, checkbox and paging behavior. Screenshots in `apps/mobile/qa/meal-prep-*.png`.
- TypeScript, lint and iOS/Android/web export required. Physical-phone keyboard, microphone and Firebase deployment validation remain outstanding.

References: [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output), [Firebase secret configuration](https://firebase.google.com/docs/functions/config-env), [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions).
