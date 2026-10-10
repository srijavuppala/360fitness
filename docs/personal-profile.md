# Personal profile and onboarding

Implemented in the React Native / Expo app, October 7, 2026.

## Flow

New users: Welcome → seven question groups → Review → usual meals → Today.
Existing users: Profile → Set up my profile / Review or edit my profile.
Saved drafts resume at their last saved step. Continue, Previous step, and Save & exit persist the current answers locally. Changes since the last explicit save are not guaranteed to survive closing the app. A completed profile is replaced only after the review screen's Save my profile action succeeds.

## Requirements mapping

| Group           | Collected answers                                                          | Required                                                      |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Profile         | Age range; metric choice and current value                                 | Yes; explicit privacy options available                       |
| Goals           | Primary goal; desired outcome (text, including numeric targets with units) | Yes                                                           |
| Lifestyle       | Activity level; work schedule                                              | Activity required; schedule optional                          |
| Nutrition       | Diet; allergies; foods avoided; meal timing; nutrition priority            | Diet and allergy response required; remaining fields optional |
| Exercise        | Workout preferences; workout frequency                                     | Yes                                                           |
| Tracking and AI | Tracking style; notification frequency; voice comfort; local check-in time | Yes                                                           |
| Future          | Weekly household grocery budget in USD; wearables/smart scales             | Optional                                                      |

Other diet/allergy selections require details. Allergy responses and avoided-food preferences are separate. None known / Not sure are exclusive choices; they do not guarantee food safety. Check-in time is entered and displayed in local 12-hour time with AM/PM, stored as HH:mm for compatibility with existing profiles, including when notifications are off. No reminder is scheduled.

## Persistence and boundaries

- AppState remains version 1 with optional, independently versioned `profile` and `profileDraft` fields. Old saved meals continue loading without a profile; no forced re-onboarding for existing users.
- Final save synchronizes the existing primary goal. Meal templates and history remain unchanged.
- Profile answers use readable option labels and string numeric inputs with explicit units. These are preferences, not calculated calorie or nutrition targets.
- Drafts may be incomplete; malformed structures are rejected on load. Final save validates all required/conditional fields and numeric/time syntax.
- Selecting a privacy option or moving away from Other removes now-hidden measurement/detail answers.
- Native storage uses the existing SQLite store; web preview uses the existing local storage key. Profile data is included in the existing user-initiated JSON export and removed by the existing local reset.
- Profile answers are not included in barcode lookups or label-photo AI requests.
- This change collects preferences. It does not implement personalized food/workout recommendations, notification scheduling, voice recording/check-ins, grocery recommendations, weight-progress charts, or wearable integration.

## Verification

`npm run check` in `apps/mobile`: typecheck, lint, and 47 tests (10 new profile tests).

Browser smoke test uses a separate `127.0.0.1:8081` origin and synthetic data labeled TEST PROFILE, keeping the user's `localhost:8081` data untouched. Covers required errors, optional skips, save/exit/reload/resume, multi-select, review, profile completion and editing. Native JS bundle checks do not establish physical-device behavior or produce signed app builds.

### Cloud profile foundation (2026-10-08)

Completed profiles now have an explicit account save/restore flow from the routine screen and Profile → Account & cloud profile. This requires the Firebase public client configuration, Email/Password authentication, email verification and deployed Firestore rules. It is not enabled in the unconfigured local preview. Drafts and meals remain local, and edits do not automatically upload. See [mobile architecture](mobile-architecture.md) for the database contract and remaining release work.
