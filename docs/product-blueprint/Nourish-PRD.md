# Nourish product requirements

Version 0.1 • September 30 2026 • Proposed scope for client review

Nourish helps adults record what they eat with less repeated work. Users describe their usual meals once, then confirm or adjust those meals each day. The first release should prove that this routine is useful and easy to maintain. Photo-assisted logging can then help with meals that differ from the routine.

This document defines the proposed product, user experience, release scope, requirements, architecture, delivery plan, and decisions needed before implementation. Existing Flutter and Firebase code provides a starting point. Product assumptions and target metrics below are proposals for validation, not established customer research or measured performance.

## 1 Product direction

**Primary user:** an adult who wants everyday nutrition awareness or support for a fitness routine, but finds detailed food entry repetitive. Initial design assumes English, mobile use, and iPhone and Android. Launch geography, commercial model, and final audience remain open decisions.

**Job to be done:** “When I eat roughly the same meals, help me record what actually happened quickly, and make it easy to correct the days that are different.”

**Value proposition:** reuse familiar meals, offer clear corrections, and explain nutrition estimates. Keep a usual meal plan separate from actual intake. Never record a planned meal as eaten without confirmation.

**Differentiation hypothesis:** routine-based check-ins can reduce daily effort compared with entering every food again. Photo capture supports exceptions. This is a hypothesis to test, not a claim of superiority over MyFitnessPal or Cal AI.

**Product principles**

- The user confirms every meal before it counts toward intake.
- Nutrition is an estimate with an identifiable source and editable portions.
- Missing data is neutral. A missed day is not zero intake or failure.
- The main screen gives one obvious next action.
- Users can choose habits without a calorie target; this is a proposed addition to the current target-based implementation.
- Keep controls for privacy, reminders, and units easy to find.

**Out of scope for the first release:** medical treatment, disease-specific diets, automatic allergy clearance, minor accounts, social feeds, full workout programming, coach accounts, wearables, meal delivery, and automatic calorie changes based on exercise.

## 2 Current foundation and gaps

This inventory is based on repository inspection. It does not establish production readiness. Existing tests and deployment claims in README were not rerun for this documentation task.

| Area | Evidence in the repository | Work still required |
| --- | --- | --- |
| Client | Flutter, Riverpod, go_router, Material 3; Today, My Plan, History, Profile | Review layouts on physical iPhone and Android devices; accessibility and release validation |
| Onboarding | Quiz, conversational meal entry, confirmation cards, target calculator | Shorter optional-target route, resumable drafts, validated target policy |
| Logging | Usual meals, portions, daily check-in; water and workout fields | Explicit sync states, conflict handling, stable operation IDs, regression checks |
| Backend | Auth, Firestore repositories, authenticated App Check callable functions | Verify real cloud configuration, environments, quotas, operational monitoring |
| AI | Text parsing through Gemini, response validation, USDA enrichment | Source provenance, quality benchmark, model-version policy; no image endpoint identified |
| Privacy | User-scoped rules and recursive account deletion function | Export flow, deletion retries, full dependency inventory and photo retention |
| Demo | Local persistence and a local food parser | Keep demo and real environments visually distinct |

Several application and test files had local changes when reviewed. These were preserved. The existing code names, routes, and models informed this plan; no application implementation was changed for the design exercise.

## 3 User architecture and navigation

The app has four persistent destinations. Logging is a focused task launched from Today, rather than a fifth destination competing for attention.

| Destination | User question | Primary action |
| --- | --- | --- |
| Today | What have I recorded and what remains? | Check in or log a different meal |
| My Plan | What do I usually eat? | Add, edit, reorder or remove a usual meal |
| History | What patterns can I see? | Inspect a date or weekly summary |
| Profile | How do I control my experience? | Change goals, reminders, units and data settings |

**First use:** welcome → sign-in or clearly labeled demo → age eligibility and preferences → optional targets → describe a usual meal → review foods and portions → save routine → first daily check-in. Ask camera and reminder permissions only when the relevant feature is used.

