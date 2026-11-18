# Live app requirements (public store release, MCP-first)

What must be true before 360 Fitness is listed publicly on the App Store and Google Play under the lean, direct-to-consumer plan in [PRODUCT-PLAN.md](../business/PRODUCT-PLAN.md). The clinic-led *Nourish US Live App PRD v0.3* remains the requirement set **if** a clinic pilot starts. Its R-numbers are reused below where they apply.

Priority: **P0** = blocks launch · **P1** = launch-month follow-up.

## 1. Functional

| ID | Requirement | Acceptance | P | Status |
| --- | --- | --- | --- | --- |
| L01 | Onboarding works without an account; health section optional and skippable | Fresh install → Today in < 3 min; skipping never blocks | P0 | ✅ |
| L02 | Meal logging: search (USDA/OFF), barcode, usual meals, manual; explicit confirm (R05) | Draft/plan never counts; retry creates one record | P0 | ✅ (D03 for same-meal-twice) |
| L03 | Corrections keep history; stale edits can't overwrite (R06) | Correction shows new total and keeps the previous revision | P0 | ❌ D03 |
| L04 | Fiber tracked and shown | Search results and totals include fiber when the source has it | P0 | ❌ D01 |
| L05 | Partial totals: unknown items counted, not blanking the day | "1,240 kcal + 1 item unknown" | P0 | ❌ D02 |
| L06 | Glucose log with units, context, consensus ranges, safety notices | Values outside 20–600 mg/dL rejected; <70 shows notice | P0 | ✅ |
| L07 | Workout goals and tracking; planned ≠ completed (R09) | Goal bar updates; planned/skipped excluded | P0 | ✅ |
| L08 | Health-aware targets withhold unsuitable estimates | Kidney → protein/carbs withheld; clinician values labelled | P0 | ✅ |
| L09 | Trends show gaps as unrecorded (R10) | No zero-filled days in charts or averages | P0 | ✅ |
| L10 | Data export: CSV of meals, glucose, workouts (R10) | Export opens in a spreadsheet; includes sources | P0 | ❌ |
| L11 | In-app account and data deletion (store rule) | Deletes local + cloud copies; confirmed with a disposable account | P0 | Partial (web has it; mobile needs it) |
| L12 | Doctor report (PDF) | Advisor-approved layout; gaps visible | P1 | ❌ |
| L13 | Remote MCP connector with OAuth | Each tool call resolves to one user; destructive tools flagged | P1 | Local server ✅ |
| L14 | Reminders (notification at chosen check-in time) | Opt-in; respects quiet hours | P1 | ❌ |

## 2. Safety (all P0)

| ID | Requirement |
| --- | --- |
| S1 | No feature recommends medication or insulin doses or diagnoses. Checked in code review for every PR touching glucose, targets or MCP tools |
| S2 | Safety copy for low/very high glucose approved by a clinical advisor (current copy is a placeholder in `glucose-core/src/glucose.ts`) |
| S3 | Every screen with targets shows whether a value is an app estimate or clinician-provided |
| S4 | MCP server `instructions` and tool descriptions carry the no-dosing/no-diagnosis rule. Safety notices are returned verbatim |
| S5 | Plain "not for emergencies; call 911" message on Glucose and in the store listing |
| S6 | Exclusions stated in-app: type 1 dosing, pregnancy, under 18, eating-disorder recovery |

## 3. Privacy and security (all P0)

| ID | Requirement | Evidence |
| --- | --- | --- |
| P1 | Health data local by default; each cloud backup has its own consent | Sakshi's consent flow ✅; Phase 2 sync to follow the same pattern |
| P2 | Owner-only Firestore rules for every collection, emulator-tested; deny-all fallback | `functions/test/firestore-rules.test.js` in CI |
| P3 | No advertising or analytics SDK receives health data | Dependency review in CI; manual check before release |
| P4 | Privacy policy lists every processor (Firebase/Google, USDA, Open Food Facts, Expo, any AI provider) and the user's rights | Counsel sign-off (tracker P02) |
| P5 | Breach-response runbook covering the FTC Health Breach Notification Rule | Doc in `docs/` + named owner |
| P6 | Secrets never in client builds; CI secret scanning; dependency audit gate | `security.yml`, `.githooks/pre-push` ✅ |
| P7 | Branch protection on `main` requiring the single **CI passed** check (`ci.yml` runs security, mobile, web, backend and packages on every branch) | GitHub ruleset (owner action; steps in `docs/github-workflow.md`) |

## 4. Quality

| ID | Requirement |
| --- | --- |
| Q1 | Signed iOS and Android builds tested on physical devices (SQLite, camera, speech) |
| Q2 | WCAG 2.2 AA: VoiceOver/TalkBack, 200% text, contrast, buttons for every gesture |
| Q3 | Offline: logging works without network; failed saves never show success |
| Q4 | Crash-free sessions ≥ 99.5% during beta |
| Q5 | P0 user bugs U04–U07 (account isolation, missing log, Today display, dictate keyboard) closed |

## 5. Launch gate checklist

- [ ] All P0 rows above are ✅
- [ ] Closed beta (10–20 people with T2D/prediabetes) met the Phase 1 gate
- [ ] Clinical advisor sign-off (S2, report layout, education copy)
- [ ] Counsel sign-off (privacy policy, terms, store claims)
- [ ] Store listings: medical disclaimer, privacy labels, account deletion link
- [ ] Rollback plan: previous build kept in TestFlight/Play internal track; feature flags for photo AI and MCP
