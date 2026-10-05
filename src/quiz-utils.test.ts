import { describe, expect, test } from "bun:test";
import { choiceLabel, choiceListLabel, isCorrectAnswer, normalizeSelection } from "./quiz-utils";
import type { QuizQuestion } from "./types";

function question(answerIndices: number[], choices = 4): QuizQuestion {
  return {
    id: "q",
    prompt: "p",
    choices: Array.from({ length: choices }, (_, i) => `c${i}`),
    answerIndices,
  };
}

describe("choiceLabel", () => {
  test("labels positions A..H, the loader's choice-count maximum", () => {
    expect(Array.from({ length: 8 }, (_, i) => choiceLabel(i))).toEqual([
      "A)",
      "B)",
      "C)",
      "D)",
      "E)",
      "F)",
      "G)",
      "H)",
    ]);
  });
});

describe("choiceListLabel", () => {
  test("joins labels in the given order and renders empty as an empty string", () => {
    expect(choiceListLabel([2, 0])).toBe("C), A)");
    expect(choiceListLabel([])).toBe("");
  });
});

describe("normalizeSelection", () => {
  test("deduplicates and sorts ascending", () => {
    expect(normalizeSelection([3, 1, 3, 0, 1])).toEqual([0, 1, 3]);
    expect(normalizeSelection([])).toEqual([]);
  });
});

describe("isCorrectAnswer", () => {
  test("ignores selection order and duplicates", () => {
    const multi = question([1, 3]);
    expect(isCorrectAnswer(multi, [3, 1])).toBe(true);
    expect(isCorrectAnswer(multi, [1, 1, 3])).toBe(true);
  });

  test("requires an exact set, so a subset is wrong", () => {
    const multi = question([1, 3]);
    expect(isCorrectAnswer(multi, [1])).toBe(false);
    expect(isCorrectAnswer(multi, [1, 3, 0])).toBe(false);
  });

  test("nothing submitted is wrong even for a single-answer question", () => {
    const single = question([2]);
    expect(isCorrectAnswer(single, [])).toBe(false);
    expect(isCorrectAnswer(single, [2])).toBe(true);
    expect(isCorrectAnswer(single, [0, 2])).toBe(false);
  });
});