**Routine day:** open Today or reminder → select an unconfirmed meal → choose usual portion, change portion, skip, or replace → review changes → save → show confirmation and updated daily totals. Back navigation keeps a draft; cancellation does not change intake.

**Different meal:** choose text/manual entry in the MVP; later choose photo → review proposed foods → correct quantities, missing ingredients and sauces → save once → optionally save as a usual meal using a separate control.

**Returning after a gap:** show today and a neutral welcome. Do not insert missed meals or backfill empty days. Past-day editing must explicitly identify the date.

**Recovery paths:** denied camera → text entry; unclear food → clarification; offline → saved-meal check-in and local draft; model timeout → retry or manual entry; save conflict → compare versions; interrupted onboarding → resume the last confirmed step.

## 4 Feature scope and prioritization

P0 is required before a public pilot. P1 extends a stable core. P2 requires separate demand and commercial validation. “Existing” means code is present, not that the feature passed the release gates in this document.

| ID | Capability | Priority | Starting point |
| --- | --- | --- | --- |
| FR01 | Account access and resumable onboarding | P0 | Partial foundation |
| FR02 | Goals, preferences, units and optional targets | P0 | Target-based foundation |
| FR03 | Text and manual meal entry with confirmation | P0 | Text foundation; manual fallback to complete |
| FR04 | Reusable meal plan and portion editing | P0 | Existing foundation |
| FR05 | Daily check-in with skip, change and replace | P0 | Existing foundation to validate |
| FR06 | Today totals and data completeness labels | P0 | Existing foundation |
| FR07 | History and clearly defined consistency | P0 | Existing foundation |
| FR08 | Optional reminders and deep links | P0 | Mobile foundation; web no-op |
| FR09 | Offline draft, sync and conflict recovery | P0 | Cache and local demo; policy incomplete |
| FR10 | Privacy settings, export and account deletion | P0 | Deletion foundation; export proposed |
| FR11 | Accessibility, telemetry and support route | P0 | Partial foundation |
| FR12 | Photo-assisted meal logging | P1 | New work |
| FR13 | Barcode search and recent-food shortcuts | P1 | New work; provider coverage to evaluate |
| FR14 | Recipes, richer trends and optional weight history | P1 | New work |
| FR15 | Subscriptions and entitlements | P1 | Only after pricing research |
| FR16 | Wearable connections and coach portal | P2 | Separate permission and data model work |

Water and a lightweight activity check-in can remain secondary features because fields already exist. They should not delay reliable food logging. Activity must not automatically increase a calorie budget in the pilot.

## 5 MVP acceptance criteria

**FR01 Account and onboarding.** A new eligible user can authenticate, leave onboarding, and resume after restarting. Failed sign-in displays a retry path. Required inputs are explained. A completed setup must have at least one confirmed usual meal or explicitly choose manual-only logging. Demo data must not appear as a live account.

**FR02 Preferences and targets.** Units convert without changing the underlying stored measurement. Preferences can be changed later. Targets require explicit review and a versioned calculation policy validated before launch; declining targets still permits logging. Preferences describe what a person avoids and must not be presented as an allergy safety check.

**FR03 Entry and estimate review.** The existing text endpoint accepts at most 500 characters. Multiple pending descriptions cannot silently overwrite an unconfirmed meal. A response with missing food or ambiguous quantities asks for clarification and preserves valid items. Nothing contributes to a day until confirmed. Manual entry remains available when AI is unavailable.

**FR04 Usual meals.** Users can edit names, items, quantities, units and meal slot. Changes update future check-ins. Past logged meals retain their original item snapshots. Removing a plan item does not delete history. Saving as a usual meal is a separate action from logging intake.

**FR05 Daily check-in.** Usual, changed, skipped and replaced states are supported. Skipped has zero included items; unconfirmed is missing data. A partial portion scales nutrition exactly once. Repeating a save or retrying after a timeout creates one logical update. Editing a day does not overwrite unrelated meals. Tap controls provide all swipe actions.

