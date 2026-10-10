# Open-source reuse assessment

Reviewed October 6, 2026. The user requested reusing a similar GitHub project to accelerate development.

## Selected candidate

[AtharvaK51/CalorieTracker](https://github.com/AtharvaK51/CalorieTracker) is the closest permissively licensed nutrition-focused candidate reviewed. A shallow clone is available locally at `/Users/srijavuppala/.codex/reference-repos/fitness360-calorie-tracker`, outside the iCloud-managed checkout.

- Inspected revision: `fea612de44804ade28ae5ea0e75cb3219a37cb1a` (March 28, 2026).
- Verified LICENSE: MIT, copyright 2026 AtharvaK51. Preserve its copyright and full permission notice with any copied substantial code.
- Inspected stack: Expo 55, React Native 0.83.2, TypeScript, Expo Router, SQLite, Zustand, Gluestack UI and react-native-chart-kit. Our app uses Expo 57 and React Native 0.86.3.
- Reviewed actual source for water controls, chart container, SQLite initialization, AI orchestration and AI response parsing. Clone completed successfully. Dependencies were not installed and this candidate has not been run or device-tested.

## Recommended reuse

Keep `apps/mobile` as the application and adapt selected modules from this clone. This preserves the working usual-meal/check-in flow while allowing reuse of feature implementations. Replacing the entire app would also introduce an SDK migration, a different storage schema and a different product flow.

| Candidate area | Useful starting point | Integration work |
| --- | --- | --- |
| History and analytics | Chart components and period-based stats screen | Connect confirmed entries, preserve missing-day semantics, use our theme and verify chart dependencies on Expo 57 |
| Text meal analysis | Prompt/result structure and review flow | Use our server-owned AI credentials; validate every item, units, finite nonnegative numbers and totals; keep results as drafts until confirmation |
| Water tracking | Add/undo UI and intake persistence | Optional later feature; adapt storage, accessibility and configurable goals before shipping |
| CSV export | Existing export service | Map our records and verify native/web export and spreadsheet-safe values |

The candidate's AI currently calls providers directly using a user-supplied key stored with SecureStore. That differs from our planned server-mediated service. Its parser checks only `total.calories` before accepting most remaining fields. These modules need adaptation rather than direct production adoption. No test scripts or test files were found in the inspected revision.

Files in its `references/` folder include Cal AI-branded reference imagery. They are not evidence of the candidate's running interface and should not be copied as our product branding or assets.

## Other candidates reviewed

| Repository | Finding | Decision |
| --- | --- | --- |
| [antomanc/simple-calorie-tracker](https://github.com/antomanc/simple-calorie-tracker) | React Native food search/barcode diary; repository identifies GPL-3.0 | Consider only if we choose a compatible distribution approach; not selected for code copying |
| [adiiaot/calfit](https://github.com/adiiaot/calfit) | Broad nutrition/workout feature set; terms require a commercial license for an app-store or commercial foundation | Not selected |
| [neiltapita/atlas-fitness-app](https://github.com/neiltapita/atlas-fitness-app) | Close nutrition/workout/photo scope; no LICENSE visible in reviewed root listing | No code reuse without verified permission |

## Current status

First integration implemented in `apps/mobile`:

- Adapted `ChartCard` and the stats period/summary layout for 7- and 30-day calorie/protein views. Chart drawing uses existing React Native primitives, avoiding an additional chart dependency. Missing, skipped-only and unknown-nutrition days are excluded from averages; genuine recorded zeros remain valid.
- Adapted the JSON estimate extraction and manual prompt/import workflow. Added strict per-food validation, numeric or explicit legacy string portions, unknown-value preservation, and totals recomputed from foods. The review screen supports food corrections and explicit confirmation; importing alone never records intake.
- Added an `ai` source marker compatible with the existing version-1 data structure. No database migration or dependency changes required. Drafts remain in memory and expire on restart, as explained in the review screen.
- Retained the upstream MIT license in `apps/mobile/licenses/CalorieTracker-MIT.txt`, source comments, and Profile → Open-source credits.

Automatic AI calls remain pending native authentication/App Check and server integration. The import flow is a usable local fallback, not a claim that live AI is connected. Water and workout tracking remain outside the core scope.
