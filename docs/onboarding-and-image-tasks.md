# Related work: onboarding and image detection

Status: scope confirmed by the user. These are related development tasks covering onboarding, printed nutrition-label reading, and meal-photo recognition. They are implementation work items, not tasks displayed to users inside the app.

## Connected flow

Profile answers → choose a tracking method → capture/select a photo → extract label facts or propose meal items → review and correct → confirm a meal → update Today and History.

The existing onboarding stores preferences. It does not yet change scan results or generate personalized tasks. Image extraction must retain its own source facts; profile preferences must not alter the calories or ingredients reported from an image.

| ID      | Task                                                        | Current status                                         | Depends on                             | Completion criteria                                                                                                                                                                                                  |
| ------- | ----------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ONB-01  | Guided onboarding and editable profile                      | Implemented                                            | —                                      | Required/optional answers, review, explicit save/resume, existing meal data preserved.                                                                                                                               |
| ONB-02  | Verify onboarding on signed phone builds                    | Pending                                                | ONB-01, APP-01                         | Complete, interrupt, resume and edit on both platforms; check keyboard, screen reader and back navigation.                                                                                                           |
| IMG-01  | Read printed nutrition labels from photos                   | Integration implemented; live verification pending     | API configuration                      | A real provider response passes validation, is shown for correction, and reaches an unconfirmed meal draft. No fixture fallback.                                                                                     |
| IMG-02  | Recognize meals from photos                                 | Implemented; live accuracy/device verification pending | Server configuration                   | Identify candidate foods with editable portions and uncertainty; missing values stay unknown; confirmation required before logging. Separate from printed-label transcription.                                       |
| LINK-01 | Connect onboarding tracking preference to scan entry points | Planned                                                | ONB-01, IMG-01 and IMG-02              | Preferred method is easy to reach; manual entry remains available; changing preference does not lose drafts or history.                                                                                              |
| LINK-02 | Compare available product information with food preferences | Optional follow-up                                     | ONB-01, reliable ingredient data       | Present source-backed matches separately from nutrition facts. Missing ingredient data is visible; never infer allergy safety from a photo or absent match. No profile upload without a defined need and disclosure. |
| APP-01  | Configure and verify installable iPhone/Android builds      | Pending account/project/build configuration            | Expo, Apple and Firebase configuration | Signed builds install; image permissions, anonymous auth, App Check and server calls work on devices.                                                                                                                |
| QA-01   | Verify the connected flow                                   | Pending integration work                               | ONB-02, selected IMG tasks, LINK-01    | Onboard → scan → correct portion → confirm once → verify totals/history. Also cover denied permissions, blurry/non-food images, offline, timeout, cancellation and missing data.                                     |

## Implementation order

1. **IMG-02 + shared review (implemented):** meal-photo recognition now sits beside the existing label reader. Add a clear choice between “Nutrition label” and “Meal photo.” Reuse capture, upload validation, cancellation, authentication and quotas where appropriate, while keeping the extraction prompts and response schemas distinct.
2. **IMG-01 live verification:** supply server configuration and verify real label results. The same credential setup can support the meal-photo route; do not block local implementation and fixture-based tests on credentials.
3. **LINK-01:** use the saved tracking preference to prioritize relevant entry points. All users can still choose manual logging, barcode lookup, label reading or meal-photo review.
4. **APP-01 + ONB-02 + QA-01:** create signed builds and verify the full flow on phones. Keep dependency/security review as a release gate.

### Meal-photo recognition acceptance checklist

- [ ] User explicitly chooses a meal photo and initiates analysis, with an upload disclosure.
- [ ] A dedicated server operation uses a fixed meal-recognition prompt and a validated response schema. Text inside photos cannot change its instructions.
- [ ] Results list candidate foods with editable quantity, unit and nutrition estimates; the UI identifies uncertain foods and portion assumptions.
- [ ] Users can rename, remove or add foods and adjust portions before confirming. Avoid implying precise portions can always be determined from one image.
- [ ] No-food, unclear, incomplete and invalid responses lead to retry/manual-entry states; no fabricated successful result.
- [ ] Accepted results create an AI-attributed draft using the existing meal model. Nothing is logged until the user confirms; editing cannot double-count intake.
- [ ] Resizing, payload limits, request timeout, cancellation, authentication and shared rate limits apply to this route too.
- [ ] No hidden ingredient or allergy-safe claims are inferred from visual appearance. Profile data is not automatically sent to the image provider.
- [ ] Tests cover valid multi-food results, ambiguous portions, malformed output, provider failures, late responses and confirmed-meal totals.

