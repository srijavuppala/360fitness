# Expo collaborators, testers and app accounts

Reviewed October 10, 2026. These are three separate kinds of access.

## People helping develop the app

Create an Expo Organization from the account menu. In Organization settings → Members → Invite, enter each person's email and choose the minimum role they need: Developer for build contributors, Viewer for people who only need viewing access. Keep personal logins separate. Existing projects must actually belong to the organization; use the documented transfer process if needed, then align the app owner/project configuration. Do not invent an organization slug or project ID.

Source: [Expo account types and invitations](https://docs.expo.dev/accounts/account-types/).

## People testing on phones

Use a signed internal preview build for this app's native speech/Firebase modules. The existing `apps/mobile/eas.json` has an internal `preview` profile with Android APK output. Expo Go does not contain every native dependency in this project.

After the intended EAS project, signing and environment configuration are ready:

```sh
cd apps/mobile
npx eas-cli@latest whoami
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest device:create
npx eas-cli@latest build --profile preview --platform ios
```

Share the Android APK install link. For iPhone ad hoc distribution, register each test device before building; adding devices later requires updated provisioning through another build or re-signing. For a larger external pilot use TestFlight and Google Play testing tracks. Preview builds bundle JavaScript and do not depend on the laptop's Metro server.

Internal build links can allow access without an Expo login; turn off unauthenticated access in project settings when builds should be limited to authorized Expo accounts. No invitations or builds were issued by adding this guide.

Sources: [internal distribution](https://docs.expo.dev/build/internal-distribution/) and [review distribution options](https://docs.expo.dev/review/overview/). Expo Go's published-update access is limited to project owners and organization members: [May 2026 change](https://expo.dev/changelog/expo-go-loading-changes-may-2026). Do not distribute a shared personal Expo password as a workaround.

## People using 360 Fitness

App customers create their own Firebase Auth accounts, not Expo memberships. The Account screen already contains email/password registration, sign-in and verification, and the profile/prep repositories have ownership-aware cloud code. Live project setup and full user isolation still need verification.

The current SQLite `app_state` table contains one device-wide record. Signing into a different account does not by itself make that local state private to the new account. Release work must include:

- UID-scoped storage and pending writes, with a distinct guest namespace.
- Explicit consent to copy guest meals/profile into an account; no silent upload after a login.
- Cancel old listeners and queued operations at sign-out; load the new user's state before rendering it.
- Owner-scoped Firestore paths and rule tests denying cross-user reads/writes.
- Idempotent sync, account deletion across all collections, and clear handling of offline drafts.

Test with two Firebase accounts A and B on the same device and across two devices. Verify that signing out/in never displays, merges or uploads the previous user's meals, profile or prep plan. See U04 in [the feedback backlog](USER-FEEDBACK-BACKLOG.md).
