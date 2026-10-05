import type { Quiz } from "../src/types";

/**
 * Deterministic in-memory quizzes. UI tests never touch `quizzes/` so that a
 * data change can't be mistaken for a UI regression (see quiz-loader.test.ts).
 *
 * Source indices are meaningful: shuffling reorders them for display only.
 * All prose is kept short enough to render on a single line, so frame
 * assertions do not depend on where the terminal wraps text.
 */
export const alphaQuiz: Quiz = {
  id: "alpha",
  title: "Alpha Quiz",
  description: "Alpha fixture quiz.",
  sourcePath: "./quizzes/alpha.json",
  questions: [
    {
      id: "alpha-single",
      prompt: "Alpha single: pick one.",
      choices: ["one", "two", "three"],
      answerIndices: [0],
      hint: "Alpha hint text.",
      explanation: "Alpha explanation text.",
    },
    {
      id: "alpha-multi",
      prompt: "Alpha multi: pick left and right.",
      choices: ["left", "right", "up", "down"],
      answerIndices: [0, 1],
      explanation: "Alpha multi explanation text.",
    },
    {
      id: "alpha-bare",
      prompt: "Alpha bare: no hint, no explanation.",
      choices: ["yes", "no"],
      answerIndices: [1],
    },
  ],
};

export const betaQuiz: Quiz = {
  id: "beta",
  title: "Beta Quiz",
  description: "Beta fixture quiz.",
  sourcePath: "./quizzes/beta.json",
  questions: [{ id: "beta-single", prompt: "Beta single: pick one.", choices: ["x", "y"], answerIndices: [0] }],
};
