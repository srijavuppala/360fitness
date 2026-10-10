# Fitness app product discovery

Living document. Updated October 9, 2026. Working product name: **360° Fitness AI**. Earlier documents use **Nourish**; neither name has been cleared or finalized here.

## Recommended direction

Build a phone app that helps adults plan familiar meals, prepare useful portions and check in on what they actually ate with less repeated entry. Use AI to assist with unfamiliar foods and labels. Keep the first release centered on this repeatable routine.

**Working audience hypothesis:** busy adults who want more consistent eating habits and find detailed tracking repetitive. English-language use is the initial design assumption. Launch geography, age policy, accessibility needs and final audience require confirmation. No customer interviews or demand validation have been completed in this discovery pass.

**Proposed positioning:** “Your usual meals, a simpler routine.” The promise is lower effort and useful preparation guidance. Avoid promises of exact photo calories, guaranteed health outcomes or allergy safety.

## The completed discovery framework

Owners below are proposed responsibilities, not staffing commitments. **Draft** means a recommendation; **implemented locally** means code exists with development evidence; **needs validation** means the acceptance test has not been completed. Nothing in this plan is marked commercially validated. The companion workbook expands this table into 27 editable work items with status choices and research sources.

| Discovery Area | Question to Answer | Requirement | Research / Validation | Decision / Output | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Branding | How should it be positioned? | Name, promise, visual identity and voice | Test message comprehension; shortlist names; check stores, domains, handles and naming conflicts | Routine meal-planning companion; retain working name until checks and founder decision | Founder + design | Draft |
| Customer | Who is the product for? | A narrow first audience and actual behavior evidence | 8 interviews about recent planning/logging behavior; compare busy adults, gym-goers and students | Initial busy-adult hypothesis with specific needs and switching barriers | Founder + research | Draft |
| User Experience | What problem does it solve? | One complete plan/prep/check-in journey | 5 observed usability sessions on physical phones, including correction and offline paths | Short focused screens; familiar meals; explicit eaten-portion confirmation | Design + mobile | Implemented locally; user testing open |
| Data | What inputs are required? | Minimal profile, portions, ingredients, intake, source and consent | Map each field to a feature; test labels and market-specific barcode coverage | Separate preferences, planned batches and actual intake; preserve unknown values | Product + backend | Draft; foundations implemented |
| Technology | How can we build it? | Maintainable app, database, secure AI boundary and release workflow | Inspect current layers; connect dev Firebase; test installed builds and two-device conflicts | React Native/Expo, SQLite, Firebase and server-side Gemini; reviewed GitHub PRs | Mobile + backend | Local foundation; cloud setup required |
| AI | Where does AI add value? | Label extraction, meal drafts and recipe breakdown with human correction | Held-out labeled examples; accuracy by task, correction burden, latency and cost | Assistance with editable outputs; manual fallback; no automatic intake | AI + QA | Local integration; quality evaluation open |
| Integration | What does it connect to? | Firebase, Gemini, product database and native permissions | End-to-end device checks; evaluate provider coverage and native build requirements | Core integrations first; wearables and grocery delivery later | Backend + mobile | Needs setup and device validation |
| Validation | How do we know it works? | Activation, repeat use, usability and reliability gates | Observe 5 users, then a 12-person two-week pilot after release checks | Predefined success measures below; record outcomes before expanding scope | Research + QA | Not started with real customers |
| Market | Can it stand alone? | Recurring value, clear package and sustainable costs | Compare established products; test switching reason and willingness to pay after use | Standalone concept is plausible; differentiation and business model remain hypotheses | Founder + product | Desk research started |

## What the market evidence changes

