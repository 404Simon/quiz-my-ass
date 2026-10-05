import { describe, expect, test } from "bun:test";
import { loadQuizzes, normalizeQuiz } from "./quiz-loader";
import type { QuizQuestion } from "./types";

const SOURCE = "/repo/quizzes/sample.json";

/** Runs one quiz file through the loader, returning the quiz plus its error list. */
function load(raw: unknown) {
  const errors: string[] = [];
  const quiz = normalizeQuiz(raw, SOURCE, errors);
  return { quiz, errors };
}

function validRaw(overrides: Record<string, unknown> = {}) {
  return {
    title: "Sample Quiz",
    description: "Sample description.",
    questions: [{ prompt: "Prompt?", choices: ["a", "b"], answerIndex: 0 }],
    ...overrides,
  };
}

describe("normalizeQuiz: valid input", () => {
  test("keeps a well-formed quiz and reports no errors", () => {
    const { quiz, errors } = load(validRaw());
    expect(errors).toEqual([]);
    expect(quiz?.title).toBe("Sample Quiz");
    expect(quiz?.description).toBe("Sample description.");
    expect(quiz?.questions).toHaveLength(1);
  });

  test("accepts single answerIndex and multi answerIndices, both normalised", () => {
    const single = load(validRaw()).quiz?.questions[0];
    expect(single?.answerIndices).toEqual([0]);

    const multi = load(
      validRaw({ questions: [{ prompt: "P", choices: ["a", "b", "c"], answerIndices: [2, 0, 2] }] }),
    ).quiz?.questions[0];
    expect(multi?.answerIndices).toEqual([0, 2]);
  });

  test("coerces choice entries to strings", () => {
    const question = load(
      validRaw({ questions: [{ prompt: "P", choices: ["a", 7, true], answerIndex: 0 }] }),
    ).quiz?.questions[0];
    expect(question?.choices).toEqual(["a", "7", "true"]);
  });

  test("trims text; a whitespace-only hint becomes an empty string, not undefined", () => {
    const question = load(
      validRaw({
        questions: [{ prompt: "  P  ", choices: ["a", "b"], answerIndex: 0, hint: "  ", explanation: "  E  " }],
      }),
    ).quiz?.questions[0];
    expect(question?.prompt).toBe("P");
    expect(question?.hint).toBe("");
    expect(question?.explanation).toBe("E");
  });

  test("leaves an absent hint undefined, which is what drives the UI fallback", () => {
    const question = load(validRaw()).quiz?.questions[0];
    expect(question?.hint).toBeUndefined();
    expect(question?.explanation).toBeUndefined();
  });
});

describe("normalizeQuiz: generated ids", () => {
  test("quiz id falls back to a slugified file name when id is missing", () => {
    expect(load(validRaw()).quiz?.id).toBe("sample-json");
    expect(load(validRaw({ id: "  explicit-id  " })).quiz?.id).toBe("explicit-id");
  });

  test("question id falls back to the quiz title plus its 1-based position", () => {
    const quiz = load({
      ...validRaw(),
      title: "My Great Quiz!",
      questions: [{ prompt: "P", choices: ["a", "b"], answerIndex: 0 }],
    }).quiz;
    expect(quiz?.questions[0]?.id).toBe("my-great-quiz-q1");
  });
});

describe("normalizeQuiz: rejected quizzes", () => {
  test.each([
    ["not an object", "nope", /is not a JSON object/],
    ["missing title", { questions: [] }, /is missing a title/],
    ["blank title", { title: "   ", questions: [] }, /is missing a title/],
    ["no questions array", { title: "T" }, /has no questions/],
    ["empty questions array", { title: "T", questions: [] }, /has no questions/],
  ])("rejects %s", (_label, raw, expected) => {
    const { quiz, errors } = load(raw);
    expect(quiz).toBeNull();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(expected);
  });

  test("rejects a quiz whose questions are all invalid, reporting both causes", () => {
    const { quiz, errors } = load({ title: "T", questions: [{ prompt: "" }] });
    expect(quiz).toBeNull();
    expect(errors).toHaveLength(2);
    expect(errors[0]).toMatch(/question 1 is missing a prompt/);
    expect(errors[1]).toMatch(/has no valid questions/);
  });
});

describe("normalizeQuestion: rejected questions", () => {
  test.each([
    ["not an object", "nope", /question 1 is not an object/],
    ["missing prompt", { choices: ["a", "b"], answerIndex: 0 }, /question 1 is missing a prompt/],
    ["too few choices", { prompt: "P", choices: ["a"], answerIndex: 0 }, /must have 2-8 choices/],
    ["too many choices", { prompt: "P", choices: ["a", "b", "c", "d", "e", "f", "g", "h", "i"], answerIndex: 0 }, /must have 2-8 choices/],
    ["no answer", { prompt: "P", choices: ["a", "b"] }, /invalid answerIndices/],
    ["answer out of range", { prompt: "P", choices: ["a", "b"], answerIndex: 2 }, /invalid answerIndices/],
    ["negative answer", { prompt: "P", choices: ["a", "b"], answerIndex: -1 }, /invalid answerIndices/],
    ["one answer out of range", { prompt: "P", choices: ["a", "b"], answerIndices: [0, 5] }, /invalid answerIndices/],
  ])("drops question that is %s", (_label, question, expected) => {
    const { quiz, errors } = load(validRaw({ questions: [question] }));
    expect(quiz).toBeNull();
    expect(errors.some((error) => expected.test(error))).toBe(true);
  });

  test("keeps valid questions alongside invalid ones but flags each error", () => {
    const { quiz, errors } = load(
      validRaw({
        questions: [
          { prompt: "Good", choices: ["a", "b"], answerIndex: 1 },
          { prompt: "Bad", choices: [], answerIndex: 0 },
          { prompt: "Also good", choices: ["a", "b"], answerIndices: [0, 1] },
        ],
      }),
    );
    expect(quiz?.questions.map((question: QuizQuestion) => question.prompt)).toEqual(["Good", "Also good"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/question 2 must have 2-8 choices/);
  });
});

describe("loadQuizzes", () => {
  test("loads every shipped quiz file without warnings", () => {
    const { quizzes, errors } = loadQuizzes();

    expect(errors).toEqual([]);
    expect(quizzes.length).toBeGreaterThan(0);
    for (const quiz of quizzes) {
      expect(quiz.sourcePath.startsWith("./quizzes/")).toBe(true);
      expect(quiz.title.length).toBeGreaterThan(0);
      for (const question of quiz.questions) {
        expect(question.choices.length).toBeGreaterThanOrEqual(2);
        expect(question.choices.length).toBeLessThanOrEqual(8);
        expect(question.answerIndices.length).toBeGreaterThan(0);
        for (const index of question.answerIndices) {
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(question.choices.length);
        }
      }
    }
  });
});