**FR06 Today.** Totals sum only confirmed food snapshots, with internal precision retained until display. Show calories and protein first, with optional expanded macros. Planned values are visually distinct. Targets, if enabled, do not imply permission or prohibition to eat. Every save has saving, pending sync, saved or failed feedback.

**FR07 History.** Day selection shows the original date and target snapshot when applicable. Weekly averages divide by logged days, with coverage displayed. A “day checked in” means at least one confirmed meal action; a skipped meal is an action but not proof of complete intake. A separate “complete day” requires the user to confirm the day is finished. Both definitions must remain visible in analytics specifications.

**FR08 Reminders.** Permission denial does not block use. Users control reminder times and can disable them. Taps open the correct date and task after cold start. Tests cover time-zone changes, daylight-saving transitions and schedule cancellation at logout or deletion. Web must not imply a reminder was scheduled when unsupported.

**FR09 Sync.** Previously loaded plans can be checked in offline. Unsent work is visible and survives restart on supported mobile devices. AI needs connectivity and cannot be disguised as an offline result. Two-device edits to the same meal surface a conflict instead of silently replacing confirmed intake.

**FR10 Data controls.** Users can request an export of profile, targets, plans and logs. Account deletion requires confirmation, clears local data and cancels reminders. The server removes all user data and associated storage objects with a retryable job. The UI reports completion only after the required deletion work succeeds; document separately any backup retention policy agreed for launch.

**FR11 Quality and support.** All core tasks work with a screen reader, larger text and tap input. Errors include a usable recovery action. Support receives an error reference rather than raw meal text or photos by default. Crash and product-event collection follow the selected consent policy.

## 6 Photo logging extension

The photo flow is shown in the concept to explain the future experience. It is not present in the inspected text-parser endpoint and is not a prerequisite for the proposed core pilot.

**FR12 Capture and review.** Let the user take or select a photo; provide a manual alternative when permission is declined. Preview and allow removal before upload. Proposed upload limits are JPEG or PNG, up to 10 MB before processing, with client compression and server verification. Format support and limits must be tested on target devices before being treated as final.

**Processing sequence:** authenticated upload request → short-lived private object → image and request validation → model identifies likely foods → nutrition lookup and quantity assumptions → schema validation → user review → confirmed log. Image processing is allowed only for the authenticated owner's object.

**Required review states:** clear meal; uncertain portion; missing dressing or oil; mixed dish; multiple dishes; unreadable image; non-food image; timeout; quota reached; network lost. Never claim an image can determine exact calories, allergens, hidden ingredients or food safety. Display “estimated portion” and ask a concrete question when needed; do not show an invented accuracy percentage.

**Nutrition provenance:** keep provider, food identifier if matched, basis quantity and unit, serving conversion, estimated or matched status, model version, and user corrections. Curated food records should take precedence when an appropriate serving conversion exists. A 4/4/9 macro check may flag inconsistency; it should not silently overwrite authoritative nutrition data because energy calculations and rounding can differ.

**Evaluation gate:** build a consented, representative set of at least 100 meals spanning intended cuisines, mixed dishes, portion sizes, lighting and food restrictions. Nutrition values require an appropriate measured or documented reference. Report food identification, correction frequency, severe errors, latency and cost. Set launch thresholds with the product owner after reviewing the baseline; structured JSON alone is not proof of nutrition accuracy.

**Proposed retention:** delete raw uploaded photos within 24 hours after processing, including failed requests, unless the user explicitly elects to retain meal photos. Review provider retention and training settings before launch. Do not assume application deletion controls third-party retention.

## 7 Visual framework and screen contract

The proposed visual direction keeps the existing green calorie identity and purple protein identity. Warm off-white surfaces, rounded meal cards, restrained typography and food photography give the experience a calm, approachable tone. The name Nourish is the repository's working name; branding clearance is a separate decision.

