# 360° Fitness website

Responsive React + TypeScript website and nutrition workspace, built with Vite. Public site, diary, reusable meal plans, food library, progress, hydration, personal targets, backups and account integration. Shared meal/analysis logic is reused from `../mobile`; keep both directories in the checkout.

## Run

From the repository root, install both apps' dependencies. Vite reads the mobile domain modules' Expo-based TypeScript configuration during the web build.

```sh
npm --prefix apps/mobile ci
cd apps/web
npm ci
npm run dev
npm run check
```

Preview: http://localhost:5173. Production assets: `apps/web/dist`.

Without Firebase configuration the site explicitly uses a local workspace. No cloud or AI service is simulated. Browser storage failures do not overwrite existing data. Start with an empty log; food-library values are labeled starter estimates.

## Connected setup

1. Copy `.env.example` to `.env.local`. Set the Firebase web app config and reCAPTCHA Enterprise public site key. No private AI keys belong in Vite environment variables.
2. Enable Google sign-in in Firebase Authentication; authorize the final website domain and localhost for development. Register those domains for App Check and enable enforcement for Firestore/Functions after verification.
3. Deploy the repository's Firestore rules and Cloud Functions into the same project. Create the Gemini/USDA server secrets. Set billing budgets and alerts.
4. Only set `VITE_ENABLE_AI=true` after `parseMealCallable` is deployed and verified. Descriptions are sent only after explicit Analyze. The review step remains mandatory. Photo analysis is not implemented.
5. Build with configuration injected. Run `npm run release:check` with the same environment. Run live smoke tests below before promoting the deployment.

Account records live under `users/{uid}/webRecords/{recordId}`. Writes update only changed records, in an atomic batch, preserving unrelated changes from other devices. Simultaneous edits of the same record are last-write-wins. All records currently load for an account; add query pagination before supporting very large histories. A restore changing more than 450 cloud records is rejected before writes. Local data stays separate on sign-in and is never uploaded implicitly.

Deletion reauthenticates with Google and invokes `deleteAccount`, which removes the entire user tree (including any linked mobile records), then the auth account. Do not enable account deletion until this has been checked with a disposable account.

## Deployment

Root `firebase.json` serves `apps/web/dist`; root `vercel.json` builds this website. Firebase and Vercel deployments still require a chosen project and domain. No deployment is performed automatically by local development. The app has SPA fallback routes, caching headers, a favicon, metadata and a not-found page. The landing page is client-rendered; prerender it if search-engine indexing is a launch requirement.

## Release verification

- Automated: lint, TypeScript, tests, Vite production build; backend tests and Firestore ownership rules tests.
- Browser: local meal create/edit/delete, saved-plan logging, hydration/undo, filters, date navigation, empty history, estimate validation/review, backup export/restore, narrow/wide layouts and keyboard dialogs.
- Live, not yet verified: Google auth on final domain, App Check enforcement, per-user isolation on deployed rules, multi-device sync, provider errors/rate limits, account deletion and backup recovery.
- Operations: operator/contact/legal policy details, region/retention policy, backups, monitoring/alerts and deployment rollback need real project decisions. The privacy page describes software behavior and flags its incomplete operator terms.

Passing a static build does not prove production service readiness. See `qa/VERIFICATION.md` for exact evidence and remaining gates.

## Attribution

The shared estimate importer and chart patterns originate from MIT-licensed AtharvaK51/CalorieTracker, revision `fea612de44804ade28ae5ea0e75cb3219a37cb1a`. Full notice is available in Settings → Open-source credits and `../mobile/licenses/CalorieTracker-MIT.txt`. No upstream reference images or brand assets were copied.
