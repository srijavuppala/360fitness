# 360 Fitness — what exists today, major flaws, and manual tests before go-ahead

**Status:** Not Committed. Draft Version.

**Short version:** the meal-logging basics exist on both mobile and web. The two apps are very different products, and they do not share data. The mobile app has two serious gaps: meals are not separated per account, and it cannot delete an account. The AI daily check-in, notifications, workouts and categories from the project tracker do not exist yet. See `V1-FEATURE-REPORT.md` for that.

---

## 1. What exists today

### Mobile app (`apps/mobile`) — the main product

- **Setup and profile:** welcome screen, a 7-step questionnaire (age, goal, activity, diet, allergies, workouts, check-in time and more), save and resume, edit later.
- **Today screen:** calories logged so far, a ring showing how many usual meals are checked in, "Scan food", "Log a meal", and "Up next" meal.
- **Meal logging:** confirm a usual meal, change the portion, skip it, or log a different meal by hand. Unknown nutrition stays blank, not zero.
- **My Plan:** three sample usual meals you can edit, add or remove. Changing them never changes past logs.
- **Meal prep:** six starter recipes (breakfast and lunch), your own recipe, optional AI recipe, week view, grocery quantities, step-by-step guide, and a button to log one portion.
- **History:** 7-day and 30-day charts for calories and protein. Days with no log are not counted as zero.
- **Ways to add food:** barcode scan, label photo, meal photo, paste an AI estimate, or manual entry. Photo AI works only if Firebase is set up.
- **Voice:** dictation into a few text boxes (diet description, recipe description). It is not a conversation.
- **Account:** email and password sign-in, email verification, save and restore your profile and your meal-prep plan to the cloud.
- **Data:** export your data as JSON, and reset local data.

### Web app (`apps/web`) — a separate companion site

- **Home, Diary, Plan, Library, Progress, Settings** and a public landing page.
- **Meal logging:** by day (with a date picker that stops at today), by meal slot. Edit and skip.
- **Water tracking:** add 250 ml or 500 ml, undo, daily target.
- **Personal targets:** calories, protein, carbs, fat and water. A progress ring and bars show how close you are.
- **Progress:** 7, 30 and 90-day charts, average calories, meals logged and macro averages.
- **Food library:** search and filter a small set of sample foods (about a dozen, plus any you saved).
- **Describe a meal:** AI analysis (needs sign-in and configuration) or paste an estimate.
- **Backup:** export and restore as a JSON file.
- **Account:** Google sign-in, full meal sync to the cloud, delete account.

---

## 2. Web versus mobile — the differences that matter