| Token | Proposed value | Use |
| --- | --- | --- |
| Primary green | #2E7D57 | Main actions and calorie identity |
| Protein purple | #5B6ABF | Protein charts and secondary nutrition cues |
| Ink | #19362B | Main text and emphasis cards |
| Background | #F7F8F2 | Main light surface |
| Soft green | #E5EEDF | Supporting panels and selected states |
| Typeface | Roboto in concept | Material-aligned typography; platform behavior to validate |
| Spacing | 8 point base, 24 px screen inset | Consistent rhythm |
| Controls | 52 px primary button, 48 px minimum tap area | Thumb and accessibility support |
| Corners | 20 px cards, 16 px buttons | Reusable component shape |

**Frame inventory:** welcome; onboarding goal; usual breakfast setup; My Plan; Today; dinner check-in; photo capture concept; estimate review; History; Profile; save confirmation; dinner portion adjustment. Primary artboards are 390 by 844. These are representative mobile concepts, not an exhaustive implementation specification.

**Prototype scope:** links demonstrate setup, daily check-in, photo review and navigation. Inputs, permissions, authentication, persistence and nutrition calculation are simulated. Some preference rows are visual only. A sample save acknowledgement returns to a fixed Today screen rather than calculating a new total. The implementation must support the real states described in this PRD.

**Additional design states before build:** sign-in failure, empty routine, empty history, interactive quantity editor, text correction, loading, offline pending, sync conflict, denied camera, photo error, export, deletion confirmation, dark theme, keyboard-open and enlarged text. Core body text should be 16 px where possible; small helper text in concepts must be validated at accessible scaling. Target WCAG AA contrast and native screen-reader behavior, with no color-only meaning.

## 8 Technical architecture

**Recommendation:** evolve the existing Flutter and Firebase application. Keeping the current stack avoids an unnecessary rewrite and lets the team focus on validating the daily habit loop. Final hosting region and providers depend on the selected launch market and data requirements.

**Client layer.** Flutter renders feature modules, Riverpod manages application state, and go_router owns navigation and authentication redirects. Repositories separate UI from local demo and Firestore implementations. Add an explicit draft/outbox abstraction, sync status, dependency-injected clocks and a nutrition provenance model. Keep the demo parser for demonstrations only.

**Identity and access.** Firebase Auth establishes user identity; backend operations authorize using the verified identity, never a caller-supplied UID. App Check helps establish app authenticity but does not replace authorization or abuse controls. Firestore and Storage rules enforce owner access and validate allowed fields. Production release must test unauthenticated access and cross-account access attempts.

**Application services.** Existing Node Cloud Functions perform text parsing and account deletion. Extend with versioned analysis, export and deletion-job endpoints. Enforce payload limits, per-user quotas, concurrency caps, deadlines and redacted error handling. Secrets stay server-side. Use separate development, staging and production projects.

**Data layer.** Firestore stores profiles, usual meals and daily records. Current whole-day writes should evolve to stable meal entries and an idempotent mutation service before multi-device launch. Cloud Storage is proposed for temporary photo objects. A server-side summary per day can keep calendar reads bounded.

**AI boundary.** A provider adapter accepts text or a permitted image reference, returns a constrained schema, and records model and prompt versions. Validation checks types, units, finite non-negative values and serving conversions. A nutrition lookup adapter supports USDA initially, subject to intended cuisine coverage. A model outage leaves manual logging usable.

**Operations.** Capture reliability, latency, quota and per-analysis cost signals without raw meal content in telemetry. Configure budget alerts and a photo feature flag. Test rollback of both client configuration and provider versions. Push notifications, subscriptions and health-platform integrations are separate additions, not assumed present.

## 9 Data model and consistency

The current model stores nutrition for the entire quantity of an item. Retain that convention and document it: six eggs carry the nutrition for six eggs, not one egg. Portion changes scale from a canonical snapshot once. Keep conversion basis separate from total nutrition to prevent double multiplication.

