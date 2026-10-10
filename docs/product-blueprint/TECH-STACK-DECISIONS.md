# 360 Degree Fitness AI — Tech Stack Decisions

Status: living document. Repository evidence reviewed on **2026-10-05**.
Working brand: **360 Degree Fitness AI / 360° Fitness AI**; existing code uses **Nourish**.

**Platform decision confirmed on 2026-10-05:** build the app exclusively with
**React Native + Expo + TypeScript** for iPhone and Android. Flutter is excluded
from new development. Existing prototype files are historical reference only;
they are not a prerequisite for building or releasing the new app.

This is the technical companion to the [product PRD](Nourish-PRD.md) and
[React Native implementation plan](REACT-NATIVE-BUILD-PLAN.md). The PRD describes
the product; this document explains the technology choices, their reasons,
their costs, and the conditions under which we should reconsider them.

**Read the status labels literally:**

- **Confirmed direction:** the implementation plan records the user's choice of
  React Native with Expo for iPhone and Android.
- **Existing implementation:** code is present in this checkout; this does not
  establish that it is deployed or production-ready.
- **Proposed:** the target architecture or a recommendation still to implement
  and validate. Reasons below explain the design, not an undocumented history
  of decisions already approved.

**Implementation update — October 6, 2026:** a React Native local-demo foundation
now exists in `apps/mobile`; see its [verification record](../../apps/mobile/qa/VERIFICATION.md).
Cloud integration and signed-device validation remain pending. The repository also
contains an older Flutter client and Node/Firebase services. The React Native plan supersedes the
original PRD's Flutter recommendation. No cloud account, live deployment,
nutrition benchmark, or physical-device behavior was verified for this document.
Existing test results were not rerun.

---

## 1. Product constraints that drive the stack

| Constraint | Consequence for the stack |
|---|---|
| **iPhone and Android, with React Native selected** | Build one React Native app with Expo and TypeScript. All new mobile screens, state and device integrations belong in `apps/mobile`. |
| **Usual meals should make daily logging quicker** | Keep reusable meal templates separate from confirmed intake. A plan or AI draft must never increase daily totals automatically. |
| **Logging must survive poor connectivity and interruptions** | Persist drafts and pending operations on the device; make server mutations retryable and protect against conflicting edits. |
| **AI estimates need correction** | Text and photos produce editable drafts. Food matching, serving conversion, validation and user confirmation are separate steps. |
| **Meal records and photos are personal data** | Scope records and uploads to the authenticated user, minimize photo retention, and implement export and retryable deletion. |
| **There is an existing Firebase foundation** | Reuse verified backend components where useful. A database or infrastructure migration needs a concrete benefit. |
| **Audience, geography, budget and team capacity remain open** | Do not invent residency guarantees, monthly cost forecasts, staffing assumptions or delivery dates. Select regions and spending limits before a real pilot. |

---

## 2. Shape of the system

### Target architecture — proposed, not deployed

```text
React Native + Expo + TypeScript
        |
        +--> Expo Router + feature hooks/reducers + shared UI tokens
        |
        +--> SQLite: cached reads, editable drafts, durable outbox
        |         |
        |         +--> Sync worker: stable operation IDs + revisions
        |
        +--> React Native Firebase: Auth + native App Check
                  |
                  +--> Authenticated Cloud Functions
                  |      +--> Meal mutation transaction
                  |      |      +--> Firestore entries + summaries + receipts
                  |      +--> Text analysis --> Gemini --> food resolution
                  |      +--> Photo job -----> Gemini --> food resolution
                  |      +--> Export / deletion workflows
                  |
                  +--> Firestore reads --> refresh local cache
                  +--> Authorized private photo upload --> Cloud Storage

Food resolution: USDA adapter + serving conversions + manual fallback
Analysis result: editable draft --> user confirms --> meal mutation service
```

**Why confirmed meals go through the backend.** The server must authorize the
operation, check its revision, validate the items, calculate accepted totals,
and record the result once. Direct client writes to those same records would
bypass that contract. Firestore rules must enforce this boundary, not merely
hide a write method in the app.

### Existing backend to evaluate for reuse

The Node/Firebase code already contains `parseMealCallable` (Gemini text parsing
with optional USDA gap-filling) and `deleteAccount` (Firestore cleanup followed
by identity deletion). Reuse these only after verifying their contracts against
the new client. Photo jobs, private uploads, SQLite sync and server-owned meal
mutations are future work. The old Flutter prototype is not part of the target
architecture above.