### Likely implementation areas

- Onboarding/profile: `apps/mobile/src/app/preferences.tsx`, `apps/mobile/src/domain/profile.ts`.
- Capture and label review: `apps/mobile/src/components/label-photo.tsx`, `apps/mobile/src/app/label.tsx`, `apps/mobile/src/services/label-reader.ts`.
- Meal-photo recognition: add a separate service/domain parser and review entry point, reusing the existing `Meal`/pending-draft flow.
- Provider/auth/quota boundary: `functions/src/labelAnalysis.js`, `functions/src/labelHandler.js`, `functions/index.js`; add the meal-specific operation without broadening the label transcription contract.
- Test and release evidence: mobile domain/transport tests, backend handler/provider tests, browser smoke checks, signed-device checks.

## Configuration needed for live label reading

Local preview requires a server-side Gemini API key. Phone use additionally requires Firebase client configuration, anonymous authentication, App Check, deployment and a new native build. Do not put provider secrets in the app or chat. Follow [label-photo AI setup](label-photo-ai-setup.md).

## Existing evidence

The last onboarding verification passed 47 mobile tests, typecheck, lint and both platform JavaScript bundle exports. Browser checks used a separate origin and synthetic profile answers. These checks do not establish live model accuracy, signed native build success or physical-device behavior.

See [personal profile details](personal-profile.md) for the full questionnaire and persistence rules. Voice check-ins, notifications and wearable integrations remain separate future features.

## October 8 implementation update

Meal-photo recognition has its own server prompt/schema and callable, with shared image validation, authentication, App Check and quota handling. Add Meal now offers Scan a meal photo; suggested foods lead to the existing editable meal draft before confirmation. Unknown portions use a clearly labeled relative placeholder with unknown nutrition. Photo uncertainty notes survive food edits and local saving.

Verification: 54 mobile tests and 60 backend tests pass; typecheck/lint and both native JavaScript exports pass. The browser fixture test exercised selection, explicit analysis, review, removing an uncertain food, 1.5× portion scaling and confirmation (300 kcal) in separate test-origin storage. The fixture server was stopped and the real server restored. Gemini key configuration and real-image accuracy/device verification are still pending. See [meal-photo setup and QA](meal-photo-recognition.md).

## Firebase and GitHub foundation — 2026-10-08

- [x] Responsive welcome layout; normal phone viewports fit without scrolling.
- [x] Email/password account UI, verification and password-reset flow.
- [x] Explicit completed-profile save/restore and real-time Firestore subscription.
- [x] Owner/schema rules and conflict checks for concurrent edits and deleted/recreated documents.
- [x] CI configuration, PR template and documented branch/release workflow.
- [ ] Supply live Firebase configuration, enable Auth, deploy rules to development and verify two real phones.
- [ ] Publish the reviewed React baseline to GitHub and enable required branch checks.
- [ ] Deliver account deletion UI and UID-scoped local stores before shared-device/production release.
- [ ] Design meal/history sync and a durable retry queue before promising automatic synchronization.

## Voice onboarding — 2026-10-08

- [x] Voice affordance for free-text questions and optional 1,000-character diet explanation.
- [x] Keyboard dictation guidance for Expo Go; native recognizer in configured installed builds.
- [x] Review/replace/append, permission and cancellation lifecycle, no app audio-file retention.
- [x] Client and generated Firestore schema validation for the diet explanation.
- [ ] Rebuild the development client and verify speech on physical iPhone and Android devices.

See [voice onboarding](voice-onboarding.md) for behavior, privacy boundaries and test evidence.
