# Welcome and cloud profile verification — 2026-10-08

## Verified locally

- Welcome browser viewports 390×844, 375×574 and 320×568: no overflowing scroll container; main CTA visible. The short viewport reserves extra height compared with a 375×667 phone for native safe areas. Native accessibility font sizing remains enabled; unusually large text can still scroll instead of being clipped.
- Screenshot evidence: `welcome-fit-390.png`, `welcome-fit-short.png`.
- Unconfigured Account screen gives an honest setup state and a working back action.
- Mobile typecheck, Expo lint and 57 unit tests passed.
- 78 Firestore emulator tests passed: verified owner access; denied anonymous, unverified and other-user access; valid schema and conditional answers; rejected malformed values; monotonic revisions.
- Two repository integration tests passed against the local emulator using Firebase SDK mock auth tokens: live updates between clients, stale-write rejection, deletion/recreation conflicts, read/delete flow and unreachable-server failure. Mock tokens are restricted to test code. This does not verify email delivery or physical-device authentication.
- 60 existing backend tests passed.
- Expo exports for iOS, Android and web passed. These are JavaScript bundles, not signed builds.

## Environment notes

Firebase CLI 15 requires Java 21, while this Mac has Java 17 available. Local rule tests used the existing Firestore emulator 1.19.8 JAR under Java 17 directly, followed by the same rule and repository test commands. CI installs Java 21 and uses the Firebase CLI emulator command.

Dependencies remain outside the iCloud-managed checkout through the ignored `node_modules` symlink. A standard fresh checkout uses `npm ci`; no personal cache path is in application imports.

## Not verified / not deployed

No Firebase client configuration was supplied, no live rules deployment occurred, and sign-in/verification/reset email, native credential persistence and App Check need configured-device testing. Cloud saves are explicit, not automatic synchronization. Meals and drafts remain local. No GitHub push or signed EAS build was made in this change.