---

## 3. Decisions by layer

### 3.1 Client — React Native + Expo + TypeScript

- **Decision / status.** Confirmed sole mobile stack for the new client in
  `apps/mobile`; implementation pending. Pin compatible package versions when
  the mobile shell is created, rather than copying versions from another app.
- **Why.** Share product behavior and UI across the two selected mobile
  platforms, with TypeScript contracts that can also be used by the backend.
  Expo provides the framework for builds and device integrations.
- **Trade-off.** The existing Dart UI must be rebuilt. Native integrations still
  require platform configuration, builds and device verification.
- **Revisit when.** A required native capability cannot be supported reliably
  through the selected Expo/native-module setup, or measured release overhead
  outweighs the shared-code benefit.

### 3.2 Navigation, UI state and styling

**Proposed baseline:** keep state ownership visible and add dependencies only
when a real feature needs them.

| Choice | Why | Trade-off / revisit when |
|---|---|---|
| **Expo Router** | Represent auth, onboarding, four main tabs and focused logging screens in one route structure. | Route guards and notification entry paths need explicit tests. Revisit if navigation requirements no longer fit the route structure. |
| **Feature hooks and reducers** | Meal editing has meaningful states: draft, analyzing, needs review, pending, saved, failed and conflict. | Cross-feature state may become awkward. Add a small shared store if duplication or synchronization problems appear. |
| **Shared components and design tokens** | Keep spacing, color, typography, portion controls and estimate cards consistent with the reviewed designs. | Component and styling package selection remains open. Revisit after the first accessible screen set exposes concrete needs. |

Do not automatically inherit Zustand, NativeWind, an animation package or an
icon library from OneAI Wallet. This app's build plan has not selected them.

### 3.3 Device persistence — Expo SQLite

- **Decision / status.** Proposed repository layer for drafts, cached server
  data and a durable outbox. Current Flutter demo storage is SharedPreferences.
- **Why.** An offline save must survive an app restart. The draft and its pending
  operation should be stored together before the UI acknowledges a local save.
