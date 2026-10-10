# Foundation and design verification

Updated October 6, 2026.

## Implemented and checked

- React Native / Expo Router app with setup, Today, My Plan, History and Profile.
- Charcoal and warm-yellow theme, highlighted active tabs, clear meal-status
  badges, and a primary action for the next unlogged usual meal.
- Mobile browser inspection at 390 × 844. Screenshots: `meal-design.png` and `history-reuse.png`.
- Setup → breakfast → half portion → confirm → Today: 150 kcal, one confirmed
  meal, and the next action advances to lunch. A browser reload retains the save.
- Reopening the half-portion meal and choosing Usual portion restores its planned
  quantities and 300 kcal, rather than treating the saved half portion as usual.
- TypeScript, ESLint and all 16 domain tests pass, including estimate validation,
  explicit confirmation, duplicate protection, unknown nutrients and missing-day averages.
- Web, iOS and Android exports with the updated design succeeded. Exports validate bundles,
  not native installation or device behavior.
- Fixed the browser SVG transform-property warning discovered during review.
- Integrated MIT-licensed CalorieTracker components and estimate-import patterns;
  attribution is available in Profile → Open-source credits.
- Browser-checked 7/30-day calorie/protein switches, selection of an empty date,
  rejection of negative imported calories, and correction of a 160 kcal draft
  to 180 kcal before confirmation. The QA draft was not added to user history.
- Meal estimate import is a manual prompt/JSON fallback. No provider request is
  made from the app; automatic AI and photo analysis remain pending.

## Remaining work

This is a local demo, not a connected beta. Native SQLite needs device testing;
the browser preview uses localStorage. Native Firebase/Auth/App Check, server
mutations, production sync, photo/text AI, notifications and account workflows
remain pending. Editor drafts are not restart-persistent. Package audit findings
from the initial installation still need release triage. No signed builds or
physical-device tests have been completed.

## Local preview recovery

iCloud had offloaded app files and dependencies, causing reads and preview startup
to stall. Source files were requested back with `brctl download`. Generated
dependencies were reinstalled outside the cloud-managed checkout and linked into
`node_modules`. The previous generated directory is retained locally as
`.node_modules-offloaded` and is ignored by Git. Metro supports this external
dependency cache; ordinary `npm ci` installations also remain supported.

The active preview is served at `http://localhost:8081`. Its availability depends
on the local server running. Do not confuse it with a deployed public app.

## Mobile-first update — October 6, 2026

- User confirmed iPhone and Android as targets. React Native remains the mobile implementation.
- Applied cream/forest-green theme across screens, forms, charts and navigation; matching dark status-bar text and light native appearance.
- Bottom navigation uses safe-area insets instead of fixed bottom padding.
- Browser-reviewed Today at 390 × 844, with existing saved meals intact; screenshot `app-green-design.png`.
- TypeScript, ESLint and all 16 tests passed. iOS and Android Hermes exports both passed after these changes.
- These exports are not installable IPA/APK files. Expo CLI was signed out; device login requested. Signed builds and actual phone checks remain pending.
- No iOS simulator or Android adb tool was available from the current shell.

## Barcode scanner — October 7, 2026

- Added Expo Camera and a product scanner reached from Today and Add Meal. Native scanning plus a typed-barcode fallback; no image/video upload or microphone access.
- Open Food Facts API v2 live lookup verified with barcode 3017620422003. UI returned product identity, reported grade E, nutrient levels, ingredients and allergens.
- Browser rejected a wrong check digit before lookup; camera action showed the browser/manual fallback. Salt values retain decimals instead of rounding small quantities to zero.
- Unit tests cover GTIN normalization/validation, malformed results, unknown nutrients, kJ conversion, source mismatch, decimal display, quantity scaling, persisted attribution, cache expiry, rate limits, network errors, cancellation and timeout.
- Barcode lookup never logs a meal automatically. Portion creation is a draft; existing meal confirmation is required.
- Native camera permission/denial, autofocus, physical barcode scanning and background lifecycle still require real iPhone/Android testing. Bundle export success does not verify these device behaviors.
- Live AI/photo OCR is not connected. Current product explanations use database fields, not generated health verdicts.

Scanner final checks: all 26 mobile tests, lint and type checking pass; iOS and Android exports pass. The companion website's 8 tests and production build also pass with the shared barcode source type. Browser review verified 30 g of the live test product opens as a 162 kcal draft with barcode attribution, without confirmation or changes to the user's diary. Screenshot: `product-scanner.png`. Introspected iOS config has camera usage text and no microphone usage key.

## Nutrition label fallback — October 7, 2026

- Added a native camera/system-photo-picker reference flow and a browser photo picker. Photos remain local and are not written into meal state or uploaded. Picker cache files are OS-managed; unsaved drafts are not restart-persistent.
- Added conservative single-column English label-text import, explicit per-100-g/per-100-ml/per-serving basis, kcal/kJ conversion, portion totals and manual meal review. This is not automatic OCR or live AI.
- All 32 mobile tests, TypeScript and ESLint pass. Both iOS and Android Hermes exports pass. Expo Doctor passes 21/21. Manifest and lockfile dependencies match. Config introspection confirms camera/photo-library descriptions and no iOS microphone usage key.
- Browser at 390×844: Add Meal → Read a label; text import populated four fields; selecting 1.5 servings opened a 300 kcal draft with 9 g protein, 36 g carbs and 12 g fat. No meal confirmation or diary mutation was performed.
- Selected the synthetic `fixtures/nutrition-label.png` through the actual photo chooser. Preview displayed correctly. Selecting a new photo invalidated the previous label confirmation. Radio/checkbox state is exposed via `aria-checked` on web and native.
- Evidence: `label-photo-review.png`, `label-meal-review.png`. Native camera permission denial, physical camera capture, Android activity recovery, and signed phone builds remain device-test tasks.
- Release risk: `npm audit --omit=dev` reports 28 affected packages (18 high, 10 moderate) in the current Expo/React Native dependency tree, including build tooling. No critical findings. Audit remediation needs separate compatibility review: suggested automatic fixes include major downgrades, so none were applied blindly. Do not treat bundle success as production-security signoff.

## AI label integration — October 7, 2026

Implemented the real Gemini label-photo adapter, protected callable, local browser development bridge, image normalization, opt-in upload disclosure, staged extraction review, AI attribution and cancellation. App 37 tests and backend 54 tests pass. Native exports and Expo Doctor pass. Browser verified real unconfigured-server failure and an explicitly labeled injected test response through extraction acceptance, 1.5-serving scaling and unsaved 300 kcal meal review. No diary changes were made; the temporary fixture server was removed and the real unconfigured server restored.

Live Gemini transcription and native Firebase attestation have NOT been verified. A server key, Firebase configuration/deployment and signed device builds remain required. See `docs/label-photo-ai-setup.md` for exact setup and data boundaries. The gRPC override removes the new gRPC finding; dependency audit cleanup remains a release prerequisite.
