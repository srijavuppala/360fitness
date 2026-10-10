# Meal-photo recognition

Implemented October 8, 2026. This feature is separate from printed-label transcription. Live analysis needs the same server-side Gemini key as label reading, which is not configured in this checkout yet.

## User flow

Add Meal → Scan a meal photo → take/choose an image → Analyze meal photo → check suggestions → Review foods and portions → edit/remove/add foods → Confirm meal.

The image remains on the device until the user initiates analysis. AI food names, quantities and nutrients are estimates. Photos cannot establish exact portions or hidden ingredients/allergy safety. Unknown amounts use one “pictured portion” as an explicitly labeled relative placeholder, with all nutrition unknown. The editor supports incomplete estimates and never interprets missing nutrition as zero. Source and uncertainty notes are retained in local meal data; notes describe the original photo estimate even after correction.

## Configuration

- Local: follow [label-photo setup](label-photo-ai-setup.md), add the Gemini key to the ignored `functions/.env.label.local`, then run `npm run label:dev` in `functions`. Never put the secret in chat or `EXPO_PUBLIC_*`.
- The same loopback bridge now serves `/analyze-label` and `/analyze-meal-photo`, with one shared quota. It is only for the local browser preview; do not expose it to phones or deploy it.
- Phones: complete Firebase/Expo setup from that guide. Deploy both `analyzeLabelCallable` and `analyzeMealPhotoCallable`. The existing `EXPO_PUBLIC_LABEL_AI_ENABLED=true` flag enables both photo modes. Use fresh native builds for updated camera/photo permission text.
- Optional server override: `GEMINI_MEAL_PHOTO_MODEL`. Otherwise it uses `GEMINI_LABEL_MODEL`, then `gemini-2.5-flash`.
- Both routes enforce App Check, require a Firebase anonymous/authenticated session and consume the same server-owned quota as text analysis. No client-chosen models or prompts.

## Data and failure handling

Provider receives only the re-encoded image and a fixed prompt, not profile or diary contents. Existing image byte/dimension limits and timeout/cancellation handling apply. Server code neither logs nor persists photos or recognition results. Google processes submitted images under its service terms; local OS photo caches and anonymous auth/quota records follow the existing label-reader notes.

The model returns food, no_food or unclear. Invalid/incomplete responses, unknown configuration, denied camera access, provider errors and network failure lead to retry/manual entry, never sample data. Suggestions are held in memory until accepted as an unlogged draft. Navigating away cancels client handling and ignores late results; an already submitted provider request may still finish.

## Verification and remaining work

- 54 mobile tests: existing label/profile tests plus meal parsing, unknown portions, review draft creation, immutable scaling, attribution, confirmation idempotence, transport, errors and cancellation.
- 60 backend tests: existing tests plus meal prompt/schema, provider completion and failures, auth/App Check/quota and shared local routing/limits.
- Typecheck and lint pass; iOS and Android JS bundles export successfully.
- Browser: real missing-key state verified through image preparation and the local server. A temporary injected `TEST RESPONSE` then verified suggested foods → review → remove unknown food → change rice from 1 to 1.5 cups → confirm → Today reports 300 kcal and one meal. This is pipeline verification, not live recognition accuracy. A synthetic label image was used solely as transport input.
- Test data stays under `127.0.0.1:8081`, separate from the user's `localhost:8081` diary. Temporary fixture server was stopped; normal missing-key server restored.
- Pending: real meal-photo accuracy tests, ambiguous/no-food images with the live provider, deployment, signed phone builds, physical camera/App Check verification and release dependency audit.
- Onboarding-driven prioritization of scan entry points remains a separate planned task.
