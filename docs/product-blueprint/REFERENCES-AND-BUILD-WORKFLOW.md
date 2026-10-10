# Nourish product references and development workflow

Research date: September 30 2026. This supplements the [React Native build plan](REACT-NATIVE-BUILD-PLAN.md). The user requested Superpowers skills and other apps as references. Platform remains React Native with Expo for iPhone and Android.

## What was reviewed

Reviewed the published Superpowers skill files, official MyFitnessPal and Cronometer help articles, Cal AI's product website, and Expo's app-building tutorial. These are source-based product and engineering references. No competitor account was created and no hands-on competitor app test was performed. Their private backend architecture, model choice, prompt design and training data are not established by this research.

The Superpowers plugin was found in the plugin directory as available but not installed. Its published skills were read directly for this planning update. No plugin hooks, telemetry, global settings or agent configuration were installed or changed. Source collection: [obra/superpowers](https://github.com/obra/superpowers).

## 1 Product patterns and our decisions

| Reference | Published behavior | Proposed Nourish application | Where it lands |
| --- | --- | --- | --- |
| RF01 MyFitnessPal Meal Scan | Users select suggested foods, adjust servings and can add a missed food before logging. [Source](https://support.myfitnesspal.com/hc/en-us/articles/360045761612-How-to-use-the-Meal-Scanner) | Make food review mandatory after analysis. Keep “Add missing food” and portion editing available on the same review screen. | P3.4, P5.4, P6.5 |
| RF02 MyFitnessPal saved meals | Template edits and deletion do not change previously logged diary entries. [Source](https://support.myfitnesspal.com/hc/en-us/articles/360032623811-Edit-or-delete-your-Saved-Meals) | Maintain separate template and intake snapshots. Test that editing tomorrow's usual breakfast leaves yesterday's log unchanged. | P3.3, P4.1 |
| RF03 Cal AI | Its website presents photo, barcode and description-based logging with calorie and macro information. [Source](https://www.calai.app/) | Give users a clear Add meal entry point with manual, text and photo choices. Keep barcode in the later roadmap rather than silently adding it to the beta. | P1.4, P5, P6, Phase 9 |
| RF04 Cronometer photo logging | Its help flow supports reviewing matches, changing portions, replacing/removing foods, adding missed foods and creating a reusable meal or recipe. [Source](https://support.cronometer.com/hc/en-us/articles/39013533811092-Mobile-Photo-Logging) | Use one editable food list for manual, text and photo drafts. Offer “Save as usual meal” separately from confirming intake; full recipes remain later scope. | P3.4, P6.5–P6.6 |
| RF05 Cronometer repeating foods | Scheduled foods can be presented for daily logging, and recurrences can be paused. [Source](https://support.cronometer.com/hc/en-us/articles/16510562495764-Mobile-Set-Repeating-Foods) | Reinforces routine check-ins requiring a user action. Keep weekdays/recurrence controls as a later usability experiment; the first version can use usual meals every day. | P4.1; later research |
| RF06 Expo tutorial | The official example teaches TypeScript, tab navigation, image selection, modals and platform differences, with linked source code. [Source](https://docs.expo.dev/tutorial/introduction/) | Use official implementation patterns for the app shell and image selection; add our own data, privacy and recovery requirements. | P1.1–P1.5, P6.1 |

The rightmost columns are our design decisions, not claims that competitors use our implementation. These references validate several features already in the plan; they do not imply those patterns are unique to Nourish. Our hypothesis remains that a routine-first home screen reduces repeated daily work. Validate it with users.

Cal AI's public accuracy and depth-sensor statements are marketing claims, not benchmarks or device requirements we can adopt. Nourish will use its own evaluation set and make uncertainty visible. No competitor's logo, branded copy, screenshots or proprietary code is included in our product assets.

## 2 How the references change the screens

**Today:** put “Check in” on each usual meal and provide one visible Add meal control. The add sheet offers Manual, Describe and Photo when available. An unavailable photo feature should explain its state or be hidden by the release flag; avoid a dead button. The hypothesis is that users can find a different-meal entry path without searching Profile or My Plan.

**Meal review:** keep a thumbnail for photo drafts, food name, source, quantity/unit and item nutrients together. Each row offers Edit, Replace and Remove with accessible tap controls. Place Add missing food beneath the list. Show the current estimate and incomplete-data notice above Confirm. A small Undo action for removing an item is our proposed recovery enhancement.

**Portion editor:** expose the selected serving basis. Changing 100 g to 150 g scales from that basis, not from the previously displayed total. Invalid or unsupported conversions preserve the last valid draft and show a specific error.

**Capture:** give brief lighting/framing guidance, a preview, Retake and Use photo. Replacing a photo after reviewing foods requires confirmation before discarding corrections. Cancelling replacement preserves the current draft. This is our draft-preservation policy; it is not an assertion about competitor behavior.

**My Plan:** edit future routine templates with explicit wording. Keep Log this meal and Save as usual meal as separate actions. Editing a template must not alter a historical record.

**History:** show confirmed entries and coverage, with estimates labeled. Reusing a past meal creates a new dated entry rather than moving the old one; consider that shortcut after the core beta unless research makes it essential.

**Onboarding:** request only what is needed for the first useful meal. Use the first confirmed meal as the activation milestone. This is our proposed design, not a verified reconstruction of any competitor's current onboarding or paywall.

## 3 Superpowers practices applied

Use the published skills as development references, adapted to the user's current request to refine the plan. The plugin has not been activated and this is not a claim that its full execution workflow has run.

| Skill read | Practice we will use | Concrete output |
| --- | --- | --- |
| [Writing plans](https://github.com/obra/superpowers/blob/main/skills/writing-plans/SKILL.md) | Break a feature into testable tasks with exact files, interfaces, checks and expected results. Self-review against the specification. | A focused implementation plan before each subsystem is built |
| [Test-driven development](https://github.com/obra/superpowers/blob/main/skills/test-driven-development/SKILL.md) | For substantive behavior, demonstrate a failing test, implement the behavior, then verify and refactor. | Regression protection for nutrition, confirmation and sync logic |
| [Verification before completion](https://github.com/obra/superpowers/blob/main/skills/verification-before-completion/SKILL.md) | Make completion claims from fresh evidence, distinguishing tests, builds and device checks. | Phase evidence record with commands, outcomes and limitations |
| [Using Superpowers](https://github.com/obra/superpowers/blob/main/skills/using-superpowers/SKILL.md) | Select relevant skills before the associated work and state which is being applied. | Visible skill choice at implementation time |

Do not turn the entire product into one enormous coding task. Keep the existing phase roadmap, then write executable plans for the shell, account setup, meal editor, logging/sync, text analysis, photo analysis and data controls when their prerequisites are settled. Planning references alone do not authorize deployment, account changes or purchases.

## 4 Repeatable feature workflow

1. State one user outcome and the acceptance examples that prove it.
2. Identify exact source/test files and the module's input/output contracts.
3. Cover the meaningful failure case alongside the normal path.
4. For behavior changes, run a focused failing test before implementation; distinguish an assertion failure from a broken test environment.
5. Implement a small working slice, then run its checks and affected integration suite. Use visual/device review for layout and native capabilities.
6. Review against the requirement and check persistence, ownership, accessibility and recovery where relevant.
7. Record evidence and unresolved defects. Mark the task verified only when its acceptance examples pass.

Configuration-only and documentation changes use appropriate validation rather than artificial tests mirroring their contents. Existing user changes must be preserved. A task commit, when made, should include only the intended change.

## 5 Example task card for the meal editor

**ID:** P3.4a. **User outcome:** changing a quantity updates an estimate predictably while preserving unknown nutrition. **Depends on:** Phase 1 test harness and P3.1's food schema. **Status:** proposed; no implementation or test run yet.

**Proposed file boundaries**

- `apps/mobile/src/domain/nutrition/scaleNutrients.ts`: deterministic nutrition scaling with no network or UI.
- `apps/mobile/src/domain/nutrition/scaleNutrients.test.ts`: arithmetic, invalid input and unknown-value cases.
- `apps/mobile/src/features/meal-review/QuantityEditor.tsx`: quantity input, units and validation feedback.
- `apps/mobile/src/features/meal-review/QuantityEditor.test.tsx`: user-visible edit behavior.

**Contract:** `scaleNutrients(basis: NutritionBasis, quantity: number): Nutrients`. `Nutrients` contains `kcal`, `proteinG`, `carbsG` and `fatG`, each `number | null`. `NutritionBasis` contains a finite positive `quantity` and `nutrients: Nutrients`; its values refer to that basis amount. The caller must use the same unit or a previously validated conversion. Requested quantity must be finite and greater than zero; invalid inputs throw `RangeError`. No display rounding occurs in this function. Domain types belong in P3.1's shared schema, not duplicate component definitions.

**Acceptance fixtures**

- A 100 g basis with 200 kcal and 10 g protein becomes 300 kcal and 15 g protein at 150 g.
- Revising 150 g to 50 g from the same basis gives 100 kcal and 5 g protein; it does not scale the prior result twice.
- A null fat value remains null after scaling. A known zero stays zero.
- Negative, zero, infinite or NaN quantities fail validation and never replace the last valid UI draft.
- A user cancelling the editor leaves the original meal unchanged. No edit to this draft mutates its saved source template or past logs.

**Execution checklist**

- [ ] Define the schema and fixtures in the prerequisite task; add the arithmetic/unknown-value assertions.
- [ ] Run the focused test and confirm it fails because the behavior is missing.
- [ ] Implement the function and run those assertions again.
- [ ] Add component assertions for visible totals, invalid input and Cancel; implement the editor.
- [ ] Run the affected suite and type check; record exact commands and results.
- [ ] Test numeric input, keyboard dismissal and larger text on both platforms.

The implementation plan must supply runnable commands from the actual Phase 1 package scripts. This card intentionally does not claim that a mobile test runner already exists.

## 6 Evidence to collect at the phase gate

| Check | Evidence | Failure blocks |
| --- | --- | --- |
| Functional acceptance | Scenario, input, expected result, observed result | The affected feature |
| Automated verification | Exact command, exit result, relevant failures, code revision | Completion claims covered by that check |
| Native behavior | Device/OS, build ID, steps and result | The affected platform release |
| Visual/accessibility | Screens and scaling/screen-reader scenarios | The affected user flow |
| AI quality | Versioned evaluation set, model/prompt version and measured results | AI release flag |
| Data integrity | Retry, restart, conflict and cross-account results | External beta |

Recommended usability scenarios: find Photo from Today; add a missed sauce; correct a portion; cancel a photo replacement without losing edits; distinguish a saved meal from yesterday's intake. Record completion, assistance required and elapsed time. Set performance targets from a baseline rather than inventing competitor timings.

## 7 Scope and handoff

The phase sequence remains unchanged. This research adds a reference walkthrough, clearer entry/review behavior and evidence requirements. It does not move barcode, subscriptions, full recipes or wearable integrations into the beta.

The next design revision should show the Add meal sheet, the complete correction controls, Undo, photo-replacement confirmation and loading/error states. These additions are specified here and in the roadmap; the Figma file has not been edited in this update.

Review the official references again before implementation if their product behavior affects a decision. Their versions, subscription packaging and screenshots may change. Keep our design system and working name distinct while learning from the interaction patterns.
