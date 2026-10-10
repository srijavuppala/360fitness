# 360° Fitness

The primary product is the **React Native + Expo mobile app** for iPhone and Android in [`apps/mobile`](apps/mobile/README.md). The React website in `apps/web` is a companion implementation.

For native installation and the current build status, see the [phone build guide](apps/mobile/PHONE-BUILDS.md).

## Mobile backend and delivery

See [mobile architecture and Firebase setup](docs/mobile-architecture.md) for the profile database, account flow and release gaps, and [GitHub workflow](docs/github-workflow.md) for CI and PR handling. Completed onboarding profiles can be explicitly saved/restored through Account; live Firebase configuration is still required. Meals and drafts remain local.

## Companion website

```bash
cd apps/web
npm ci
npm run dev
```

Open http://localhost:5173. Run `npm run check` for lint, tests, type checking and the production build.

The website works locally without accounts. Firebase sign-in, sync and server-side meal analysis have integration code, but need project configuration and live verification before release. See [website setup](apps/web/README.md) and [verification evidence](apps/web/qa/VERIFICATION.md).

## Repository

- `apps/web/` — active React website. Root Firebase Hosting and Vercel configuration deploy this directory.
- `apps/mobile/` — React Native + Expo app and shared meal-domain logic. See its [README](apps/mobile/README.md).
- `functions/` — Firebase meal analysis and account deletion, including server-side analysis quotas.
- `docs/` — product, architecture and implementation decisions.
- `lib/`, `test/`, `legacy/web-prototype/` — retained Flutter prototypes. [Historical notes](docs/legacy-flutter.md).

Cloud credentials and AI secrets are not committed. No live deployment has been performed for the React website.
# 360fitness
