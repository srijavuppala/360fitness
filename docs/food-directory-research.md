# Food Directory: What We Have, What's Missing, How To Build It

## 1. Overview

MyFitnessPal and HealthifyMe are built around a **food catalog**. This is one big,
searchable list of foods, each with serving sizes and nutrition per 100 g. Every
way of logging (search, barcode, photo, voice, "log yesterday's lunch again")
ends up pointing at an item in that catalog. Our app works the other way round.
Each logging method creates its own one-off food with its own numbers, and
nothing is stored in a shared catalog. So we have **input methods but no food
directory**, and we can't give good suggestions because there is nothing
structured to learn from.

---

## 2. What is implemented today

### 2.1 Where food "lives"

| Place | What it holds | Problem |
|---|---|---|
| Mobile: `apps/mobile/src/domain/fixtures.ts` | 3 sample meals (oats, chickpea bowl, tofu bowl) with hand-typed numbers | Demo data only. Not a directory. |
| Mobile: SQLite table `app_state` (`src/data/storage.ts`) | The user's **entire app state as one JSON text blob**: templates (usual meals), entries (logged meals), profile, meal prep | Whole blob is rewritten on every save. Foods can't be searched, indexed or counted. |
| Web: `apps/web/src/lib/model.ts` → `foodLibrary` | **12 hard-coded foods** (oats, egg, salmon...) | The web "Food library" page is these 12 plus whatever the user has already logged. The page itself says "not a verified food database". |
| Firestore | Only `mobileProfiles/{uid}`, `mobileMealPrep/{uid}`, legacy `users/{uid}/**` and web `users/{uid}/webRecords` | **Mobile meal logs are never synced to the cloud.** There is no shared catalog collection. Web and mobile don't see each other's meals. |

### 2.2 How a food gets into a meal today

All of these end in the same editor screen (`apps/mobile/src/app/meal.tsx`),
where the user reviews and confirms.

| Path | Code | Where the numbers come from | Notes |
|---|---|---|---|
| Type it in | `components/FoodForm.tsx` | The user types name, quantity, unit and four nutrients | No search, no suggestions. Unit is free text. |
| Scan barcode | `services/product-lookup.ts`, `domain/product-scan.ts`, `app/scan.tsx` | Open Food Facts, called **directly from the phone** | Good validation (check-digit, allergens, Nutri-Score). Cache is in memory for 10 minutes and lost on restart. The product is **not saved** for next time. |
| Photograph a nutrition label | `functions/src/labelAnalysis.js` (Gemini) | AI reads the label, user checks | Good for packaged food. Not saved to a catalog. |
| Photograph a meal | `functions/src/mealPhotoAnalysis.js` (Gemini) | **Gemini guesses both the food and the calories.** The prompt tells it to estimate nutrition "using typical reference values". | The riskiest path: nutrition is the model's guess, not a database lookup. USDA is **not** used here. |
| Describe a meal (text) | `functions/src/parseMeal.js` → Gemini → `usda.js` | Gemini parses, USDA fills gaps | Callable exists and the **web** app calls it. **Mobile does not.** The mobile screen says "Automatic analysis is not connected yet" and asks the user to paste JSON from another AI (`domain/mealAnalysis.ts`). |
| Meal-prep recipes | `domain/prep-recipes.ts` | 6 starter recipes with **all nutrition left blank** (on purpose) | Honest, but gives no value for outcomes. |

### 2.3 What the USDA integration actually does (`functions/src/usda.js`)

It is much narrower than the diagram suggests:

- It takes **only the first search result** (`pageSize = 1`).
- It searches only "Foundation" and "SR Legacy" data. Branded and regional foods
  (especially Indian) are not covered.
- It runs **only when the model returned zero calories and zero protein**.
- It works **only if the user's unit is a weight or volume** (g, oz, ml, cup...).
  "2 bananas" or "1 roti" are skipped.
- It treats every cup as 240 g. That is wrong for solids (a cup of flour is not a
  cup of water).
- It marks the result `source: 'usda'`, but the mobile `Food.source` type only
  allows `sample | manual | ai | barcode`, so that provenance would be lost.
- Our own blueprint (`TECH-STACK-DECISIONS.md`, risk table) already flags this as
  "too coarse".

### 2.4 How meals are recorded (`domain/meals.ts`)

Good decisions to keep:
- A logged meal stores a **snapshot** of its foods, so editing a recipe later
  doesn't rewrite history.
- Unknown nutrition is `null`, never `0`. A dash means unknown.
- Re-saving the same meal on the same day replaces it (no double counting).
- Skipped meals are not treated as zero-calorie days.
- Every source is labelled (sample, manual, AI, barcode).
- AI can only create a draft. The user must confirm.
- Server-side quotas, App Check and strict validation exist.

Weaknesses:
- Nutrition is stored **for the whole quantity** (e.g. "150 g = 246 kcal"), not
  per 100 g. We can't re-scale to a different unit (grams to cups), and
  `scaleFood` only scales linearly from the original unit.
