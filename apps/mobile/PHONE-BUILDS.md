# iPhone and Android builds

The mobile product is `apps/mobile`, implemented with React Native and Expo SDK 57. The website on port 5173 is a separate companion. Port 8081 shows a browser preview of the actual React Native screens; it is not a phone installation.

## Current status

Both platforms' JavaScript/Hermes exports pass, together with TypeScript, ESLint and 16 domain tests. A signed APK or IPA has not yet been generated. Expo login is required on this machine. The user has confirmed Expo and Apple Developer accounts.

## Installable testing builds

From `apps/mobile`, after signing into the intended Expo account:

```sh
npx eas-cli@latest whoami
npx eas-cli@latest build:configure
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest device:create
npx eas-cli@latest build --profile preview --platform ios
```

Use the Android build's APK install link. Register the test iPhone when prompted before creating its ad hoc build. The preview profile bundles the JavaScript and does not require the Metro server. Provisioning and signing must be completed with the intended account. Existing identifiers `com.fitness360.demo` are provisional; choose final identifiers before a store release.

For development clients with live reload, use the `development` profile and then `npm start`. Do not confuse successful bundle exports with installed-device verification.

## Device acceptance checks

- Complete setup, add a manual meal and confirm its portions.
- Kill and reopen the app: SQLite restores meals and preferences.
- Edit and undo a meal; ensure history has one correct entry.
- Open the keyboard on a small screen and reach Save without overlap.
- Check bottom tabs above the home indicator/navigation bar.
- Review the calorie/protein charts and missing-day behavior.
- Test local JSON sharing and cancel flows.

The mobile app is still a local build. Auth, sync, live text/photo AI and notifications are pending; the companion website's Firebase integration is not wired into the native app.

Reference: [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/).

## Build preparation — October 7, 2026

Expo CLI remains signed out. The previous device authorization expired. The browser's Google flow reached a new-account username conflict; existing-account login is open for the owner to complete. Start a fresh device authorization after that login succeeds. Do not reuse the expired code.

Updated the five Expo SDK 57 patch dependencies identified by Expo Doctor. The repository-root `.easignore` omits the companion website, legacy Flutter sources, backend and local caches from phone-build uploads. EAS archive inspection itself requires login and has not yet succeeded.