| Entity | Important fields | Ownership and lifecycle |
| --- | --- | --- |
| User profile | uid, preferences, units, time zone, consent version | Private to the user |
| Target version | optional goals, effective date, policy version | Preserve old versions for history |
| Plan meal | stable ID, slot, label, items, version | Reusable template; independently editable |
| Day | local date, time zone snapshot, coverage, totals | Summary derived from confirmed entries |
| Meal entry | ID, day, plan version, status, item snapshots | Actual intake; independent of future plan edits |
| Meal item | food, quantity, unit, nutrition totals, source | Validated units and provenance |
| Mutation receipt | operation ID, base revision, result revision | Deduplicates retries |
| Analysis request | request ID, status, model, temporary object path | Short-lived processing metadata |
| Deletion job | user, state, step, retries, completion time | Idempotent cleanup workflow |

**Proposed paths:** users/{uid}/profile/main; users/{uid}/targets/{version}; users/{uid}/planMeals/{id}; users/{uid}/days/{localDate}; users/{uid}/days/{localDate}/entries/{entryId}; users/{uid}/operations/{operationId}; users/{uid}/analysis/{requestId}. These are a proposed schema evolution, not a claim about all existing paths.

**Write policy:** the client assigns a stable operation ID and base revision, writes its local outbox, then submits when online. The authenticated server transaction checks the receipt and revision, stores the entry, and updates the day summary. Repeated operations return the prior result. Conflicting revisions return a recoverable conflict; the user compares and chooses. Direct client writes to server-owned summaries are denied. The offline UI displays provisional local totals until confirmed.

**Time policy:** store the meal timestamp, intended local day and IANA time zone. Crossing midnight or travelling must not silently move existing entries. Explicit past-day edits use the selected day. Day and summary must be updated atomically for a meal move.

**Migration:** retain a schemaVersion; map existing whole-day meal arrays to stable entries; preserve original snapshots and totals; validate equivalence on representative data before enabling the new writer. Back up and stage the migration; do not run it as part of design approval.

## 10 Service contracts and failures

The inspected endpoint is parseMealCallable with text and slot. The following versioned contracts are proposed extensions. Every endpoint authenticates, authorizes owner access and validates request sizes before expensive work.

| Service | Request essentials | Response essentials |
| --- | --- | --- |
| Analyze meal | requestId, text OR owned image reference, slot, locale | candidate items, source metadata, clarification, analysis version |
| Confirm meal mutation | operationId, entryId, day, baseRevision, item snapshots | applied revision and summary, or conflict payload |
| Export account | operationId and requested format | queued job, then short-lived owner-only download |
| Delete account | recent authentication and confirmed request | deletion job ID and status; completed only after cleanup |

**State machine for analysis:** draft → submitting → analyzing → review required → confirmed; cancel, failed and expired are distinct exits. Analysis completion never writes intake on its own. A stale response cannot replace a newer request. Identical repeated requests should reuse a result where appropriate and not repeatedly charge providers.

**State machine for save:** local draft → pending sync → accepted; conflict and retryable failure are explicit branches. A saved label requires server acknowledgement. Offline work is labeled “Saved on this device” or “Waiting to sync.”

**Timeouts and limits:** proposed UI feedback within one second of starting; offer a manual fallback after 15 seconds of analysis and stop automatic waiting after 30 seconds. Backend/provider deadlines may differ, but late results must not overwrite newer work. Retry transient errors with bounded backoff and the same operation ID; do not retry invalid input or permission errors automatically.

**Nutrition mismatch handling:** retain the original provider data, flag the mismatch and request correction when significant. Never silently fabricate a source match or serving conversion. Ambiguous dishes can remain user-entered estimates with that label.

## 11 Privacy reliability and accessibility

These are product requirements for launch review, not a claim of legal compliance or an approved security assessment.

