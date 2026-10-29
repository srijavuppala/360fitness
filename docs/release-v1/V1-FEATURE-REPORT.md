# 360 Fitness — Version 1 feature report and go/no-go decisions

**Status:** DRAFT for review. Not committed. Prepared October 24, 2026.

**Basis:** (1) the project tracker `365_Fitness_Project_Tracker (1).xlsx` (13 sheets, 3 hidden), and (2) a read-only pass over this repository's code. Older "Nourish" product-blueprint material was deliberately **not** used.

**This report is a code and planning audit.** No tests, builds, emulators or devices were run. "Implemented" means the code for the flow exists in this repository. It does not mean the flow works on a phone or against live Firebase.

---

## 1. Decision labels

| Label | Meaning |
| --- | --- |
| **GO** | Code exists and matches the tracker's definition. Only the normal release gates in section 7 remain. |
| **CONDITIONAL GO** | Code exists but is partial, or has a named open condition (a reported bug, a missing field, or configuration that is not yet verified). |
| **NO-GO** | Needed for V1 under the working scope below, but not present in the code. |
| **UNSCOPED** | Appears in the tracker without enough detail to decide. A product decision is needed first. |
| **DEFERRED** | Outside the working V1 scope. |

---

## 2. Working definition of V1 (assumption, needs confirmation)

The tracker never defines "Version 1". Its hidden `Weekly Actions` sheet lists "What enters MVP vs future?" as an unresolved decision (Week 4). Every tracker status is "Not Started", "Draft" or "To Design". This report therefore assumes V1 is:

- Project Plan phase **"2. MVP"** (rows 12–15).
- Project Plan phase **"1. Foundation"** (rows 5–11).
- Onboarding Survey rows **not** marked Future (rows 2–17).
- AI Notification steps **1–8** (rows 2–9).
- Product Modules tagged **MVP**: Meal Planner, Progress Tracker, AI Notification Assistant.

**Excluded:** phases 3–5 (Project Plan rows 16–27) and everything marked Future.

### Open decisions that change the go/no-go outcome

1. **Whole-day AI check-in:** is it required in V1 (`Project Plan r15`, the "Core near-term prototype"), or is manual tracking acceptable? If manual is acceptable, features 4.1, 4.2, 4.4 and 4.6–4.12 move from NO-GO to DEFERRED.
2. **Sleep, water, caffeine** (`AI Notification r11–r13`): these have titles only. They stay UNSCOPED until someone defines them.
3. **Workout tracking:** is `Project Plan r13` (Workout Criteria) in V1 without AI workout generation? The `AI Workout / Training` module itself is tagged "Discovery".
4. **Implemented extras** (section 6): do they count toward V1 or stay a bonus?
5. **Final product name:** the tracker says "365 Fitness", the app says "360° Fitness AI" (`apps/mobile/app.json`).

---

## 3. Modules

From `Product Modules r5–r11` and the Product Architecture layers (`r17–r22`).

| # | Module | Tracker phase tag | In V1? |
| --- | --- | --- | --- |
| 0 | Customer Layer (Onboarding Survey, Customer Categories, Customized View) | Project Plan "1. Foundation" | Yes |
| 1 | Meal Planner (including Food criteria) | MVP / Discovery | Yes |
| 2 | AI Workout / Training | Discovery / High Priority | Workout tracking only (`Project Plan r13`) |
| 3 | Progress Tracker | Foundation / MVP | Yes |
| 4 | AI Notification Assistant | MVP / High Priority | Yes |
| 5 | Grocery Budgeting | Discovery / Future | No |
| 6 | Workout Camera | Discovery / Future | No |
| 7 | Smart Weighing Scale | Discovery / Future | No |

---

## 4. Feature report by module

Citations are `path:line` for code and `Sheet rN` for the tracker.

### Module 0 — Customer Layer

| ID | Feature | Tracker | Code status and evidence | Decision |
| --- | --- | --- | --- | --- |
| 0.1 | Onboarding survey | `Project Plan r5`, `Onboarding Survey r2–r17` | **Implemented.** All 16 non-Future questions are in `profileSteps` (`apps/mobile/src/domain/profile.ts:153-320`), with drafts and validation. Firestore rules mirror the schema (`firestore.rules:~24-48`). The optional `groceryBudget` and `wearables` Future questions are also captured. Differences from the tracker: the body metric is required in the tracker but can be skipped with "Prefer not to share" (`profile.ts:~342`), and the metric choices include waist (`profile.ts:~13`). | **GO** |
| 0.2 | Customer categories C01–C05 | `Project Plan r6`, `Customer Categories r2–r6` | **Not implemented.** The only classifier is `Goal` = habits / nutrition / fitness (`apps/mobile/src/domain/meals.ts:33`, `profile.ts:329-333`), which is three labels, not five. It is only displayed (`apps/mobile/src/app/(tabs)/profile.tsx:88-91`). The tracker also lists category approval as an open decision (`Weekly Actions r2`). | **NO-GO** |
| 0.3 | Customized view per category | `Project Plan r7`, `Customized View r2–r6` | **Not implemented.** Today, History, Plan and Profile do not change by goal or category. | **NO-GO** |

