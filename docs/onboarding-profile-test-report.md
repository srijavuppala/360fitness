# Onboarding and profile test report

**Branch:** `feature/re-analysize-nutrient-goal`  
**App:** `apps/mobile`  
**Date run:** 21 November 2026  
**Command:**

```powershell
cd D:\360fitness\apps\mobile
npm test
```

`npm test` from the repository root does not run these tests. The mobile app has its own `package.json`.

## Result

**143 passed, 0 failed.**

The suite is the project’s Node test runner (`tsx --test tests/*.test.ts`). It checks the same calculation and profile functions the screens use. It does not open a browser.

## 1. Onboarding, checked against the nutrition guidelines

Onboarding collects an exact age as a whole number of years, the same kind of entry as weight. An age range is no longer a question, because a range cannot produce one calorie target. Height, current weight, target weight, activity, and Female or Male are still required. Ages under 19 cannot be saved. Missing or invalid height or weight produce no target.

Daily calories use the 2023 adult energy equations. The weight goal is then applied and capped at 15% above or below maintenance. Protein, carbohydrate, fat, and fiber are calculated from that calorie number (18% / 52% / 30%, and 14 g fiber per 1,000 kcal). The profile review shows one calorie number and four nutrient numbers.

| Check | Expected | Test |
| --- | --- | --- |
| All eight adult equations (Female and Male, four activity levels) | Match the published 2023 coefficients | DRI 2023 adult equations: every coefficient set |
| Weight-loss pace larger than 15% of maintenance | Calories capped at 15% below maintenance; macros follow 18/52/30 | a lose-weight profile is capped at 15% below maintenance |
| Displayed protein, carbs, and fat | Energy from grams stays within tolerance of the calorie label | displayed macros reconcile to displayed kcal within tolerance |
| Same profile twice | Same result | the same inputs always give the same result |
| Age band only, no exact age | No single calorie target | an exact age is required; a band alone gives a range, not a target |
| Female or Male not chosen | No single calorie target | a missing equation set gives a range spanning both sets |
| Age under 19, including 18 | Out of scope; onboarding rejects ages under 19 | under 19 is out of scope, including exactly 18 |
| Target weight equals current weight | “Maintain your weight”; calories equal maintenance | matching current and target weight is maintenance |
| Target weight above current weight | Gain; calories above maintenance | a goal weight in the other direction is a gain with a surplus |
| Current or target weight changes | Maintenance and daily calories are recalculated | changing current or target weight recalculates energy |
| Missing, zero, negative, or non-numeric height or weight | No target | missing or implausible body stats return no target |
| Guide example: female, 30 years, 155 cm, 50 kg, inactive, maintain | 1,847 kcal | guide fixture: female 30, 155 cm, 50 kg, inactive, maintain displays 1847 kcal |
| Exact age is required to save a profile | A saved age band alone is rejected; age 40 is stored with its derived band | an exact age replaces the age band and the band is derived from it |

## 2. Profile data, checked against the same guidelines

Profile answers are stored on the device. Saving health information does not overwrite age, height, or weight. Targets are recalculated when the profile is shown. They are not stored as a separate copy.

Health & medical information is optional. The user can select more than one condition. “None of the above” and “Prefer not to disclose” cannot be combined with a condition. Skipping leaves the general estimate unchanged.

Selecting a condition does not invent a disease-specific diet. The screen still shows a calorie number and four nutrient numbers.

| Selection | Expected numbers | Test |
| --- | --- | --- |
| Skip, or no health answers | Same calories and macros as the saved profile | no health answers: a general estimate; skipping health leaves the same targets |
| None of the above | Same general estimate | a user who reported no conditions keeps the general estimate |
| Prefer not to disclose | Same general estimate | prefer not to disclose keeps the general estimate |
| Diabetes only | Calories and grams unchanged. Carbohydrates are not reduced. | diabetes alone flags carbohydrates but leaves protein untouched |
| Heart, liver, thyroid, high blood pressure, or Other | Calories and grams unchanged. Labelled as a general estimate, not medical advice. | conditions without a numeric rule keep every general target |
| Kidney | Weight-loss or weight-gain adjustment is turned off. Calories become maintenance. Protein, carbs, fat, and fiber are recalculated from that energy and still shown as numbers. | kidney condition: protein shows the general estimate |
| Diabetes and kidney together | Maintenance calories. Protein and carbohydrate grams are both shown. The two rules are not averaged into a third target. | diabetes plus kidney flags both nutrients and does not average them |
| Two condition rules that disagree on the same nutrient | No third, averaged number is created | disagreeing rules are a conflict and do not invent a third number |
| Today ring | Uses the same calorie target as the profile card | the ring uses the evaluated calorie target |
| Existing profile with no health data | Still opens and still calculates | existing saved state without health still opens unchanged |
| Saving the profile after health answers exist | Health answers are kept | saving the profile keeps existing health information |

## What this report does not cover

Meal-log scrolling and suggestions, workout planning, and streak or achievement tracking are outside this work. The Today ring is calories eaten against the daily calorie target only.
