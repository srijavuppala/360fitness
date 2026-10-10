# Label-photo AI: setup and verification

The app now has a real Gemini photo-extraction integration. It is not live in this checkout until a server API key is supplied. Phone use additionally requires a configured Firebase project, deployment and a new native build. There is no sample-response fallback in the app or real server.

## Try it in the local browser preview

1. Create a Gemini API key in [Google AI Studio](https://aistudio.google.com/api-keys). Review that account's service terms and quotas.
2. Put the key after `GEMINI_API_KEY=` in `functions/.env.label.local`. This ignored file was created with owner-only permissions. Never put the provider key in `EXPO_PUBLIC_*`, mobile source, screenshots or chat.
3. From `functions`, run `npm run label:dev`. Restart that process after changing the key. Node 22+ reads the local environment file. No Firebase project is required for this local preview.
4. Open the mobile development preview on `http://localhost:8081`, then Add Meal → Read a label. Choose a clear photo and press **Read photo with AI**. The photo is sent only after that action. Review **Check what AI read**, choose **Use extracted values**, check the label basis and portion, then review the meal before confirming it.

The development bridge binds exclusively to `127.0.0.1:8787`. It checks the Host and Origin, only permits the local Expo preview origin, requires JSON plus a custom header, limits the request body and rate-limits analysis. It is intentionally unavailable from phones and production browser builds. Do not tunnel or deploy this development bridge.

## Configure iPhone and Android

- Choose final bundle/application identifiers before Firebase registration or distribution. The current `com.fitness360.demo` identifiers are provisional.
- Register those iOS/Android apps in your Firebase project. Download their **client configuration** files (`GoogleService-Info.plist`, `google-services.json`), not service-account private keys. Place them in `apps/mobile` or provide build-time `GOOGLE_SERVICES_PLIST` / `GOOGLE_SERVICES_JSON` paths through EAS file variables.
- Enable Anonymous Authentication. The app obtains a Firebase anonymous user only when a person requests AI reading. It does not upload or synchronize their meal diary.
- Register App Check providers: App Attest with DeviceCheck fallback for iOS and Play Integrity for Android. This integration uses production attestation; there is no hardcoded debug token or App Check bypass. Android validation requires appropriate Play distribution; use an internal Play testing track. Native attestation must be tested on the actual signed builds.
- Configure `GEMINI_API_KEY` in Firebase Secret Manager with `firebase functions:secrets:set GEMINI_API_KEY --project YOUR_PROJECT_ID`. The function binds this secret; do not deploy a local key file.
- Deploy the callable with `firebase deploy --only functions:analyzeLabelCallable --project YOUR_PROJECT_ID`. Deployment requires the appropriate Firebase billing/project access. No project, billing plan or deployment was created in this task.
- Set `EXPO_PUBLIC_LABEL_AI_ENABLED=true` in the selected mobile build environment and build both platforms. `app.config.ts` enables the RN Firebase plugins and dynamic iOS frameworks only for this configuration; `react-native.config.js` excludes those native modules from unconfigured demo builds. React Native Firebase is not available in Expo Go.
- Set server `GEMINI_LABEL_MODEL` only if overriding the default `gemini-2.5-flash`. The model name is server controlled.

Native requests obtain Firebase ID and App Check tokens and POST the callable protocol to the project's fixed `us-central1` endpoint. The function verifies both, validates the image, and atomically consumes the existing shared allowance of 5 analyses/minute and 50/day before the provider call. The quota counter is outside the client-writable user namespace. Anonymous sessions can be recreated, so quotas do not replace project-level billing alerts and abuse monitoring before public release.

## Data and review rules

- The client re-encodes the selected image as JPEG, resizing its longest edge to at most 1600 pixels. The server accepts bounded JPEG/PNG payloads up to 4 MB; no remote image URLs or SVGs are accepted.
- Gemini sees the selected image and a fixed transcription prompt. The image's text is untrusted input. No tools, URL retrieval, diary contents or user food preferences are included.
- Only one printed nutrition column is extracted. Unknown units, ambiguous column headings, qualified values such as `<1 g`, incomplete output and uncertain values must not become confident numbers. Runtime validators run on both sides. The model can still make transcription mistakes: explicit human review remains required.
- No health score, allergy-safe conclusion or personalized medical advice is produced. This reads printed facts, not a meal's calories from appearance.
- Extracted values stay in memory until accepted into the editor; accepting replaces all four nutrition fields and resets the portion and confirmation. Meals keep AI-assisted attribution. Saving is a separate user action.
- The app/server do not store uploaded photos or extracted text in cloud storage/database/logs. Native picker/manipulator files can remain in OS-managed cache. Google processes submitted images under its [Gemini API terms](https://ai.google.dev/gemini-api/terms); provider retention/training policy depends on the account/service tier. Firebase retains the anonymous auth record and quota counter. Resetting the local diary does not delete those server records.
- Cancelling or leaving the screen prevents late results from overwriting edits. An upload already accepted by the hosted server may finish processing; cancellation does not retract data already sent.

## Evidence and limits

- App: 37 tests cover parsing, conservative unknown handling, portion scaling, AI attribution, callable transport, errors, cancellation and timeout during credentials/networking.
- Backend: 54 total tests, including photo validation, provider request format and redaction, incomplete/blocked output, auth/App Check/quota boundaries and local-server origin/rate checks.
- Browser: real missing-key error verified through image resizing and the actual local server. A separately injected, explicitly labeled `TEST RESPONSE` verified accepting fields → 1.5 servings → unsaved 300 kcal AI-attributed draft. The temporary fixture server was stopped and the normal server restored. No meal was confirmed.
- Both iOS/Android JavaScript exports and Expo Doctor pass. These do not verify native compilation, real attestation, camera behavior or extraction accuracy. Live Gemini, deployment and physical-device checks remain blocked on credentials/configuration.
- Dependency audit remains a release task. A newly exposed gRPC advisory was removed with a compatible `@grpc/grpc-js` override; other existing toolchain/dependency findings need compatibility review. No blind major downgrades were applied.

References: [Gemini generateContent API](https://ai.google.dev/api/generate-content), [Expo ImageManipulator SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/imagemanipulator/), [RN Firebase setup](https://rnfirebase.io/), [native App Check](https://rnfirebase.io/app-check/usage), [Firebase callable protocol](https://firebase.google.com/docs/functions/callable-reference).