### Module 1 — Meal Planner and food tracking

| ID | Feature | Tracker | Code status and evidence | Decision |
| --- | --- | --- | --- | --- |
| 1.1 | Food criteria (meals, ingredients, portions, calories, protein, carbs, fiber) | `Project Plan r12` | **Partial.** Meals, foods, portions, kcal, protein, carbs and fat are implemented (`meals.ts:11-16`, `nutrientKeys` at `meals.ts:44`). **Fiber is not in the nutrient model**; it appears only as a barcode display value (`apps/mobile/src/app/scan.tsx:361`). | **CONDITIONAL GO** (add fiber or drop it from the V1 criteria) |
| 1.2 | Manual meal logging (confirm, skip, edit) | `Project Plan r12`, `AI Notification r4` | **Implemented.** `recordMeal` saves one entry per meal per date (`meals.ts:137-162`). The editor is `apps/mobile/src/app/meal.tsx`. Saves are queued and persisted before the UI updates (`apps/mobile/src/data/store.tsx:58-70`). User feedback items U05 ("We don't have the log") and U06 (logged meals not shown on Today) are reported as P0 bugs and are not yet reproduced (`docs/USER-FEEDBACK-BACKLOG.md`). | **CONDITIONAL GO** (resolve U05/U06 on a device) |
| 1.3 | Usual meals (editable templates) | `Product Modules r5` ("recipes; portions") | **Implemented.** Templates live in `AppState.templates` and are edited in `apps/mobile/src/app/(tabs)/plan.tsx:45-57`. Three static sample meals ship by default (`apps/mobile/src/domain/fixtures.ts`). | **GO** |
| 1.4 | Meal prep (recipes, week view, grocery quantities, prep steps) | `Product Modules r5` | **Implemented, not personalized.** Six starter recipes, breakfast and lunch only (`apps/mobile/src/domain/prep-recipes.ts:22-106`). Week view and an aggregated grocery list (`apps/mobile/src/domain/meal-prep.ts:33-42`, `groceryList` ~181). Step guide (`advancePrepStep`). Logging one portion is an explicit action (`logPrepPortion`). Optional AI recipe through `analyzeMealPrepCallable` using diet and allergy answers (`apps/mobile/src/components/PrepComposer.tsx:118-160`). The grocery list shows quantities only, with no prices. | **CONDITIONAL GO** (cloud AI needs deployment and device validation) |
| 1.5 | Personalized meal plan from goals, time, budget | `Product Modules r5` | **Not implemented.** No plan generation exists. The profile hint says the survey "does not set a calorie target" (`profile.ts:~176`). | **NO-GO** |

### Module 2 — Workout tracking (part of AI Workout / Training)

| ID | Feature | Tracker | Code status and evidence | Decision |
| --- | --- | --- | --- | --- |
| 2.1 | Workout criteria (type, duration, intensity, completion) | `Project Plan r13` | **Not implemented.** Only preference answers `workouts` and `workoutFrequency` are stored (`profile.ts:77-96`). No workout log exists in mobile or web. | **NO-GO** |

### Module 3 — Progress Tracker

| ID | Feature | Tracker | Code status and evidence | Decision |
| --- | --- | --- | --- | --- |
| 3.1 | Food history (7/30 days, calories and protein) | `Project Plan r11` (food part) | **Implemented.** `historyDays` and `averageLogged` (`apps/mobile/src/domain/analytics.ts`). The screen is `apps/mobile/src/app/(tabs)/history.tsx:24-28`. Missing days are not counted as zero. | **GO** |
| 3.2 | Unified daily progress (food, workout, lifestyle) | `Project Plan r11` | **Not implemented.** Today and History show food only (`apps/mobile/src/app/(tabs)/today.tsx:92-99`). | **NO-GO** |
| 3.3 | Progress against individual goals | `Project Plan r14` | **Not implemented.** The baseline measurement is stored once with no history. There is no goal comparison or weight trend. | **NO-GO** |

### Module 4 — AI Notification Assistant