- A food has a random local ID (`local-xxxx`), not a stable catalog ID. Logging
  "banana" 50 times creates 50 unrelated foods, so we can't ask "what does this
  user eat most?".
- The web library merges foods by lowercase name, so different serving sizes of
  the same food overwrite each other.

### 2.5 How suggestions work today

**They don't.** What exists is:
- "Up next" on the Today tab, which is just the first of the user's saved usual
  meals that hasn't been logged yet.
- Portion buttons (0.5x, 1x, 1.5x) on the meal editor.
- AI suggestions that are **recognition** (what is in this photo), not
  **recommendation** (what should I eat).

`Profile → Preferences` text says "tailored recommendations" are future work.
There is also no calorie or macro **target engine** on mobile. The profile
collects an age band and a weight or waist value, but not height or sex, so a
daily target can't be calculated yet. The web app has manual target fields only.

### 2.6 Outcomes driven today

| Outcome | Status |
|---|---|
| Daily totals (kcal, protein, carbs, fat) | Yes, `dailyNutrition()` |
| History chart, averages over logged days | Yes, `analytics.ts` |
| Progress against a target | Not on mobile |
| "Eat more protein" or "you're short on fiber" insights | No |
| Allergy / diet warnings on logged foods | Barcode shows allergens. Nothing checks them against the user's profile. |
| Personalised suggestions | No |

---

## 3. Mapping to the architecture diagram

| Diagram box | Reality |
|---|---|
| `domain/meals`, `product-scan`, `label-entry`, `mealAnalysis` | Exist, but they are validators and converters, not a directory |
| `services/product-lookup` → Open Food Facts | Exists. Direct from the phone, in-memory cache only |
| `services/label-reader`, `meal-photo-reader`, `prep-ai` → Functions → Gemini | Exist and work |
| `F4 parseMealCallable` → Gemini → USDA | Exists, called by **web only** |
| `data/store` SQLite | One JSON blob, not relational tables |
| `Firestore mobileProfiles / mobileMealPrep` | Profile and prep backup only. **No meal log, no food catalog.** |
| (missing) | **Food Catalog**, **Food search**, **User's recent / favourite foods**, **Suggestion engine**, **Target engine** |

---

## 4. How the industry does it (general approach overview)

**MyFitnessPal**
- A very large catalog, largely built from user submissions, with some entries
  marked verified.
- Barcode scan, search-as-you-type, and shortcuts: **Recent, Frequent, My Foods,
  My Meals, My Recipes**.
- Copy a meal or whole day from a previous day. Quick-add calories.
- Every food has several **serving options** (1 cup, 1 slice, 100 g) with a
  conversion between them.

**HealthifyMe**
- A smaller, curated database focused on **Indian and regional foods** (roti,
  dal, thali), with nutritionist review.
- Multiple input methods (search, photo, voice, barcode) that all resolve to
  catalog items.
- Daily targets from the user's body stats and goal, then coaching and
  suggestions on top.

**What they share (this is the "correct approach"):**
1. One catalog, many doors. Search, barcode, photo and voice all return catalog
   items with portion options.
2. A log entry points to a catalog item plus an amount.
3. Personalisation comes from log history (recent, frequent, time of day).
4. Targets and outcomes are computed from the same log.
5. AI is used to **identify** food and **estimate portions**. The numbers come
   from the catalog wherever possible.

---

## 5. The recommended design for us

### 5.1 Three layers of food data

| Layer | What | Source | Trust |
|---|---|---|---|
| A. Core catalog | A few thousand common foods, bundled with the app | USDA FoodData Central (Foundation and SR Legacy). If the audience is in India, add an Indian composition source (e.g. IFCT) after checking its licence | High: verified |
| B. Packaged foods | Barcode products | Open Food Facts. **Save every scanned product** into the local catalog (cache-on-scan) | Medium: crowd-sourced, always show the source |
| C. User foods | Custom foods, edited foods, saved recipes and "usual meals" | The user | Personal |

A food in any layer has the same shape, so search and logging don't care where
it came from.

### 5.2 The data model (conceptual)

- **Food**: stable ID, name, brand (optional), source (usda / off / user / ai),
  verified flag, nutrition **per 100 g**, optional extras (fiber, sugar, sodium),
  allergens and diet tags.
- **Portion**: belongs to a Food. Label ("1 medium", "1 cup", "1 roti"), grams
  per portion, and a default flag. This is the missing piece behind the "cup =
  240 g" bug.
- **Log entry**: date, slot, food ID, portion, amount, **plus a snapshot of the
  calculated nutrition** (we already do this well, so keep it).
- **User food stats**: per food, last eaten, times eaten, usual slot. Powers
  recents and favourites.
- **Usual meals / recipes**: the existing templates, now built from catalog
  foods.

### 5.3 How the pieces fit

