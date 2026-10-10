# Website verification — October 6, 2026

## Confirmed locally

- `npm run check`: ESLint, 8 domain tests, TypeScript and Vite production build passed.
- `functions/npm test`: 47 backend tests passed, including rate limiting and recent authentication policy.
- Firestore emulator: 73 ownership/isolation tests passed, including website records and denial of direct analysis-usage access. Executed with Firebase CLI 14.15.2 and Firestore emulator 1.19.8 / Java 17. CI uses the locked project CLI with Java 21.
- Website production dependency audit: zero reported vulnerabilities. Compatible grpc-js override fixes the transitive Firebase advisory.
- `git diff --check` passed.
- Connected-release configuration check correctly blocks an unconfigured release.

## Browser evidence

Desktop 1440 × 1000 and narrow 390 × 844 views inspected in the Codex browser. QA used a separate 127.0.0.1 origin to avoid modifying the user's localhost workspace.

- Landing and workspace navigation, empty dashboard and starter meal review rendered.
- Compiled production preview on port 4174 rendered the landing page and app route with no console errors during that smoke test.
- Created a 300-kcal breakfast, saved it as a usual meal, and reloaded: both persisted.
- Edited oats from 40 g to 20 g: diary became 225 kcal with one entry; the saved usual meal stayed 300 kcal.
- Added 250 ml and 500 ml water, undid the last addition: 250 ml remained.
- Header Log meal opened the editor from the diary; cancel dismissed it.
- Food search for salmon returned only salmon. Fixed screen-reader label overflow; library document width equals 390-pixel viewport. The nutrition table scrolls within its own container.
- Saved a test display name and reloaded: preference persisted.
- Mobile menu closes after navigation; collapsed links are absent from accessibility tree.
- Native dialogs provide browser focus handling and Escape dismissal.

Screenshots: `landing-desktop.png`, `dashboard-desktop.png`, `dashboard-mobile.png`.

## Not verified / release gates

- Firebase project, web config, App Check registration, server secrets and final domain are not supplied. No live deployment performed.
- Real Google sign-in, App Check enforcement, multi-device sync, deployed isolation, AI errors/quotas and account deletion require disposable-account smoke tests.
- JSON backup validation/roundtrip and AI estimate parsing are covered by unit tests; browser file export/restore and connected recovery still need a release smoke test.
- Photo analysis is not implemented; connected text analysis is gated behind configuration and user review.
- Operator/contact/legal details, retention decisions, backups, monitoring, budgets and rollback procedure need project-specific configuration.
- All account records currently load together; pagination is needed for large histories. Same-record concurrent edits use last-write-wins. Cloud restores over 450 changed records reject atomically.
- Optional Firebase chunk exceeds Vite's 500-kB warning threshold (about 165 kB gzipped); it is dynamically imported only for configured accounts.
- GitHub Actions workflow is provided but has not been executed by GitHub in this session.

This is a working local website with deployment configuration, not a verified live production service.
