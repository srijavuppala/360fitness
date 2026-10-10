# 360° Fitness AI — React Native app

An Expo / React Native / TypeScript foundation for iPhone and Android. All new
mobile development lives here. Flutter is not used by this app.

## Run

Requires Node 22 and npm.

```bash
cd apps/mobile
npm ci
npm run web
```

The browser build is a convenient preview of the React Native screens. Use
`npm start` to serve a development client on a device. Development-build
profiles are in `eas.json`; creating signed builds requires an Expo account and
the relevant platform credentials. Application identifiers are provisional demo
identifiers and must be finalized before distribution.

```bash
npx eas-cli@latest build --profile development --platform ios
npx eas-cli@latest build --profile development --platform android
```

No account, deployment or signed native build is created by these checked-in
configuration files.

## Working local demo

- Welcome, goal selection and resumable setup.
- Today, My Plan, History and Profile tabs.
- Three editable sample meals; no pre-filled intake/history.
- Confirm, skip or change portions; repeated confirmation replaces the same entry.
- Manual meals, manual nutrition, unknown values, food removal and Undo.
- Add/edit/remove usual meals without altering previously logged snapshots.
- Save, reload and inspect the last seven days.
- Inspect/share local JSON data and reset the demo with confirmation.

Sample nutrition is illustrative. Manual values are user supplied. Packaged-food lookup uses Open Food Facts; label-photo AI requires server configuration; automatic text analysis is not connected. There is no cloud diary sync and no notification is scheduled. Configured native AI requests use an anonymous Firebase session. Meals are stored locally.

## Data boundaries

Native builds use `expo-sqlite`. The browser preview uses a separate localStorage
adapter. Both store one versioned local demo state; this is not the production
per-entry database/outbox from the implementation plan. Writes are serialized,
persisted before success, and errors leave the editor available for retry.

Templates and intake are separate. Entry identity is `(meal ID, local date)`.
Confirmations freeze food snapshots; unknown nutrition remains unknown. Portion
changes scale an item's entire quantity once. New entries use the device's local
date; editing a historical entry retains its original date.

Local data is not encrypted in this demo. Use sample data during review. Drafts
inside the meal editor are not yet restart-persistent; save before leaving.
Cloud conflicts, authenticated user separation, export/deletion jobs and photo
retention require the later backend phases.

## Checks

```bash
npm run check
npx expo-doctor
npx expo export --platform all
```

`check` runs TypeScript, ESLint and domain tests. The CI workflow runs these plus
web/iOS/Android JavaScript exports. An export is not a signed native build or a
device test. See `qa/VERIFICATION.md` for the evidence and remaining gaps.

## Code map

```text
src/app/          Expo Router screens, layouts and tabs
src/components/   Shared UI and manual food form
src/domain/       Nutrition, portions, date helpers and sample fixtures
src/data/         Local storage adapters and serialized state writes
src/theme.ts      Shared color tokens
tests/            Domain behavior tests
```

Next: configure development/staging Firebase and prove native Auth/App Check on
both platforms before introducing real accounts. Versioned server mutations, cloud sync and a durable outbox remain separate from the opt-in label-photo reader.

## Open-source feature reuse

History includes 7/30-day calorie and protein charts. Add meal → Import a meal estimate supports a manual prompt/JSON workflow, per-food validation and editable review before confirmation. Automatic text analysis is not connected. Unsaved imported drafts expire on restart.

Parts of the chart presentation and estimate-import logic were adapted from [AtharvaK51/CalorieTracker](https://github.com/AtharvaK51/CalorieTracker), revision `fea612de44804ade28ae5ea0e75cb3219a37cb1a`, under MIT. See [the retained license](licenses/CalorieTracker-MIT.txt) and Profile → Open-source credits. No upstream branding or reference images are included in the app.

## Codex Run action

Open `apps/mobile` as the Codex project to use its **Run** action. It runs `./script/build_and_run.sh` in the foreground, with Metro logs in the action terminal. The same script supports `--ios`, `--android`, `--web`, `--dev-client`, `--doctor` and `--help`. Platform launch modes require an installed simulator/emulator or connected device.

The Expo Codex plugin supplies development/deployment skills; installing it does not authenticate EAS or generate signed phone builds.

## Packaged-food scanner

Today → **Scan a food product**, or Add Meal → **Scan a product**. Look up a typed barcode in the browser, or use the camera in a new phone build. Review nutrition, ingredients and reported allergens, check the package, choose the portion/unit, then confirm in the meal editor. Barcode lookup uses the public Open Food Facts API and needs internet but no Expo/Firebase login. Camera requires a rebuilt app after adding the native package.

Product records are community data. Missing fields stay unknown; the app does not certify allergy safety. Only the barcode is sent to Open Food Facts. Meals stay local, with source/barcode attribution retained. Session lookup cache expires after ten minutes. The barcode scanner does not save photos or videos. See [research and AI next steps](../../docs/product-scanner-research.md).

## Nutrition label fallback

Add Meal → **Read a label**, or Scanner → **Read a label instead**. Take a photo on iPhone/Android or choose one from the system photo picker (also available in the browser). The image is a local reference only: the app does not upload it until **Read photo with AI** is pressed, or attach it to saved meals. Native picker files may remain in the OS-managed cache. Photo and form drafts are not restart-persistent.

Enter values manually or use **Fill from label text** to parse a pasted, single-column English nutrition panel. Supported lines include `Calories 200`, `Energy 418.4 kJ`, `Total Fat 8 g`, `Total Carbohydrate 24 g`, and `Protein 6 g`, optionally followed by a daily-value percentage for macros. This is a conservative text parser, not AI or OCR. Duplicate values are rejected; unsupported/ambiguous lines stay unknown. Import replaces all four nutrition fields and resets the basis/portion, so stale values cannot carry over.

Explicitly choose per 100 g, per 100 ml or per printed serving, enter your portion, and verify the label before opening the existing meal review. kcal/kJ conversion and portion scaling happen once. Blank values stay unknown; no health rating or allergen verdict is inferred. Saved values use manual-entry attribution. The photo AI integration is implemented and requires a server key; native use also requires Firebase configuration, App Check and a new build. See [photo AI setup](../../docs/label-photo-ai-setup.md).

Photo selection follows the [Expo SDK 57 ImagePicker API](https://docs.expo.dev/versions/v57.0.0/sdk/imagepicker/), with microphone access disabled. A new native build is required for the added module and permissions.

## AI nutrition-label reader

After selecting a photo, **Read photo with AI** sends it to the backend/Gemini only on request. The result is previewed separately; **Use extracted values** populates editable fields and resets the portion/confirmation. Unknowns remain blank and saved nutrition retains AI-assisted attribution. Nothing is auto-logged.

For local browser development, run `npm run label:dev` in `functions` with the server-only `functions/.env.label.local` key. Phone builds use Firebase Auth/App Check and `analyzeLabelCallable`. The provider key is never sent to the client. See [complete setup and verification](../../docs/label-photo-ai-setup.md). There is no live provider key or deployed function configured in this checkout yet.