```
 Search / Barcode / Label photo / Meal photo / Voice-text
                       |
          (AI only IDENTIFIES the food and guesses the portion)
                       |
                 FOOD RESOLVER  -->  Food Catalog (A + B + C)
                       |             numbers come from here
              Review screen (user confirms grams / portion)
                       |
                    LOG ENTRY (food id + portion + snapshot)
                       |
        +--------------+----------------+
   Daily totals     Recents / Frequent   Targets and insights
```

### 5.4 Where it should run

- **On the phone:** a SQLite catalog with a full-text index (FTS5). Search is
  instant and works offline. Ship a compact core catalog plus any scanned
  products.
- **In the cloud:** a `searchFoodCallable` for the long tail (branded and
  regional) that is too big to bundle, with results cached on the phone. Keep
  the Gemini and USDA keys server-side as today.
- **Sync:** log entries and user foods go to Firestore under the user's own
  document (owner-only rules, same pattern as `mobileProfiles`). This lets web
  and mobile share one history. Store **one document per entry or per day**,
  not one giant blob.

### 5.5 Suggestions: start simple, no AI required

1. **Recent** foods (last 20).
2. **Frequent** foods, especially for the current meal slot and time of day.
3. **"Same as yesterday"** and "log my usual breakfast" (templates already exist).
4. **Smart defaults**: pre-select the portion you used last time.
5. Later: "what fits my remaining macros today", filtered by the user's allergies
   and diet from their profile (the profile data already exists).
6. Much later: AI-written recommendations on top of the above.

### 5.6 Outcomes

- Targets: compute from height, weight, age, sex, activity and goal
  (Mifflin-St Jeor, then an activity factor). **We must start collecting height
  and sex**, because the current profile can't support this. Keep it clearly
  labelled as an estimate.
- Show progress rings and remaining macros on Today.
- Weekly insights (protein average, days logged, top foods).
- Allergy and diet warnings at logging time.

---

## 6. Build order

| # | Step | Why this order | Done when |
|---|---|---|---|
| 0 | **Decide target region and licences** (US only vs India; USDA, OFF, IFCT terms) | Decides which data we seed | Written decision |
| 1 | **Define the Food, Portion and LogEntry model** and add `usda` to the allowed sources | Everything else depends on it | Types and tests added; existing snapshot and null-vs-zero behaviour kept |
| 2 | **Move mobile storage from one JSON blob to real tables** (foods, portions, entries, user stats) with a migration | Needed for search and stats | Existing users' data migrated without loss |
| 3 | **Build the seed pipeline** (script that imports USDA and others into the catalog format, versioned) | Gives search something to find | Core catalog loads in-app, offline |
| 4 | **Search screen**: type-ahead, portion picker, Recent / Frequent / My Foods tabs. Make the manual form "Create custom food" | First user-visible win | A user can log "banana" in about 3 taps |
| 5 | **Save scanned barcode products** to the catalog | Cheap; the code already exists | Second scan of the same product is instant and offline |
| 6 | **Route AI through the resolver.** Photo and text: Gemini names foods and guesses portions, then the catalog supplies the numbers. Wire mobile to `parseMealCallable`. Upgrade `usda.js`: more than one result, portion table instead of fixed unit guesses | Fixes the biggest accuracy risk | Photo-logged meals show catalog-sourced numbers, with the AI's guess only for portion |
| 7 | **Sync log and user foods to Firestore** with rules and tests; share with web; replace the web's 12-item library with the shared catalog | Unifies the product | Same history on phone and web |
| 8 | **Suggestions v1** (recent, frequent, slot-aware, "same as yesterday") | Needs history from steps 4-7 | Suggestions appear on Today and Add |
| 9 | **Targets and outcomes** (collect height and sex, compute targets, progress, allergy warnings) | Needs trustworthy logs first | Today shows remaining calories and macros |
| 10 | **Quality loop** (a test set of real meals, "report a wrong value", a verified flag, accuracy tracking) | Keeps trust as the catalog grows | Measured error rates per source |

Steps 1-4 are the foundation. Steps 5-6 fix the accuracy problems. Steps 7-9 give
the HealthifyMe or MFP feel. Step 10 keeps it trustworthy.

---

## 7. Risks and decisions for the team

- **Region.** Indian foods are poorly covered by USDA, so regional coverage
  decides the product's usefulness.
- **Catalog size on device.** Bundle a small core and fetch the rest, to avoid a
  large app download.
- **Licences.** Open Food Facts requires attribution and has reuse conditions.
  Check IFCT and any paid datasets.
- **AI accuracy.** Keep "AI proposes, human confirms, catalog calculates".
  Measure it in step 10 before claiming accuracy.
- **Migration.** Moving off the single JSON blob is the riskiest technical step.
  Do it early with a backup and a rollback.
- **Scope.** Don't build crowd-sourced editing or a coach before the catalog,
  search and sync exist.
