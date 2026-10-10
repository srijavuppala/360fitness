import {
  AnswerKey,
  ProfileAnswers,
  ProfileDraft,
  profileSteps,
  stepErrors,
  visibleQuestion,
} from "./profile";
export type ProfileCursor = AnswerKey | "review";
export const profileSections = [
  "About you",
  "Your goals",
  "Daily life",
  "Food & diet",
  "Movement",
  "Check-ins",
  "Extras",
];
export function profilePages(answers: ProfileAnswers) {
  return profileSteps.flatMap((group, step) =>
    group.questions
      .filter((q) => visibleQuestion(q, answers))
      .map((question) => ({ question, step })),
  );
}
export function resumeProfile(
  draft: ProfileDraft | undefined,
  hasProfile: boolean,
): ProfileCursor {
  if (!draft) return hasProfile ? "review" : "age";
  if (draft.step === profileSteps.length) return "review";
  const pages = profilePages(draft.answers);
  return (
    pages.find((p) => p.question.key === draft.question)?.question.key ??
    pages.find((p) => p.step === draft.step)?.question.key ??
    "age"
  );
}
export function draftAt(
  answers: ProfileAnswers,
  cursor: ProfileCursor,
): ProfileDraft {
  const step =
    cursor === "review"
      ? profileSteps.length
      : profilePages(answers).find((p) => p.question.key === cursor)?.step;
  if (step === undefined)
    throw new Error("This question is no longer visible.");
  return { version: 1, answers: { ...answers }, step, question: cursor };
}
export function firstProfileIssue(answers: ProfileAnswers, group?: number) {
  for (const page of profilePages(answers)) {
    if (group !== undefined && page.step !== group) continue;
    const error = stepErrors(answers, page.step)[page.question.key];
    if (error) return { cursor: page.question.key, error };
  }
  return null;
}
