# 360 Degree Fitness AI client review guide

**Brand update September 30 2026:** the Figma file is now named **360 Degree Fitness AI**. Two new 12-screen templates below the original use **360° Fitness AI** on the welcome screen: classic black and grey, and black and yellow. The original concept, PRD and code retain Nourish. Feature scope is unchanged.

**Reference update:** [Product references and development workflow](REFERENCES-AND-BUILD-WORKFLOW.md) compares published MyFitnessPal, Cal AI and Cronometer flows, adds Expo engineering references, and explains the Superpowers practices used to refine the plan. Use it to explain the rationale for review controls and phase verification. The new design states are specified but have not yet been added to Figma.

**Platform update September 30 2026:** the user selected React Native with Expo for iPhone and Android. Use [the React Native implementation plan](REACT-NATIVE-BUILD-PLAN.md) for the current architecture, feature implementation steps and phase gates. It supersedes the Flutter architecture recommendation and delivery sequence in the original version 0.1 PRD. The original DOCX and Figma technical diagram retain that earlier proposal; do not present them as the current technical decision. The mobile screen designs remain relevant. Photo AI is now proposed before the wider beta, following an internal core milestone; confirm that release scope with the client.

Open the [editable Figma concept](https://www.figma.com/design/AgLTy2m3smHrStrdOhBSuq). It contains the original 12 mobile frames plus two additional 12-screen color templates, shared button and meal-row components, a user journey, and technical architecture. The screens use sample content. Application code was not changed.

## Suggested ten minute walkthrough

1. Explain the promise: describe usual meals once, then confirm what actually happened each day.
2. Show Welcome, the goal screen, and usual breakfast setup.
3. Show My Plan and emphasize that it is a reusable template, not a record of intake.
4. Show Today, dinner check-in and the portion-adjustment concept.
5. Show photo capture and estimate review as Phase 6 of the React Native plan, following the reliable logging and text AI phases.
6. Show History and the distinction between unlogged days and zero intake.
7. Close with Profile, the React Native plan's current architecture and the decisions below. Label the older Figma technical diagram as the previous Flutter proposal.

Figma has three prototype start points: First time setup, Daily check-in and Photo logging concept. Select a starting frame and use Present while signed in. The logged-out browser used for review required sign-in to launch Present. Prototype reactions were created, but an end-to-end playback test was not completed.

## Decisions for this meeting

- Confirm the first audience; iPhone and Android with React Native are selected.
- Decide whether photo logging belongs in the initial commercial release or after the core pilot.
- Agree the visual direction and working product name.
- Confirm budget, timing, decision owner, and the next user-testing session.

Use the PRD's approval record to capture actual decisions. It is intentionally blank until the client decides.

## What is ready and what remains

The requirements include proposed feature priorities, acceptance criteria, user journeys, data model, service boundaries, error behavior, privacy controls, metrics and staged delivery. The document is a proposed baseline, not a signed specification.

Figma contains native editable text and layout layers, photographs, component instances and navigation reactions. Quantities, authentication, camera capture and persistence are not functional in this concept. Preference rows are partly illustrative. Saves lead to an explanatory acknowledgement and a fixed Today screen.

The Starter-plan MCP call limit was reached after creation while exporting images. The welcome screen and technical architecture were exported locally. All original 11 mobile frames passed a structural bounds check after the text-wrapping repair; the added portion frame and both diagrams also passed their creation-time bounds checks. Final visual review covered exported Welcome and Architecture, plus screens inspected in the Figma browser. The two new color templates were subsequently edited and exported through the Figma browser UI; those templates received visual review, not an automated structural audit.

## Design handoff

- Main mobile frames: 390 × 844; light theme; Roboto; 24 px inset.
- Existing color identities: green #2E7D57 and protein purple #5B6ABF.
- Newly proposed surfaces and spacing are design choices, not an assertion that every value already exists in Flutter.
- Repeated button and meal-row elements are component instances. Foundations and source scripts are included for iteration.
- Add detailed permission, failure, offline, conflict, deletion, large-text and dark-theme states before treating this as a production design system.
- `Nourish-PRD.md` is the editable text source. `Nourish-PRD.docx` is the formatted client document. Source scripts and validation images are internal working material.

## Existing photographic asset

The salad image comes from the repository's existing Unsplash-attributed asset. It illustrates a sample meal only. Source: https://images.unsplash.com/photo-1512621776951-a57141f2eefd

## New color templates — September 30, 2026

Both editable groups are on the existing mobile-concept page, below the original design:

- [Classic black and grey](https://www.figma.com/design/AgLTy2m3smHrStrdOhBSuq/360-Degree-Fitness-AI?node-id=24-409): group `24:409`, x160/y3550; light-grey surfaces, black controls, white cards. [PNG preview](assets/360-classic-black-grey.png).
- [Black and yellow](https://www.figma.com/design/AgLTy2m3smHrStrdOhBSuq/360-Degree-Fitness-AI?node-id=24-410): group `24:410`, x160/y6750; near-black surfaces, yellow accents, light text. [PNG preview](assets/360-black-yellow.png).

Each template duplicates all 12 existing screens and retains editable text, photographs and component instances. Colors are local overrides in the duplicated groups; original shared color variables and the original design were preserved. The new groups are visual options; prototype playback and cross-template navigation have not been verified.