| ID | Feature | Tracker | Code status and evidence | Decision |
| --- | --- | --- | --- | --- |
| 4.1 | Daily notification trigger | `Project Plan r8`, `AI Notification r2` | **Not implemented.** `notifications` and `checkInTime` are stored (`profile.ts:~283-299`), but the hint says saving "does not schedule a reminder". `expo-notifications` is not in `apps/mobile/package.json`, `app.json` or `app.config.ts`. | **NO-GO** |
| 4.2 | Session start from the notification | `AI Notification r3` | **Not implemented.** There is no session record or route. | **NO-GO** |
| 4.3 | Voice dictation into text fields | `Project Plan r9` (partial) | **Implemented, narrow.** One utterance per field: `continuous: false`, `en-US`, 60-second cap, audio not saved (`apps/mobile/src/services/speech-session.ts:147-153`). Used only in `apps/mobile/src/app/preferences.tsx:432` and `PrepComposer.tsx:444`, not in meal logging. Needs a signed native build. User item U07 (Dictate opens the keyboard) is unreproduced. | **CONDITIONAL GO** |
| 4.4 | Conversational voice assistant (about 5 minutes) | `Project Plan r9`, `r15` | **Not implemented.** No questions, turns or follow-ups exist. | **NO-GO** |
| 4.5 | Food step of the check-in | `AI Notification r4` | **Partial.** Manual entry, barcode, label photo, meal photo and estimate import exist (`apps/mobile/src/app/add.tsx`), but there is no conversation or AI follow-up. | **CONDITIONAL GO** (as manual logging only) |
| 4.6 | Workout step | `AI Notification r5` | **Not implemented.** | **NO-GO** |
| 4.7 | Lifestyle step | `AI Notification r6` | **Not implemented.** | **NO-GO** |
| 4.8 | Exceptions (reason for a missed goal) | `AI Notification r7` | **Partial at best.** A meal can be skipped (`status: "skipped"`, `meals.ts:28`), but no reason or pattern is captured. | **NO-GO** |
| 4.9 | Whole-day summary and correction | `AI Notification r8` | **Not implemented.** Confirmation is per meal only. `AppState` has no day-level record (`meals.ts:34-42`). | **NO-GO** |
| 4.10 | Progress update after check-in | `AI Notification r9` | **Not implemented.** Only the food history above exists. | **NO-GO** |
| 4.11 | Tracker data capture (daily schema) | `Project Plan r10` | **Not implemented.** No daily-record type, storage or validation. | **NO-GO** |
| 4.12 | End-to-end daily 5-minute check-in prototype | `Project Plan r15` | **Not implemented.** None of the chain exists. | **NO-GO** |

### Unscoped items

| ID | Feature | Tracker | Code status | Decision |
| --- | --- | --- | --- | --- |
| U.1 | Sleep monitoring | `AI Notification r11` | No capture in mobile or web. | **UNSCOPED** |
| U.2 | Water intake | `AI Notification r12` | Mobile: none. Web only: water entries and a target (`apps/web/src/lib/model.ts:36-52`, `apps/web/src/pages/Dashboard.tsx`). | **UNSCOPED** |
| U.3 | Caffeine intake | `AI Notification r13` | No capture in mobile or web. | **UNSCOPED** |

---

## 5. Decision summary

Out of 24 scoped features: **3 GO, 5 CONDITIONAL GO, 16 NO-GO.** 3 more are UNSCOPED.

- **GO (3):** 0.1 Onboarding survey, 1.3 Usual meals, 3.1 Food history.
- **CONDITIONAL GO (5):** 1.1 Food criteria (fiber), 1.2 Manual logging (U05/U06), 1.4 Meal prep, 4.3 Voice dictation, 4.5 Food step as manual logging.
- **NO-GO (16):** 0.2, 0.3, 1.5, 2.1, 3.2, 3.3, 4.1, 4.2, 4.4, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12.

**Overall verdict under the working scope: NO-GO for the tracker's V1.** The meal-logging foundation is largely present, but the tracker's core V1 (personalization, daily tracking across food, workout and lifestyle, and the AI check-in) is not.

If the open decisions in section 2 resolve to "manual tracking only; no whole-day AI check-in", then 4.1, 4.2, 4.4 and 4.6–4.12 (10 features) become DEFERRED. The remaining NO-GO items would be 0.2, 0.3, 1.5, 2.1, 3.2 and 3.3. That is still not a go.

---

## 6. Implemented but not in the tracker

These exist in the code but are not tracker requirements. Count them toward V1 only if you decide to.