| Area | Mobile | Web |
| --- | --- | --- |
| Sign-in | Email and password | Google only |
| Where meals are saved | Only on the phone. The cloud holds profile and prep plan only. | In the browser, or in the cloud when signed in (everything syncs) |
| Data per account | **One shared pool.** Signing out keeps the data. | **Separated.** Signing in or out swaps to that account's data. |
| Onboarding questionnaire | Yes (the tracker's foundation) | No. Only name, goal and targets in Settings. |
| Calorie and macro targets | None. The questionnaire says it does not set one. | Yes |
| Water tracking | None | Yes |
| Barcode, label photo, meal photo | Yes (photo AI needs setup) | No |
| Meal prep and groceries | Yes | No |
| Voice dictation | Yes (phone build only) | No |
| History range | 7 and 30 days | 7, 30 and 90 days |
| Delete account in the app | **No** (the server function exists, the screen does not) | Yes |
| Backup file | Export only | Export and restore |
| Describe-a-meal AI | Not connected (paste-only) | Connected when signed in and configured |
| Shared code | Both use the same meal and calorie calculation code, so the same foods give the same totals | Same |

**summary:** A meal logged on the web will not appear on the phone, and the reverse. They use different sign-in methods and store data in different places. Nothing in the app tells the user this.

---

## 3. Major flaws found

Ordered by how serious I think they are. "Evidence" shows where in the code.

**High**

1. **Mobile meals are not separated per account.**
   One local record holds everything (`apps/mobile/src/data/storage.ts`). Signing out only signs out of Firebase (`apps/mobile/src/app/account.tsx:431`). If person B signs in on the same phone, they see person A's meals. The project's own backlog lists this as a top-priority bug (U04). The web app does not have this problem.
2. **Mobile has no way to delete an account.**
   The server function exists (`functions/index.js:103`), but nothing in the mobile app calls it. The web app does. App stores generally expect in-app account deletion when accounts can be created.
3. **Mobile meals are never backed up.**
   Only the profile and prep plan go to the cloud (`firestore.rules`, `mobileProfiles` and `mobileMealPrep`). Losing or resetting the phone loses all meal history. The web app does sync meals.
4. **Three bugs users reported are not fixed or reproduced.**
   - "We don't have the log" after saving (U05).
   - Logged meals not showing on Today (U06).
   - Dictate opens the keyboard (U07).
   See `docs/USER-FEEDBACK-BACKLOG.md`. They need a real phone.
5. **Web and mobile do not share data, and the user is not told.**
   Different sign-in methods, different storage (`apps/web/src/lib/cloud.ts:49` uses `users/{uid}/webRecords`). I did not verify what happens if the same email is used for both.
6. **The tracker's core V1 is missing.**
   No notifications, no daily check-in conversation, no workout log, no customer categories, no customized view. See `V1-FEATURE-REPORT.md`.

**Medium**

7. **Questionnaire answers do nothing.**
   Goal, check-in time, notification choice, voice comfort, budget and wearables are saved but change nothing in the app (`apps/mobile/src/domain/profile.ts`). Users will expect them to work.
8. **Fiber is missing** from the nutrition model, although the tracker lists it. It shows only on scanned products.
9. **Inconsistent "checked in" counts.**
   Mobile's ring and "N checked in" count skipped meals as checked in (`apps/mobile/src/app/(tabs)/today.tsx:41-43`). The web week dots mark a day as logged when only a skipped meal exists (`apps/web/src/pages/Dashboard.tsx:~228`), while the web Progress page counts only confirmed meals. The numbers can disagree on the same screen.
10. **Broad cloud permission.**
    Any signed-in user may write unlimited data under their own area (`firestore.rules:12-19`). That is a cost and abuse risk. Web records live there.
11. **Photo AI is not usable out of the box.**
    It needs Firebase, App Check, deployed functions and a Gemini key. The Add screen still offers it. The user sees an error message only after trying (`apps/mobile/src/services/label-connection.ts:13-16`).
12. **Known security and release items from the project's own notes:**
    - 28 vulnerable packages listed on Oct 7 (`apps/mobile/qa/VERIFICATION.md`).
    - Provisional app identifier `com.fitness360.demo` (`apps/mobile/app.json`).
    - No encryption of local data (`apps/mobile/README.md`).
    - No signed phone build or device test recorded.

---

## 4. Manual test cases

Run mobile on a **real phone** (a signed development or preview build), not only the browser preview. Voice, camera and local database behave differently there. Cases marked **RISK** are ones I expect might fail, based on section 3.

### A. Start-up

| ID | Do this | Expect |
| --- | --- | --- |
| A1 | Mobile: install a fresh build and open it | Welcome screen shows. No crash. |
| A2 | Mobile browser preview: `npm run web` in `apps/mobile` | Opens on `localhost:8081`. Today screen loads. |
| A3 | Web: `npm run dev` in `apps/web` | Opens on `localhost:5173`. Landing page loads. |
| A4 | Open the app with no internet (after first load) | Local data still opens. Cloud and AI features show a clear message. |

### B. Questionnaire (mobile)

| ID | Do this | Expect |
| --- | --- | --- |
| B1 | Fill every step and finish | Review screen, then Today. Answers are saved. |
| B2 | Leave a required answer empty and press next | A clear message names the missing answer. |
| B3 | Choose diet "Other" | A text box for details appears and is required. |
| B4 | Pick "None known" for allergies, then another allergy | "None known" is removed. Picking "None known" last clears the others. |
| B5 | Enter the time as `7:30 PM`, `13:00`, `25:99` | The first is accepted. Bad times are rejected with a message. |
| B6 | Close the app halfway and reopen | You can continue where you left off. |
| B7 | Choose "Prefer not to share" for the body measurement | The value box disappears and you can continue. |
| B8 | Edit your answers later from Profile | New answers save. Old meals stay unchanged. |

### C. Logging meals (mobile)

| ID | Do this | Expect |
| --- | --- | --- |
| C1 | Today → "Check in" on the next meal → Confirm | Today shows the calories. The ring goes up. |
| C2 | Confirm a meal at half portion | Calories are half. Reopen it: the half portion is kept. |
| C3 | Skip a meal | It shows "Skipped". Calories do not change. History does not count it as zero. |
| C4 | Confirm the same meal twice | Only one entry. No double count. |
| C5 | Log a different meal by hand with a blank calorie value | The value stays unknown (not 0). |
| C6 | Enter 0, negative, huge (10001) and text quantities | Each is rejected with a message. |
| C7 | Save, force-close the app, reopen | The meal is still there. **RISK** (U05, U06). |
| C8 | Confirm a meal, go to Today | The meal appears on Today with the right calories. **RISK** (U06). |
| C9 | Confirm a meal just before midnight, reopen after | It keeps its original date. Today shows the new day. |
| C10 | Remove a food in the editor, then use Undo | The food returns. |
| C11 | Edit and delete a usual meal in My Plan | Past logged meals keep their old foods. |

### D. History (mobile)

| ID | Do this | Expect |
| --- | --- | --- |
| D1 | Open History with no logs | Empty state. "Nothing recorded" and no zero values. |
| D2 | Log meals on 3 different days. Switch 7 and 30 days | Counts match what you logged. Averages use only complete days. |
| D3 | Tap a day on the chart | Its meals show and open for editing. |
| D4 | Log a meal where one food has unknown calories | That day has no calorie total and is left out of the average. |

### E. Adding food other ways (mobile)

| ID | Do this | Expect |
| --- | --- | --- |
| E1 | Scan a real barcode (phone) | Product name, nutrition, ingredients and allergens show. Nothing is logged automatically. |
| E2 | Type a barcode with a wrong check digit | Rejected before lookup. |
| E3 | Scan an unknown barcode | A "not found" message and a manual option. |
| E4 | Scan with internet off | A clear error and a manual option. |
| E5 | Deny camera permission | A clear message and the typed-barcode option. |
| E6 | Label photo → paste label text → pick serving | The numbers scale correctly. Blank values stay unknown. |
| E7 | Label or meal photo AI in a build without Firebase setup | A clear "needs setup" message. Manual entry still works. |
| E8 | Paste valid then invalid JSON into "Import a meal estimate" | Valid opens a review screen. Invalid and negative values are rejected. |
| E9 | Check that no scan, photo or import logs a meal without a confirm | Always requires you to confirm. |

### F. Meal prep (mobile)

| ID | Do this | Expect |
| --- | --- | --- |
| F1 | Add a starter recipe for 4 servings on a day | Appears in the week view. |
| F2 | Add two recipes that share an ingredient | The grocery list adds the quantities together. |
| F3 | Tick grocery items, then change a recipe | The ticks reset (old purchases don't carry over). |
| F4 | Go through the prep steps and tap quickly | Steps advance one at a time. No skipping. |
| F5 | Mark a batch prepared | Nothing is added to Today's calories. |
| F6 | Log one portion | One entry appears. Repeating it on the same day does not double it. |
| F7 | Own recipe with 0 servings, 21 servings, 13 ingredients | Rejected with a message. |

### G. Voice (mobile, phone only)

| ID | Do this | Expect |
| --- | --- | --- |
| G1 | Tap dictate in the diet description | Permission prompt, then it listens. The keyboard does not get in the way. **RISK** (U07). |
| G2 | Speak, stop, review, apply | Your words go into the box only after you approve. |
| G3 | Deny the permission | A clear message and typing still works. |
| G4 | Switch to another app while it is listening | It stops cleanly. |
| G5 | Try two voice boxes at once | The second says the first is busy. |

### H. Accounts and cloud (mobile)

| ID | Do this | Expect |
| --- | --- | --- |
| H1 | Create an account and verify the email | Verified status shows. |
| H2 | Save your profile to the cloud, then restore it on a second phone | Answers match. Meals do not move over (expected). |
| H3 | Change the profile on both phones, then save from the older one | A conflict message. Nothing is overwritten silently. |
| H4 | Save with the phone offline | A visible failure. Local data is kept. |
| H5 | User A logs meals, signs out, user B signs in | B must **not** see A's meals. **RISK** — I expect this fails (flaw 1). |
| H6 | Look for a way to delete your account | There should be one. **RISK** — I expect there is none (flaw 2). |
| H7 | Reset local data from Profile | Local meals are cleared. The cloud profile stays (as the screen says). |
| H8 | Export your data | JSON contains your meals and profile. No password or token. |

### I. Web app

| ID | Do this | Expect |
| --- | --- | --- |
| I1 | Log a meal, reload the page | It is still there. |
| I2 | Edit a meal's portion | Calories update. The usual meal is unchanged. |
| I3 | Add 250 ml and 500 ml of water, then Undo | Totals and undo are correct. |
| I4 | Set targets (calories 2000, protein 100), log meals | Ring and bars show the right share. Blank target shows no goal. |
| I5 | Enter bad targets (0, negative, 20000, water 100) | Rejected with a message. |
| I6 | Diary: go to tomorrow | The forward button is disabled. Dates in the future are not allowed. |
| I7 | Skip a meal, then check the Home week dots and the Progress page | Same day count on both. **RISK** (flaw 9). |
| I8 | Progress: 7, 30, 90 days | Charts match the diary. Missing days show "–". |
| I9 | Export, then restore the file | Data comes back after you confirm. Restore replaces what is there. |
| I10 | Restore a broken, wrong, or over-5-MB file | A clear error. Current data is untouched. |
| I11 | Sign in with Google (configured build) | Your own data loads. Local data is not uploaded automatically. |
| I12 | Account A logs a meal, sign out, account B signs in | B sees only B's data. |
| I13 | Open the same account in two browsers and add a meal in one | The other updates. |
| I14 | Describe a meal with and without sign-in | Signed in: an estimate to review. Not signed in: a clear message, paste option still works. |
| I15 | Delete account (type DELETE, verify) | Account and its data are removed. Then sign-in starts fresh. |

### J. Web versus mobile checks

| ID | Do this | Expect |
| --- | --- | --- |
| J1 | Log the same foods and portions on both | Same calorie and macro totals. |
| J2 | Sign in with the same email on both | Check whether data is shared. Write down what actually happens. |
| J3 | Delete the account on the web | Check if mobile profile and prep data in the cloud is also removed (the server function removes both). |

### K. Everyday robustness and access

| ID | Do this | Expect |
| --- | --- | --- |
| K1 | Set phone text size to the largest | No cut-off text or hidden buttons on Today, meal editor and onboarding. |
| K2 | Use a screen reader on onboarding and meal logging | Every button and field has a clear name. |
| K3 | Small screen (about 375 px wide) | Nothing overflows. |
| K4 | Kill the app while saving a meal | After reopen, the meal is either fully saved or not saved. Never half-saved. |
| K5 | Tap Confirm several times quickly | One entry. |
| K6 | Clear app storage | The app starts clean. No crash. |

---

## 5. Go-ahead rule (suggested)

**Do not give a go-ahead until all of these pass on a real phone and a real browser:**

- All of section B, C, D, F and J.
- E1 to E5 and E8 to E9.
- G1 to G3 (if voice stays in V1).
- H1 to H4 and H7 to H8.
- I1 to I15 for the web.
- **H5 and H6 must be fixed, or the release must be limited to a single-user device with no accounts.** These are the biggest risks.
- C7, C8 and G1 (the three user-reported bugs) must be reproduced and fixed or explained.

**Do not ship as the tracker's V1** until the AI check-in, notifications, workout tracking, categories and customized view exist, or you formally decide to leave them out. See `V1-FEATURE-REPORT.md`.

## 6. What I did not check

- Whether the app runs on a phone, or whether any test suite passes today.
- Live Firebase, App Check or Gemini behavior.
- What happens when the same email is used for web (Google) and mobile (email and password).
- Parts of `scan.tsx`, `label.tsx`, `meal-photo.tsx`, the web Plan, Library and meal editor, and `functions/src` that I read only briefly or not at all.