- **Trade-off.** We own schema migrations, queue processing, account isolation
  and conflict presentation. SQLite supports persistent device storage, but
  encryption is not automatic; its build configuration must be deliberately
  selected and tested. [Expo SQLite documentation](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **Revisit when.** Device migrations or sync maintenance become a substantial
  source of defects, or a proven alternative satisfies the same recovery tests
  with less complexity.

### 3.4 Firebase integration and authentication

- **Decision / status.** Proposed React Native Firebase in Expo development
  builds. Existing Flutter auth implements Google sign-in; the new client's
  final login methods remain open.
- **Why.** Continue using Firebase identities and the existing callable backend,
  while validating native App Check and mobile service integration early.
- **Trade-off.** React Native Firebase requires native code and cannot run in
  Expo Go. Prove authentication and one protected callable on both platforms
  before building dependent features. [Expo Firebase guide](https://docs.expo.dev/guides/using-firebase/)
- **Revisit when.** The native integration fails required device flows, or a
  confirmed platform requirement makes another SDK/provider more suitable.

### 3.5 Backend — Firebase Cloud Functions, Node, versioned contracts

- **Decision / status.** Existing second-generation callable functions in
  JavaScript ESM; `functions/package.json` declares Node **22**. Proposed new
  services use shared versioned contracts and runtime validation; the exact
  schema library and TypeScript migration sequence remain to be chosen.
- **Why.** Reuse the parser and Firebase integration without introducing a
  separate web server or infrastructure stack for the first release.
- **Trade-off.** Function execution limits, vendor coupling and distributed job
  retries become application concerns. Photo processing needs a retryable job
  workflow; its queue/worker mechanism is still an open implementation choice.
- **Revisit when.** Measured latency, job duration, workload shape or cost makes
  a dedicated service materially better.

Current configuration sets `us-central1`, `maxInstances: 10`, a 60-second parser
timeout and a 120-second deletion timeout. These are checked-in settings, not
proof of deployment, a per-user quota, or a total spending cap.

### 3.6 Cloud data — Firestore, with server-owned confirmed entries

- **Decision / status.** Firestore exists in the current client. The proposed
  model adds individual meal entries, revisions, operation receipts and derived
  daily summaries instead of replacing a whole day on each save.
- **Why.** Separate entries reduce accidental interference between unrelated
  meals. Store the accepted mutation, receipt and summary atomically so a retry
  returns the original outcome. Firestore supports atomic transactions; the
  application still has to implement this contract. [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- **Trade-off.** More records, index planning, read/write costs and a migration
  from the existing day-document model. Reporting across many users may need a
  separate analytics path later.
- **Revisit when.** Relational queries, reporting requirements or measured costs
  outweigh the benefits of the existing Firebase integration.

### 3.7 Meal AI — server-side Gemini behind an adapter

- **Decision / status.** Existing text adapter; proposed photo analysis through
  the same normalization and review pipeline. The code defaults to
  `gemini-2.5-flash`, overridable by `GEMINI_MODEL`. This is a repository value,
  not a claim that it is the newest or best model for release.
- **Why.** Reuse one provider boundary for food candidates and clarification
  questions. Keep provider credentials and model calls outside the mobile app.
- **Trade-off.** Structured JSON does not establish correct foods, portions or
  nutrient values. Validate outputs and benchmark real intended meals before
  accepting a model change. [Gemini structured-output documentation](https://ai.google.dev/gemini-api/docs/structured-output)
- **Revisit when.** A held-out evaluation shows unacceptable corrections,
  latency or cost, or model availability changes. Compare alternatives using
  the same evaluation set before switching.

No custom model training, Python routing service or multi-model gateway is
selected. Those would need evidence of a problem the current adapter cannot solve.

### 3.8 Nutrition — USDA adapter plus explicit manual fallback

- **Decision / status.** Existing USDA lookup fills selected gaps in model
  estimates. Proposed food resolution preserves source IDs, preparation state,
  serving basis and unknown nutrients, with manual correction when unresolved.
- **Why.** A food name and a portion number are insufficient without a matching
  food record and a valid conversion basis. Keep estimate generation separate
  from deterministic quantity scaling.
- **Trade-off.** Matching mixed dishes and intended cuisines needs evaluation.
  The current first-result lookup and generic volume conversions do not satisfy
  the proposed contract; see §6.
- **Revisit when.** Evaluation reveals systematic coverage or serving gaps that
  justify another licensed data source or a curated regional food catalog.

### 3.9 Photos — private Cloud Storage and analysis jobs

- **Decision / status.** Proposed; no photo endpoint or Storage rules are present
  in the current implementation. Start with private temporary objects associated
  with an authenticated owner and analysis ID.
- **Why.** Jobs can survive interruptions without keeping the camera screen
  connected to one long request. Reuse the same editable food draft as text AI.
- **Trade-off.** Upload validation, job deduplication, cancellation and cleanup
  all need implementation. The plan proposes raw-photo retention of no more
  than 24 hours; provider retention must be assessed separately.
- **Revisit when.** A confirmed user need requires retaining photos longer, or
  measured analysis workloads justify a different processing design.

### 3.10 Reminders — local notifications

- **Decision / status.** Local reminders exist in Flutter. Expo Notifications
  is proposed for the new client, with opt-in times and navigation to logging.
- **Why.** Routine reminders do not inherently require a push campaign service.
- **Trade-off.** Permissions, time-zone changes, daylight-saving transitions and
  cold-start navigation need device tests. Delivery is not proof of engagement.
- **Revisit when.** Confirmed requirements need server-triggered or coordinated
  multi-device notifications.

### 3.11 Delivery, observability and quality

- **Decision / status.** Proposed Expo development builds followed by store test
  tracks. Build automation and any EAS Update policy remain to be configured.
  Existing Vercel/Firebase Hosting files serve the Flutter web demo.
- **Why.** Demonstrate the new client on actual devices before external release;
  keep the manual logging flow usable when analysis fails.
- **Trade-off.** Native binary compatibility and store delivery need their own
  release checks. Do not assume every change can ship as an over-the-air update.
- **Quality baseline.** Domain tests, component tests, emulator authorization
  tests and device recovery flows. Test frameworks for React Native remain to
  be selected. Existing Flutter wires native Crashlytics and functions use
  Firebase logging; new-client telemetry is still pending.
- **Revisit when.** Releases or incidents expose missing coverage, diagnostic
  gaps or a need for more specialized tooling.

---

## 4. Cross-cutting decisions

### 4.1 Confirmed intake is the source of daily totals

**Proposed invariant:** templates describe usual meals; analysis drafts describe
possible meals; only confirmed entries contribute to intake. Skipped, unlogged
and incomplete are different states. Preserve item snapshots and target versions
so editing a template or changing a model cannot rewrite history.

**Revisit when:** the product introduces another intake workflow; preserve the
explicit confirmation boundary in any revised design.

### 4.2 Offline saves need stable identity and explicit outcomes

**Proposed invariant:** each mutation has an entry ID, operation ID, request
hash and base revision. Retry the same operation with the same payload. A
duplicate returns its saved result; a conflicting revision requests user review.
Persist the selected local date/time-zone context at capture, not reconnection.

SQLite owns the logged-meal outbox; Firestore subscriptions refresh reads. Avoid
a second direct-write queue for the same entries. Expired receipts require
reconciliation rather than replay as a fresh write.

**Revisit when:** retry-window or conflict requirements change, using app-kill,
reconnect and two-device scenarios to validate the replacement policy.

### 4.3 Nutrition uncertainty remains visible

**Proposed invariant:** unknown nutrients stay unknown, rather than silently
becoming zero. Store quantity, unit, conversion basis, nutrition source and
model/prompt versions. Keep valid source energy; use macro comparisons as
warnings rather than automatically replacing it. Round for display after
calculating totals at full precision.

This deliberately differs from parts of the current parser, which repairs
calories from macros and rounds item values during processing.

**Revisit when:** reviewed data contracts or evaluation evidence justify a
different calculation policy; version it and protect historical records.

### 4.4 Authorization, secrets and privacy

**Existing:** callables require authentication and declare App Check enforcement.
Gemini and USDA keys are bound as function secrets. Firestore rules restrict
client access to the owner's subtree.

**Proposed:** derive ownership from verified identity, enforce authorization in
every privileged handler, deny direct writes to server-owned records, and keep
provider credentials out of client bundles. App Check supplements identity and
authorization; it does not replace quotas. Exclude meal text, photos, tokens
and unnecessary personal details from telemetry.

Deletion should become a retryable workflow that blocks new writes, cancels jobs,
cleans storage and device data, and removes identity last. Export should have a
documented format and an authenticated delivery path.

**Revisit when:** launch geography, providers or retained data change; review
access, retention and deletion behavior before introducing the new data path.

### 4.5 Costs and environments are part of the design

**Proposed:** separate development, staging and production; measure analysis
calls, acceptance/correction rates, latency and cost per accepted analysis.
Choose per-user quotas, request deduplication, usage ceilings and alert thresholds
before beta. Manual logging must remain available when AI is unavailable.

No monthly price estimate is asserted here: user volume, photo frequency,
regions, retention and commercial limits have not been agreed.

**Revisit when:** measured usage changes enough to affect the budget or user
experience, or the commercial model is selected.

---

## 5. Deliberately not selected for this baseline

These are scope choices, not claims that every alternative was benchmarked.

| Alternative | Reason | Revisit when |
|---|---|---|
| **Continue Flutter as the new primary client** | The recorded platform decision is React Native/Expo. Keep useful behavior and tests as references. | The user explicitly reopens platform selection. |
| **Separate Swift and Kotlin apps** | Two independent clients add implementation work without a demonstrated requirement. | Essential platform behavior cannot be delivered adequately in the selected stack. |
| **Move to Supabase/Postgres now** | Firebase services and tests already exist; a migration needs a measured benefit. | Query shape, portability or cost creates a concrete reason. |
| **Kubernetes, ECS or a custom service fleet** | The current callable backend and proposed managed jobs do not establish a need for those systems. | Workload evidence demonstrates a limitation. |
| **Custom food-model training** | No evaluation yet shows that training is required. | Provider adapters fail important cases despite prompt, matching and workflow improvements. |
| **Automatic photo-to-intake logging** | It bypasses review of uncertain food and portion estimates. | Any proposed change first demonstrates how explicit user confirmation is preserved. |
| **Subscriptions and a payment provider** | Monetization is outside the selected core implementation sequence. | Pricing and paid capabilities are defined. |
| **Full workout coaching, wearables and a production web app** | These expand the current mobile nutrition scope. | Pilot evidence and explicit product prioritization justify them. |

---

## 6. Known gaps, grounded in repository evidence

These are implementation gaps or observable code behaviors. They are not reports
of verified production incidents.

| Gap | Evidence | Required next step |
|---|---|---|
| **React Native foundation is local-demo only** | `apps/mobile` contains Expo Router screens, local storage and domain tests. | Prove native Firebase integration, signed builds and physical-device behavior on both platforms. |
| **Real Firebase configuration is missing in this checkout** | `lib/firebase_options.dart` throws `UnimplementedError`; demo mode bypasses initialization. | Configure and verify the intended environments. This does not prove whether a cloud project exists elsewhere. |
| **App Check enforcement has no matching Flutter initialization** | `functions/index.js` enforces it; `pubspec.yaml` has no App Check dependency and `lib/main.dart` does not initialize it. | Wire and test the chosen mobile providers; keep debug configuration out of release builds. |
| **Whole-day saves can overwrite concurrent changes** | `FirestoreCheckinRepository.saveDay` calls `.set(log.toMap())` without a base revision. | Introduce entry-level mutations, receipts and conflict handling; plan compatibility with old writers. |
| **Rules do not enforce server ownership of canonical fields** | `firestore.rules` allows owner reads and writes across the entire user subtree. | Use path-specific rules and deny client writes to summaries, receipts and protected job state. Admin handlers must authorize independently. |
| **Nutrition validation loses uncertainty and provenance** | `validate.js` defaults missing macros to zero, can replace calories with macro-derived values, and reconstructs a limited item schema. | Add nullable nutrients, source/conversion metadata and a versioned calculation policy. |
| **USDA matching and volume conversion are too coarse for the proposed contract** | `usda.js` requests one search result; `GRAMS_PER_UNIT` applies fixed mass equivalents to volume units; enrichment only runs when both calories and protein are nonpositive. | Verify candidate suitability, use food-specific serving bases, and evaluate partial missing-data handling. |
| **AI cost controls are incomplete** | Existing parser has input limits, timeouts and a global instance cap, but no per-user quota or request deduplication. | Add durable usage checks and analysis receipts before opening paid provider access to a pilot. |
| **Photo infrastructure is absent** | Current functions export text parsing and deletion; `firebase.json` has no Storage rules configuration. | Implement private uploads, validated jobs and retention cleanup before enabling photo UI. |
| **Deletion is a sequential operation, not a durable workflow** | `deleteAccount` recursively deletes Firestore data, then deletes Auth; no deletion marker or retry job is present. | Prevent concurrent writes and late jobs, handle partial failure, and include storage as it is added. |
| **Documentation contains superseded statements** | The original PRD recommends Flutter; README's legacy section says Vercel points at the old prototype, but `vercel.json` invokes the root demo build script. | Present the React Native plan and this file as the current technical direction; reconcile older documents as a separate update. |

---

## 7. How to verify and maintain this document

| Claim | Verification |
|---|---|
| Which platform is selected | Read the opening and technology table of `REACT-NATIVE-BUILD-PLAN.md`; compare with the actual client manifests. |
| Which backend/runtime exists | Inspect `functions/package.json`, its lockfile and `functions/index.js`. Declared versions and installed/deployed versions are different evidence. |
| Which Gemini model is configured by default | Inspect `functions/src/gemini.js`; verify deployed overrides separately without printing secrets. |
| What the parser really guarantees | Inspect `parseMeal.js`, `validate.js`, `usda.js` and their tests; use a separate quality evaluation for food accuracy. |
| Whether the new sync policy works | Once implemented, test duplicate requests, app termination while offline, two-device conflicts and delayed sync across a date boundary. |
| Whether user isolation holds | Run cross-user emulator tests, then verify privileged handlers and Storage rules for each new path. |
| Whether demo hosting serves the current root app | Inspect `vercel.json`, `firebase.json` and `scripts/build-web-demo.sh`; do not infer a live deployment from configuration files. |
| Whether photo cleanup and deletion work | Once implemented, inject failures and late job completion; inspect remaining records and objects after retry. |

Existing backend verification commands, to run from the repository root when
validating backend changes:

```bash
npm --prefix functions test
npm --prefix functions run test:rules
```

The rules suite requires the Firebase emulator toolchain and Java. These commands
cover the existing backend, not the proposed React Native client. Establish
TypeScript checks, linting, domain/component tests and iOS/Android development
build checks in the new client's package scripts when it is created. Verify
critical flows on both platforms. Flutter tooling and tests are not release
requirements for the new app. Do not reuse README test counts as fresh evidence.

**Before implementing the new stack, settle:** audience/geography, login methods,
photo release scope, data regions, usage budget, nutrition/target policy, package
versions, schema-validation library, queue mechanism, local encryption setup and
release ownership. The core logging architecture can guide implementation while
those choices are recorded explicitly.

When a decision changes, update its status, rationale, trade-off, revisit
condition and evidence date. Mark a proposed component as implemented only after
linking its code and relevant verification. Update the implementation plan when
the change affects delivery dependencies.