| Feature | Evidence | Condition |
| --- | --- | --- |
| Barcode scan (Open Food Facts) | `apps/mobile/src/app/scan.tsx`, `apps/mobile/src/domain/product-scan.ts` | Native camera behavior not device-tested (`apps/mobile/qa/VERIFICATION.md`) |
| Label photo AI | `apps/mobile/src/app/label.tsx`, `analyzeLabelCallable` (`functions/index.js:45`) | Needs deployed functions, App Check and a server Gemini key; none verified |
| Meal photo AI | `apps/mobile/src/app/meal-photo.tsx`, `analyzeMealPhotoCallable` (`functions/index.js:46`), optional AI Logic route (`apps/mobile/src/services/photo-meal.ts:11-34`) | Same as above. The AI Logic route bypasses this repository's quota counters. |
| Meal-estimate JSON import | `apps/mobile/src/app/analyze.tsx` | Works without configuration |
| Email accounts, profile and prep cloud backup | `apps/mobile/src/app/account.tsx`, `firestore.rules:~60-88` | Needs Firebase configuration |
| Web companion | `apps/web/src` | Separate app. It has its own targets and water tracking (`model.ts:36-44`). |
| Local data export and reset | `apps/mobile/src/app/(tabs)/profile.tsx` | None |

---

## 7. Release gates (apply to every GO or CONDITIONAL GO feature)

1. **Device verification.** No signed phone build or physical-device test is recorded (`apps/mobile/qa/VERIFICATION.md`). This applies to voice, camera and SQLite.
2. **P0 user bugs.** U04 (separate users), U05 (missing log), U06 (Today shows logged meals) and U07 (Dictate keyboard) in `docs/USER-FEEDBACK-BACKLOG.md`.
3. **Data isolation.** Local state is one SQLite record shared by all accounts (`apps/mobile/src/data/storage.ts`). Signing out keeps the previous user's meals.
4. **Firebase environment.** The checked-in `.firebaserc` points to project `fitness-1e108`. The target, App Check, deployed functions and the Gemini secret all need confirmation.
5. **Dependency audit.** `apps/mobile/qa/VERIFICATION.md` records 28 affected packages (18 high) as of October 7. Triage is pending.
6. **CI.** The workflows exist (`.github/workflows/mobile.yml`, `web.yml`). The docs note they had not yet run on GitHub at the time of writing, and test counts in the docs are historical.
7. **Legacy rules.** `firestore.rules:12-19` keeps a broad `users/{uid}/**` owner rule. New V1 collections must not inherit it.

---

## 8. Architecture diagram notes

The supplied architecture diagram matches the code for the callable names, mobile services and web pages. It should be updated to:

- Add the optional Firebase AI Logic meal-photo route.
- Add the `analysisUsage/{uid}` collection (server-written quota counters).
- Show that `parseMealCallable` has a web client only (`apps/web/src/lib/cloud.ts:83`) and none in mobile.
- Note that Firebase plugins are included in the app build only when `EXPO_PUBLIC_LABEL_AI_ENABLED` is `"true"` (`apps/mobile/app.config.ts:4-5`).
- Eventually add the V1 pieces that are missing today: notification scheduler, check-in session, daily record, category and view logic, workout capture.

---

## 9. Not verified and housekeeping

**Not verified**

- Behavior on a device and any live Firebase or AI setup.
- Test results. I did not run any test suite.
- `scan.tsx`, `label.tsx`, `meal-photo.tsx` and the web pages were read only in part.

**Housekeeping**

- Residual "Nourish" naming remains in `apps/mobile/src/domain/fixtures.ts` ("Tofu & rice nourish bowl"), `functions/package.json` (`nourish-functions`, `demo-nourish`) and `docs/product-blueprint/Nourish-PRD.md`. It was not used in this report and has not been changed.
- Existing docs disagree on test counts (README, `FEATURE-COVERAGE-AUDIT.md` and the QA files give different numbers on different dates). Re-measure before quoting any.
- The tracker's `Customer Categories` sheet contains unexplained notes at rows 8–12 ("TESTING THE MVP", "SUGESTIVE POV_ CHECKIN FEATURE", "GIT HUB", "SYSTEM SETUP", "INPUT|Allergens|Food Directory"). They were not scoped.

## 10. Recommended next steps

1. Answer the five open decisions in section 2, then update the labels in section 4.
2. Reproduce U05, U06 and U07 on a signed phone build.
3. Decide whether V1 ships without the AI check-in. That one decision moves 10 features.
4. Re-run the local checks on a clean install and record the real numbers (`npm run check` in `apps/mobile` and `apps/web`, `npm test` in `functions`).
