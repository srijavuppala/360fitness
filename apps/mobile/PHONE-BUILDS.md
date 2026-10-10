# iPhone and Android builds

The mobile product is `apps/mobile`, implemented with React Native and Expo SDK 57. The website on port 5173 is a separate companion. Port 8081 shows a browser preview of the actual React Native screens; it is not a phone installation.

## Current status

Updated October 10, 2026. EAS is linked to [@shiji123s-team/fitness360](https://expo.dev/accounts/shiji123s-team/projects/fitness360), project ID `4c8f5119-e51b-46a7-8f9e-9deb32d30dc5`. Expo CLI authentication and organization ownership are verified. Mobile type checking and lint passed after linking.

The first Android preview build was submitted: [build e2de24a2](https://expo.dev/accounts/shiji123s-team/projects/fitness360/builds/e2de24a2-48e2-46b1-b165-667616d0ff0e). Check its status before sharing an installation link; a submitted build is not a finished APK. iPhone distribution still needs the owner's Apple Developer login and tester device registration.

The EAS `preview` environment contains the public Firebase client configuration, meal-photo AI Logic enabled and callable label AI disabled, matching the current local configuration. Values are managed in EAS rather than committed. The `development` and `production` environment names are explicit but those environments have not been populated by this setup.

## Installable testing builds

From `apps/mobile`, after signing into the intended Expo account:

```sh
npx eas-cli@latest whoami
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest device:create
npx eas-cli@latest build --profile preview --platform ios
```

Use the Android build's APK install link. Register the test iPhone when prompted before creating its ad hoc build. The preview profile bundles the JavaScript and does not require the Metro server. Provisioning and signing must be completed with the intended account. Existing identifiers `com.fitness360.demo` are provisional; choose final identifiers before a store release.

For development clients with live reload, use the `development` profile and then `npm start`. Do not confuse successful bundle exports with installed-device verification.

## Share across different Wi-Fi networks

For normal testing, share a finished preview build's EAS page. Android testers install its APK. iPhone testers must be included in the ad hoc provisioning profile before installing its IPA. Preview builds bundle the app and do not need the developer's laptop or Metro server. Online Firebase/AI features still require internet and valid service configuration.

For live development, first install a matching development build, then run `npx expo start --dev-client --tunnel` and share the generated link/QR code. Keep that terminal running and the laptop awake. A localhost/LAN URL will not work on another Wi-Fi network. The preview build above is not a development client.

Teammates should accept their organization invitations and use their own Expo accounts. Firebase accounts inside the app are separate. The local app workspace is not yet isolated per signed-in user; use separate devices or sample data until that migration is implemented.

## Device acceptance checks

- Complete setup, add a manual meal and confirm its portions.
- Kill and reopen the app: SQLite restores meals and preferences.
- Edit and undo a meal; ensure history has one correct entry.
- Open the keyboard on a small screen and reach Save without overlap.
- Check bottom tabs above the home indicator/navigation bar.
- Review the calorie/protein charts and missing-day behavior.
- Test local JSON sharing and cancel flows.

The React Native app has account, profile/prep cloud-copy and photo-AI integration code. This build does not establish that every cloud flow works on a physical device. Full diary synchronization, notifications and safe local account switching remain pending. Automatic mobile text-to-meal analysis is not fully connected.

Reference: [Expo internal distribution](https://docs.expo.dev/build/internal-distribution/).

## Build archive and signing

The Android signing keystore is managed by EAS. No signing material was committed. The root `.easignore` excludes backend/legacy sources, machine settings, reports, local environments and signing files. Native Firebase config files must be supplied through the intended build environment if callable/native Firebase support is enabled later. Apple credentials must be entered directly in the owner's terminal, never in chat or source files.