| Reference | What its official page supports | Implication for us |
| --- | --- | --- |
| [MyFitnessPal](https://support.myfitnesspal.com/hc/en-us/articles/34889191368077-The-difference-between-Free-Premium-and-Premium) | Its tiers include logging, scanning and meal-planning/prep/grocery features. | Combining these features is already established. We need a measurable improvement for a specific audience. |
| [Cal AI](https://www.calai.app/) | It markets meal-photo calorie and macro logging. | Photo analysis alone is not a distinctive proposition. Treat its accuracy language as vendor claims, not benchmark results. |
| [Eat This Much](https://www.eatthismuch.com/pricing) | It offers weekly planning, grocery lists and leftovers support. | Batch prep and grocery generation also overlap. Familiar-meal reuse and correction effort are useful comparison tasks. |

**Inference to test:** our app may appeal to people who value routine and quick corrections more than a large recipe catalog or detailed daily data entry. These vendor pages establish category overlap, not proof that our workflow is better. No market-size estimate, willingness-to-pay result or competitor user study has been produced.

## Brand brief to test

- **Personality:** calm, practical, encouraging and transparent about uncertainty.
- **Visual starting point:** current cream `#F6F7F2`, forest `#426337`, dark text `#243126`; restrained cards, readable type and native navigation.
- **Voice:** “Adjust your portion,” “Save this for next time,” and “Nutrition estimate—review before logging.” Avoid guilt, food morality labels and perfect-diet language.
- **Name criteria:** easy to pronounce and recall, suitable for meal routines, distinctive in the category, and usable in the chosen launch markets. A broad “fitness” name may create expectations of workout programming we do not currently satisfy; test that association.
- **Decision process:** shortlist 3–5 names, test recall and expected product with participants, check app stores/domain/social availability, then complete appropriate naming clearance before selecting one. No availability or clearance is claimed in this document.

## Customer research we can run next

Recruit eight adults across the three candidate groups, with most from the initial busy-adult hypothesis. Include both phone platforms and people who stopped using a food tracker. Recruitment is proposed; no messages have been sent.

Use a 25-minute interview before showing the app:

1. Walk me through the last time you decided what to eat for the next few days.
2. What did you actually prepare, buy and eat? What changed?
3. Show how you recorded a repeated meal, if you did. Which step took effort?
4. When did you last stop using a food or planning app, and why?
5. Which foods, cuisines, restrictions and household needs did existing tools miss?
6. What information would you be comfortable sharing with an AI service? What would you want to edit or remove?
7. What do you currently spend on solving this problem, if anything?

Capture recent examples, observed behavior, exact quotes with consent, current tools and contradictory evidence. Do not treat “I would use it” or onboarding selections as proof of demand. Summarize the highest-frequency problem and select the first segment before broadening development.

## Scope and primary journey

**First useful session:** minimal relevant preferences → choose/describe a familiar meal → review ingredients/servings → save one prep batch → see the shopping list.

**Repeat loop:** prepare portions with a short guide → confirm a portion only after eating → correct changes → reuse or adjust the next plan.

| Scope | Features |
| --- | --- |
| Initial pilot | Onboarding, reusable meals, local persistence, weekly batches, scaled groceries, short prep guides, explicit logging, history, account/profile/prep backup, manual fallback |
| Pilot only after its own quality/device gates | Gemini label extraction, meal-photo drafts, recipe descriptions, native speech-to-text |
| Next if demanded | More cuisines, ingredient substitutions with user review, reminder scheduling, automatic sync with explicit conflict policy |
| Defer | Wearables, smart scales, grocery delivery, coach dashboards, social feed, full workout programs and medical diet plans |

Shorter onboarding is a proposed discovery experiment. The existing questionnaire still contains more fields. Test deferring body metrics, exercise, budget and reminders until they contribute to an immediate feature. An accessible screen may scroll when text is enlarged or the keyboard is open; do not clip content to satisfy a universal no-scroll rule.

## Data requirements and system boundaries

| Record | Minimum useful data | Source and handling |
| --- | --- | --- |
| Preferences | Goal, diet, avoided foods, allergy response and chosen units; requiredness under review | User entered. Store locally first; include in cloud save only through the existing explicit flow. AI receives selected food preferences only when requested. |
| Recipe | Name, meal slot, ingredient amount/unit per serving, nutrient values or unknown, source metadata | Manual entry, product label/database or AI draft. Keep original units and raw/cooked distinction. |
| Prep batch | Recipe snapshot, date, servings, guide progress and prepared status | User action. Batch scaling affects groceries, not intake. |
| Intake | Date, confirmed portion, food snapshot, source and stable operation identity | Explicit eaten-portion confirmation. Recipe edits do not rewrite past food logs. |
| Image/voice input | Image or transcript needed for the immediate action | Explicit capture and submission. Raw media retention and provider handling need a documented policy before external use; do not claim zero retention across providers. |
| Identity and backup | UID, verified account, schema/revision/generation and timestamps | Firebase Auth and owner-scoped Firestore access. Current backups require deliberate save/restore. |
| Product metrics | Task completion, error category, duration and app version | Proposed minimal telemetry; avoid raw images, transcripts, detailed food text or health answers in analytics. Implementation and user disclosures remain open. |

**Architecture decision:** retain the React Native/Expo/TypeScript app, domain validation, SQLite phone storage and Firebase callable boundary to Gemini. The older Flutter PRD describes a previous implementation and should not determine the current stack. See [current architecture](../mobile-architecture.md), [profile](../personal-profile.md), [meal prep](../meal-prep.md) and [GitHub workflow](../github-workflow.md).

The [Expo guide](https://docs.expo.dev/guides/using-firebase/) distinguishes Firebase JS SDK support in Expo Go from native Firebase modules requiring custom builds. Our native App Check path needs a configured development/release build. [Firestore offline documentation](https://firebase.google.com/docs/firestore/manage-data/enable-offline) describes SDK-specific caching and synchronization; it does not establish that our current JS mobile repository has a durable automatic sync queue. We retain local persistence and explicit conflict-aware backup behavior until such a queue is designed and tested.

Before inviting account-based pilot users: select a Firebase project, configure separate development/production environments, deploy reviewed rules/functions, enable auth, configure App Check and test both phones. No live deployment or signed build was produced by this discovery task. The mobile app and related files are still untracked locally; the reviewed baseline must reach GitHub before it can be relied on as shared source history.

## AI evaluation plan

[Structured Gemini output](https://ai.google.dev/gemini-api/docs/structured-output) helps parsing; it is not evidence of correct nutrition. Separate three evaluations:

| Task | Test material | Measure | Proposed initial gate |
| --- | --- | --- | --- |
| Label reading | 30 consented/public-use label photos, including glare, blur, rotated and unreadable labels | Correct value AND unit AND serving basis for readable fields; omitted and invented fields separately | At least 95% field agreement on readable fields; every unreadable case offers unknown/retake/manual correction. No allergy-safe output. |
| Meal-photo drafts | 20 meals with weighed ingredients and documented package/database references, including mixed dishes | Portion and nutrient error, missed ingredients, median and worst errors, user correction time | All results are labeled estimates and editable. Set the numeric accuracy gate after baseline evaluation; a photo may not reveal oil, sauces or quantity. Do not publish accuracy claims beforehand. |
| Recipe breakdown | 20 descriptions with varied serving counts and ambiguous units | Per-serving versus whole-batch conversion, missing ingredients, unsupported substitutions | All known serving-conversion cases pass; ambiguous amounts trigger an explicit assumption or correction. |

These are proposed small benchmark sizes and acceptance targets, not measured results or statistical guarantees. Freeze a held-out subset; keep prompt tuning examples separate. Record model identifier, prompt/schema version, date, latency, retries and token usage so changes can be compared.

Keep provider credentials on the backend, use authentication/attestation, quotas and timeouts, and preserve manual entry. Measure cost per successful analysis including failed attempts and retries against [current Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing). Review model-tier data handling before sending real pilot media. [Open Food Facts API conditions](https://support.openfoodfacts.org/help/en-gb/12-donnees-api/94-y-a-t-il-des-conditions-pour-utiliser-l-api) also need review for attribution, reuse and rate limits before commercial rollout.

## Success criteria and evidence status

All customer thresholds below are proposals for a small pilot. Record counts alongside percentages and investigate the failures. They do not establish population-wide demand.

| Measure | Definition and proposed gate | Evidence now |
| --- | --- | --- |
| Usability | 4 of 5 participants create a prep batch and confirm one eaten serving without facilitator help | Not measured |
| Activation | 8 of 12 invited pilot users save their first useful meal/batch within 24 hours of first opening; report invitation-to-open separately | Not measured |
| Repeat use | 6 of those 12 users confirm intake on at least 3 distinct days during days 8–14 after first opening | Not measured |
| Effort | Median repeat-meal check-in takes no more than 30 seconds; record correction attempts and failures | Not measured |
| Trust | No task participant mistakes prepared food for eaten food; all can find the edit action on an AI estimate | Not measured |
| Reliability | Both phone platforms pass restart/offline/auth/conflict/permission/export/deletion scenarios; no unresolved critical data-loss or access-control issue | Physical-device and live-cloud validation open |
| Development checks | Tests, static checks and exports remain green after changes | Last Oct 8 run: 85 mobile tests, typecheck/lint and iOS/Android/web exports passed. Not rerun for this documentation-only task. |
| Commercial signal | Record package preference and why; run a separate paid-conversion test only after delivering repeated value | No price or payment validation |

Proposed packaging to test: free manual routines and core prep, with a paid allowance for AI convenience. Price and allowance remain undecided. Track contribution per paying user as collected revenue minus store/payment fees, AI usage, incremental cloud costs and support cost. Model both typical and heavy users. Do not assume free-tier provider costs will support a commercial product.

## Next work in dependency order

| Priority | Action | Output / completion condition | Proposed owner |
| --- | --- | --- | --- |
| 1 | Choose the initial audience and launch geography | One audience statement and recruitment criteria | Founder |
| 2 | Run discovery interviews | Eight evidence notes and the problem users repeatedly demonstrate | Founder + research |
| 3 | Choose the Firebase project and create a reviewed GitHub baseline | Explicit project configuration plan; scoped PR with passing CI and secret review | Founder + engineering |
| 4 | Test the current core journey with five users | Task timings, failure points and prioritized UX corrections | Design + QA |
| 5 | Complete device, cloud and data-control gates | Installed iPhone/Android builds; verified backup/conflict/export/deletion behavior | Engineering + QA |
| 6 | Benchmark AI separately | Held-out results, correction burden and per-analysis cost; decision on which AI tasks enter the pilot | AI + QA |
| 7 | Run a two-week invited pilot | Activation/repeat-use counts, qualitative feedback and continue/change decision | Founder + research |
| 8 | Finalize brand and commercial test | Name checks, tested message and package hypotheses informed by real use | Founder + design |

Technology setup can proceed alongside interviews. Avoid expanding integrations before the core routine shows repeat use. This document proposes work; it does not assign external staff, contact participants, register names, purchase services or claim release readiness.