**Data minimization.** Collect only the profile inputs needed for features the user selects. Request camera permission at capture and notification permission at reminder setup. Do not send names, email, or unnecessary profile data to the meal model. Keep nutrition and profile data out of advertising payloads. Telemetry must exclude raw meal text, images, body measurements and food avoidance notes.

**Controls.** Define export format, raw-photo retention, provider retention, backups and support access before public launch. Test sign-out and account switching for cache isolation. Owner checks apply to photo uploads and downloads as well as Firestore. Deletion must include Storage, analysis records, exports, local drafts, reminders and authentication, with a policy for backups.

**Proposed performance objectives.** Cached Today content visible within two seconds on a representative mid-range device; local check-in feedback within 300 ms; 95th percentile text analysis within ten seconds under tested network conditions; at least 99.5 percent crash-free pilot sessions. These are targets to benchmark, not guarantees.

**Accessibility.** Test VoiceOver and TalkBack for the full primary flow. Support larger text without clipped totals or buttons, logical focus order, meaningful field labels and reduced motion. Provide tap alternatives to swipe, keyboard support in the web demo and labels for nutrition colors. Validate contrast rather than assuming a palette is compliant.

**Abuse and support.** Enforce quotas server-side, monitor repeated analysis failures and provide a way to report a wrong estimate. Use a request reference to investigate failures. Scope support access and log administrative access if a support console is introduced.

## 12 Measurement and product validation

**North-star candidate:** weekly users who complete meaningful food logging on at least four distinct local days. Define meaningful as at least one confirmed, non-skipped meal; track complete-day coverage separately. Do not reward the app for users eating less or hitting a calorie number.

| Metric | Definition | Proposed pilot decision signal |
| --- | --- | --- |
| Activation | First confirmed routine or manual meal plus first daily log | At least 70 percent of recruited test users |
| Routine check-in time | Open check-in to save acknowledgement, excluding background time | Median at most 20 seconds for a usual meal |
| Day 7 retention | Activated users logging again on local day 7 | Establish baseline; provisional aim 30 percent |
| Usability completion | Representative users completing the core scenario without help | At least 4 of 5 in formative testing |
| Estimate correction | Analyses requiring food or portion edits | Measure by cuisine and input type; no invented accuracy target |
| Reliability | Successful saves, duplicates, conflicts and crash-free sessions | No unresolved data-loss defect before pilot |

**Events:** onboarding_started, onboarding_completed, routine_saved, checkin_started, meal_confirmed, meal_skipped, portion_changed, analysis_started, analysis_failed, estimate_corrected, sync_conflict, export_requested and deletion_completed. Use pseudonymous identity where needed, operation IDs for deduplication, source and app version. Exclude sensitive payloads and raw content.

**Research plan:** interview five to eight intended users about current logging, repeated meals, cuisine and trust in estimates. Run five moderated concept sessions. Give two scenarios: set up breakfast and record a changed dinner. Ask users to explain planned versus logged meals and identify where to correct an estimate. Follow with a small two-week pilot to test repeated use. The sample sizes support formative learning, not population-level conclusions.

## 13 Delivery plan and release gates

The sequence below is an illustrative planning range for one designer, one Flutter engineer, backend support and shared QA. It is not a fixed quote or delivery promise. Confirm team capacity and existing-code readiness before scheduling.

| Phase | Indicative duration | Exit evidence |
| --- | --- | --- |
| Discovery and scope | 1 week | Audience, launch market, MVP and success measures agreed |
| Detailed UX and validation | 1 to 2 weeks | Prototype tested; core and failure states approved |
| Core product and backend hardening | 3 to 5 weeks | Real auth, logging, sync, export and deletion work in staging |
| Pilot readiness | 1 to 2 weeks | Device QA, accessibility, security tests, support and metrics ready |
| Controlled pilot | 2 weeks | Retention, usability and reliability reviewed |
| Photo extension | 2 to 4 weeks after core gate | Evaluation set, privacy policy, cost limits and review UX pass |

