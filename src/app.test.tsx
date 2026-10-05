import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { alphaQuiz, betaQuiz } from "../test/fixtures";
import {
  displayedChoices,
  highlightedChoices,
  mountApp,
  selectedChoices,
  startQuiz,
  status,
  type AppHarness,
} from "../test/harness";

let app: AppHarness | undefined;

afterEach(() => {
  app?.destroy();
  app = undefined;
});

describe("list screen", () => {
  test("shows every quiz, the header count, and details for the selected one", async () => {
    app = await mountApp({ quizzes: [alphaQuiz, betaQuiz] });
    const frame = app.frame();

    expect(frame).toContain("2 quizzes");
    expect(frame).toContain("Alpha Quiz");
    expect(frame).toContain("Beta Quiz");
    expect(frame).toContain("Alpha fixture quiz.");
    expect(frame).toContain("Questions: 3");
    expect(frame).toContain("Source: ./quizzes/alpha.json");
    expect(frame).toContain("List: j/k move");
  });

  test("prompts for content when there are no quizzes at all", async () => {
    app = await mountApp({ quizzes: [] });
    expect(app.frame()).toContain("No quizzes found. Add JSON files in quizzes folder.");

    await app.pressEnter();
    expect(app.frame()).toContain("No quizzes found.");
  });

  test("lists load warnings in a dedicated panel", async () => {
    app = await mountApp({ quizzes: [alphaQuiz], errors: ["Quiz ./quizzes/bad.json is missing a title."] });
    const frame = app.frame();

    expect(frame).toContain("Load warnings");
    expect(frame).toContain("Quiz ./quizzes/bad.json is missing a title.");
  });

  test("j/k moves the selection and the details pane follows it", async () => {
    app = await mountApp({ quizzes: [alphaQuiz, betaQuiz] });
    await app.press("j");
    expect(app.frame()).toContain("Source: ./quizzes/beta.json");

    await app.press("k");
    expect(app.frame()).toContain("Source: ./quizzes/alpha.json");
  });

  test("G jumps to the last quiz and gg back to the first", async () => {
    app = await mountApp({ quizzes: [alphaQuiz, betaQuiz] });

    await app.press("G");
    expect(app.frame()).toContain("Source: ./quizzes/beta.json");

    await app.pressKeys(["g", "g"]);
    expect(app.frame()).toContain("Source: ./quizzes/alpha.json");
  });

  test("q and ctrl+c both quit", async () => {
    let quits = 0;
    app = await mountApp({ quizzes: [alphaQuiz], onQuit: () => (quits += 1) });

    await app.press("q");
    expect(quits).toBe(1);

    await app.pressCtrlC();
    expect(quits).toBe(2);
  });
});

describe("quiz flow", () => {
  test("enter opens the selected quiz and q returns to the list", async () => {
    app = await mountApp({ quizzes: [alphaQuiz, betaQuiz] });

    await startQuiz(app, 3);
    expect(app.frame()).toContain("Alpha Quiz · Question 1 / 3");
    expect(app.frame()).toContain("Quiz My Ass · 1/3 · score 0/3");
    expect(status(app.frame())).toBe("Unanswered");
    expect(app.frame()).toContain("Answered: 0 / 3");

    await app.press("q");
    expect(app.frame()).toContain("Select quiz");
  });

  test("submitting the highlighted single answer scores it", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);

    await app.pressEnter();
    const frame = app.frame();
    expect(status(frame)).toBe("Correct");
    expect(frame).toContain("Quiz My Ass · 1/3 · score 1/3");
    expect(frame).toContain("Answered: 1 / 3");
    expect(frame).toContain("Alpha explanation text.");
  });

  test("submitting a wrong single answer reports the correct answer's label", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);

    await app.press("j");
    await app.pressEnter();
    const frame = app.frame();
    expect(status(frame)).toBe("Incorrect");
    expect(frame).toContain("Quiz My Ass · 1/3 · score 0/3");
    expect(frame).toContain("Incorrect. Correct answer: A).");
  });

  test("re-submitting replaces the previous answer and the score", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);

    await app.pressEnter();
    expect(app.frame()).toContain("score 1/3");

    await app.press("j");
    await app.pressEnter();
    expect(app.frame()).toContain("score 0/3");
  });

  test("space only ticks answers on multi-choice questions", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);

    await app.pressSpace();
    expect(selectedChoices(app.frame())).toEqual([]);

    await app.press("l");
    await app.pressSpace();
    expect(selectedChoices(app.frame())).toEqual(["left"]);
  });

  test("a multi-choice answer only counts when the exact set is selected", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);
    await app.press("l");

    await app.pressSpace();
    await app.pressEnter();
    expect(status(app.frame())).toBe("Incorrect");
    expect(app.frame()).toContain("Incorrect. Correct answer: A), B).");

    await app.press("j");
    await app.pressSpace();
    await app.pressEnter();
    expect(selectedChoices(app.frame())).toEqual(["left", "right"]);
    expect(status(app.frame())).toBe("Correct");
    expect(app.frame()).toContain("Quiz My Ass · 2/3 · score 1/3");
  });

  test("changing a submitted answer marks the question unanswered again", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);
    await app.press("l");

    await app.pressSpace();
    await app.pressEnter();
    expect(app.frame()).toContain("Answered: 1 / 3");

    await app.pressSpace();
    expect(status(app.frame())).toBe("Unanswered");
    expect(app.frame()).toContain("Answered: 0 / 3");
  });
});

