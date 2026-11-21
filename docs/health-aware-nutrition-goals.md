# Health-aware nutrition goals

Aligned with *Nutrient Estimate Calculation and Testing Guide v1.0*. This is a
product and engineering description, not clinical validation. Formulas, the
condition map and all user-facing medical wording need sign-off from a
registered dietitian or clinician before release.

## Layers (all pure, client-side, no logging of health answers)

| Layer | File | Responsibility |
| --- | --- | --- |
| Calculation engine | `domain/targets.ts` | 2023 DRI adult EER equations, goal adjustment, macros. Knows nothing about health. |
| Health context | `domain/health-context.ts` | Nutrient-impact map: each condition marks a nutrient `UNAFFECTED`, `CONDITION_SENSITIVE` or `CLINICIAN_DEFINED`. Holds no numbers. |
| Composition | `domain/nutrition-goal.ts` | Combines the two, fails closed, returns one of five statuses. Never returns null. |
| Wording | `domain/health-copy.ts` | All disclaimer, notice and reason text. |
| Display | `HealthGoalCard`, `TargetSummary` | Presents the result; calculates nothing. |

## Calculation (`DRI_EER_2023_v1`)

- Adults 19+. Inputs: exact age, calorie equation (Female/Male), height, weight, activity.
- Maintenance = DRI EER equation for the sex and activity category (Mostly sitting = inactive, Lightly = low active, Moderately = active, Very = very active, "Varies" = low active, flagged `ACTIVITY_UNCERTAIN`).
- Goal: pace converted at 7700 kcal/kg, clamped to ±15% of maintenance (`GOAL_CAPPED`). BMI below 18.5, or any clinician-defined nutrient, forces maintenance.
- Macros from unrounded energy: protein 18%, carbs 52%, fat 30%, fibre 14 g per 1000 kcal. Displayed macros reconcile to kcal within max(10 kcal, 1%).

## Statuses

`GENERAL_ESTIMATE`, `CONDITION_SENSITIVE`, `CLINICIAN_DEFINED`, `INSUFFICIENT_DATA`, `OUT_OF_SCOPE`.

- Missing exact age or equation set gives `INSUFFICIENT_DATA` and, where bounded, a kcal **range** (not a target).
- Under 19, pregnancy and breastfeeding give `OUT_OF_SCOPE` with no numbers.
- Kidney-related condition: protein is `CLINICIAN_DEFINED`. The general protein number stays visible and flagged. It is replaced only when the user has already stored a clinician value with its source; expired values are ignored. Dialysis status only changes the explanation. Protein is never averaged or invented. Because protein is clinician-defined, the weight-change adjustment is turned off and maintenance calories are shown.
- Diabetes: carbohydrates are flagged. The gram target is not reduced.
- Liver, hypertension, heart, thyroid and other: the guide names no calorie or macro formula, so the general estimate is kept and labelled as not medically personalised.
- Two rules that classify the same nutrient differently are a conflict (`CONDITION_RULE_CONFLICT`). No averaged number is produced.

## Onboarding changes

- Exact age question (the age range remains a fallback and is derived from exact age).
- "Sex" relabelled as the calorie equation set; activity options document their mapping.
- Health section (still skippable): one multi-select question. Pregnancy, breastfeeding and dietary-restriction questions are not shown. Dialysis and clinician protein remain in stored data for people who already saved them, and are not asked again.
- Home dashboard shows a "Health & medical information" row with the goal status.

## Storage and privacy

Health answers live on the device (`AppState.health`). Cloud backup (`mobileHealthProfiles/{uid}`) is opt-in; rules validate every field including `kidneyDialysis`, `lifeStage` and clinician `source`/`reviewBy`. Account deletion removes it. Health answers are never logged or sent to analytics.

## Known deviations and limitations

- Existing users who only saved an age range now see `INSUFFICIENT_DATA` and a range until they add an exact age (guide requires exact age).
- The guide treats the health section as required; it is kept skippable, and skipping is labelled as a general estimate.
- The ±15% goal clamp and macro policy need dietitian approval.
- Sodium, potassium, phosphorus and fluid are not tracked. Hypertension and heart conditions therefore do not change a number.
- The guide says to hide protein when dialysis status is unknown. This release still shows the general protein estimate, flagged, because a safe replacement number cannot be calculated. It is not described as a kidney diet.
- Liver disease has no named nutrient formula in the guide, so protein is not reduced.
- Firestore rules tests (`npm run test:profiles`) need the Firebase emulator (Java 21+) and were not run in the authoring environment.