Phases can overlap only when dependencies are clear. Photo work should not obscure whether the repeated-meal workflow is valuable. Prices, AI unit costs and a subscription price are intentionally uncommitted until usage and market assumptions are known.

**Build order:** lock domain definitions → finish confirmation and draft behavior → implement reliable writes and date handling → connect real environments → complete data controls → accessibility and device testing → measure pilot → add photo analysis.

**Required verification:** unit tests for portion scaling, nutrition provenance and day calculations; widget tests for confirmation and recovery; backend tests for schemas, quotas, idempotency and deletion retry; rules tests for cross-user access; end-to-end tests for onboarding, offline restart/reconnect, conflicting device edits, midnight/travel, notification cold start, export and deletion. Test app and provider outages deliberately.

**Release gate:** no known critical data-loss or cross-account access issue; all P0 acceptance criteria met; manual logging usable during AI failure; estimates visibly identified; analytics definitions agreed; support and rollback available; real iPhone and Android flows verified. Store submission requirements must be checked for the chosen release configuration at that time.

## 14 Client review and decisions

**Review the concept in this order:** welcome and goal → usual breakfast → My Plan → Today → dinner check-in → optional photo and estimate review → History → Profile. Use the Figma prototype start points for setup, daily logging and photo logging. The figures use illustrative sample nutrition and do not represent an individual dietary recommendation.

**Decisions to record**

- Product owner: confirm first audience, launch country, minimum age and supported language.
- Client and designer: confirm the Nourish working name, visual direction, tone and information hierarchy.
- Product owner: decide whether photo logging is needed for the first commercial release or can follow the core pilot.
- Product owner and engineering: confirm mobile platforms, account methods and whether web is demo-only.
- Nutrition reviewer and product owner: approve target policy, estimate wording and supported use cases.
- Engineering and operations: confirm providers, deployment region, data retention, budget and support ownership.
- Commercial owner: choose pilot funding, pricing research and any subscription hypothesis.

**Approval record:** audience ___; MVP scope ___; platform ___; visual direction ___; photo phase ___; budget ___; decision owner ___; date ___. Unfilled fields are open decisions, not approvals.

**Client feedback prompts:** Can you explain what the app does in one sentence? Is the next action clear? Does the distinction between a usual meal and a logged meal make sense? Is correcting an estimate easy to find? Which one missing capability would prevent the intended user from returning?

## 15 Sources and implementation notes

Repository sources reviewed: README.md; pubspec.yaml; lib/core/theme.dart and router.dart; lib/features/onboarding/models/profile.dart; lib/features/plan/models/meal_item.dart; lib/features/checkin/models/day_log.dart and data/checkin_repository.dart; functions/index.js and functions/src/parseMeal.js. README status counts are historical claims and are not repeated as fresh verification here.

**Firestore offline behavior.** Firestore provides offline caching and synchronization, and conflicting changes to the same document use last-write-wins behavior. This motivates the proposed explicit operation and revision policy; that policy is our architecture recommendation. Source: https://firebase.google.com/docs/firestore/manage-data/enable-offline

**Nutrition data.** FoodData Central provides a documented API for food search and food details. Suitability for the selected cuisine mix, serving conversions and operational limits needs evaluation. Source: https://fdc.nal.usda.gov/api-guide/

**Model output.** Gemini supports image input and schema-constrained output. Those capabilities enable a candidate-food pipeline but do not establish nutrition accuracy. Sources: https://ai.google.dev/gemini-api/docs/image-understanding and https://ai.google.dev/gemini-api/docs/structured-output

**Visual asset.** The salad photograph already present in the repository is attributed in legacy/web-prototype/ASSETS.md to https://images.unsplash.com/photo-1512621776951-a57141f2eefd. It is illustrative, not a measured meal or a model output. Final commercial asset selection and attribution should be recorded at handoff.

**Design file:** https://www.figma.com/design/AgLTy2m3smHrStrdOhBSuq