describe("answer cursor", () => {
  test("j and k wrap around at both ends", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);

    expect(highlightedChoices(app.frame())).toEqual(["A)"]);

    await app.press("k");
    expect(highlightedChoices(app.frame())).toEqual(["C)"]);

    await app.press("j");
    expect(highlightedChoices(app.frame())).toEqual(["A)"]);
  });

  test("arrow keys move the cursor the same way as j/k", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);

    await app.pressArrow("down");
    expect(highlightedChoices(app.frame())).toEqual(["B)"]);

    await app.pressArrow("up");
    expect(highlightedChoices(app.frame())).toEqual(["A)"]);
  });
});

describe("question navigation", () => {
  test("h/l clamp at the ends, G jumps to the last question and gg to the first", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);

    await app.press("h");
    expect(app.frame()).toContain("Question 1 / 3");

    await app.press("G");
    expect(app.frame()).toContain("Question 3 / 3");

    await app.press("l");
    expect(app.frame()).toContain("Question 3 / 3");

    await app.pressKeys(["g", "g"]);
    expect(app.frame()).toContain("Question 1 / 3");
  });

  test("each question keeps its own cursor, selection, and submitted state", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);

    await app.pressEnter();
    await app.press("l");
    await app.press("j");
    await app.pressSpace();

    expect(highlightedChoices(app.frame())).toEqual(["B)"]);

    await app.press("h");
    expect(app.frame()).toContain("Question 1 / 3");
    expect(status(app.frame())).toBe("Correct");

    await app.press("l");
    expect(highlightedChoices(app.frame())).toEqual(["B)"]);
    expect(status(app.frame())).toBe("Unanswered");
  });
});

describe("hints and explanations", () => {
  test("? reveals the hint and ? again hides it", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);

    expect(app.frame()).toContain("Press ? to reveal hint.");

    await app.press("?");
    expect(app.frame()).toContain("Alpha hint text.");

    await app.press("?");
    expect(app.frame()).toContain("Press ? to reveal hint.");
  });

  test("a question without a hint falls back instead of rendering nothing", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);
    await app.press("G");

    await app.press("?");
    expect(app.frame()).toContain("No hint available.");
  });

  test("e toggles the explanation and a missing one falls back", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);

    expect(app.frame()).toContain("Press e to toggle explanation.");

    await app.press("e");
    expect(app.frame()).toContain("Alpha explanation text.");

    await app.press("e");
    expect(app.frame()).toContain("Press e to toggle explanation.");

    await app.press("G");
    await app.press("e");
    expect(app.frame()).toContain("No explanation provided.");
  });
});

describe("reset", () => {
  test("r clears answers and returns to the first question", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);

    await app.press("l");
    await app.pressEnter();
    await app.press("G");
    expect(app.frame()).toContain("Question 3 / 3");

    await app.press("r");
    const frame = app.frame();
    expect(frame).toContain("Question 1 / 3");
    expect(frame).toContain("Answered: 0 / 3");
    expect(frame).toContain("score 0/3");
    expect(status(frame)).toBe("Unanswered");
  });
});

describe("settings", () => {
  test("s opens settings over the quiz and q returns to the quiz", async () => {
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);

    await app.press("s");
    expect(app.frame()).toContain("Settings: space/enter toggle · q/esc back");
    expect(app.frame()).toContain("Alpha Quiz · Question 1 / 3");

    await app.press("q");
    expect(app.frame()).toContain("Quiz: j/k move");
    expect(app.frame()).not.toContain("Space toggle · Esc close");
  });

  test("shuffle permutes display positions only, and settings can turn it off", async () => {
    const random = spyOn(Math, "random").mockReturnValue(0);
    try {
      app = await mountApp({ quizzes: [alphaQuiz], shuffle: true });
      await startQuiz(app, 3);
      await app.press("l");

      // random()===0 makes the Fisher-Yates result deterministic: [1, 2, 3, 0].
      expect(displayedChoices(app.frame())).toEqual(["right", "up", "down", "left"]);

      // Source indices are untouched, so the correct answer's label moves with it.
      await app.pressEnter();
      expect(status(app.frame())).toBe("Incorrect");
      expect(app.frame()).toContain("Incorrect. Correct answer: A), D).");

      await app.press("s");
      await app.pressSpace();
      await app.press("q");

      expect(displayedChoices(app.frame())).toEqual(["left", "right", "up", "down"]);
    } finally {
      random.mockRestore();
    }
  });
});

describe("misc", () => {
  test("a single y does not copy; the copy needs the yy chord", async () => {
    // Deliberately does not assert on the copy itself: that shells out to
    // wl-copy/xclip/xsel and an OSC 52 escape, so its result depends on the
    // host's clipboard tools and whether stdout is a TTY.
    app = await mountApp({ quizzes: [alphaQuiz] });
    await startQuiz(app, 3);

    await app.press("y");
    expect(app.frame()).not.toContain("Copied question");
    expect(app.frame()).not.toContain("Clipboard failed");
  });

  test("survives a terminal resize down to a tiny size", async () => {
    app = await mountApp({ quizzes: [alphaQuiz], size: { width: 70, height: 30 } });
    expect(app.frame()).toContain("Select quiz");

    app.setup.resize(30, 10);
    await app.settle();

    expect(app.frame()).toContain("Quiz My Ass · 1 quizzes");
  });
});