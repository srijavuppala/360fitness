# Mobile interaction design

Implemented October 8, 2026 in the Expo / React Native app.

## Reference decisions

- [Apple Human Interface Guidelines: Onboarding](https://developer.apple.com/design/human-interface-guidelines/onboarding): keep setup focused and put contextual help near the relevant action.
- [Android layout basics](https://developer.android.com/design/ui/mobile/guides/layout-and-content/layout-basics): respect safe areas and keyboards, keep essential interactions reachable, and avoid overwhelming each view.
- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/): match the installed SDK; retain Expo Router and cross-platform React Native components.

These are platform guidance references, not copied app screens. The existing cream/forest palette remains.

## Implemented patterns

- Onboarding: one visible question per screen, fixed back/progress/continue areas, optional skip, full-width choices or two-column choice grids. Contextual help opens separately. Smaller usable heights omit the decorative eyebrow and move help to the navigation bar. Controls retain at least 48-point targets.
- Profile review: seven section tiles. Tap a section, then an answer, to edit it. Conditional required follow-ups must be answered before returning to review. Final save still validates the full profile.
- Draft compatibility: `ProfileDraft.version` remains 1 and `step` remains the original group index. An optional `question` key remembers the precise screen. Older drafts resume at the beginning of their group. Cloud profile answer schemas do not change.
- Voice entry: compact text area and keyboard dictation in Expo Go; the native speech review workflow opens in its own modal instead of extending the onboarding form. Permission, cancellation and explicit transcript acceptance behavior is retained.
- Today: nutrition summary, scan/log actions, next meal and a meal-list entry. Full nutrition and today's meals open in detail panels.
- My Plan and routine confirmation: compact meal rows; primary action stays at the bottom.
- Profile: goal and three settings entries. Data export, reset confirmation, feature status and credits live in separate panels.

## Boundaries

Long histories, expanded details, long transcripts, accessibility font sizes and an open keyboard can still require scrolling. Content is never clipped or font scaling disabled to force a fit. This work changes presentation and navigation; it does not activate Firebase configuration, reminders, recommendation generation or signed app distribution.

## Verification

- 71 domain/service tests, TypeScript, ESLint and generated Firestore rules check.
- iOS, Android and web bundles exported.
- Browser walkthrough: conditional Other diet, optional skips, exact-question save/exit/resume, twelve-hour time, review/edit/save, routine confirmation, Today and Profile.
- Checked selected-option `aria-checked` state.
- Phone-size screenshots under `apps/mobile/qa/mobile-*.png`.
- Browser sizes are layout previews, not physical-device tests. Native safe-area/keyboard, VoiceOver/TalkBack, Android hardware back and microphone behavior still need device QA.
