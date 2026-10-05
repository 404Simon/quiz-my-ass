import { expect } from "bun:test";
import { testRender } from "@opentui/solid";
import type { TestRendererSetup } from "@opentui/core/testing";
import { App } from "../src/app";
import type { Quiz } from "../src/types";

/** Wide enough that the 65%/35% quiz split never truncates fixture text. */
const DEFAULT_SIZE = { width: 120, height: 40 } as const;

type MountOptions = {
  quizzes?: Quiz[];
  errors?: string[];
  size?: { width: number; height: number };
  onQuit?: () => void;
  /**
   * Choice shuffling is on by default, which makes displayed choice positions
   * random. When false (the default) it is switched off through the real
   * settings screen during mount, so display row N is always source index N.
   */
  shuffle?: boolean;
};

export type AppHarness = {
  setup: TestRendererSetup;
  /** Current rendered character grid. */
  frame: () => string;
  /** Press one printable character, e.g. "j", "?", "G", "/". */
  press: (key: string) => Promise<void>;
  /** Press characters back to back, e.g. `gg`, which the app only sees as a chord. */
  pressKeys: (keys: string[]) => Promise<void>;
  pressEnter: () => Promise<void>;
  pressSpace: () => Promise<void>;
  pressArrow: (direction: "up" | "down" | "left" | "right") => Promise<void>;
  pressCtrlC: () => Promise<void>;
  /** Let all scheduled rendering settle, e.g. after a resize. */
  settle: () => Promise<void>;
  destroy: () => void;
};

/**
 * Mounts the real `<App>` on OpenTUI's in-memory test renderer, so key presses
 * travel through the actual terminal input parser.
 *
 * Named keys get their own helpers on purpose: `mockInput.pressKey("return")`
 * types the letters r-e-t-u-r-n, and `pressKey("space")` types "space".
 */
export async function mountApp(options: MountOptions = {}): Promise<AppHarness> {
  const { quizzes = [], errors = [], size = DEFAULT_SIZE, onQuit = () => {}, shuffle = false } = options;

  const setup = await testRender(() => <App quizzes={quizzes} errors={errors} onQuit={onQuit} />, size);
  await setup.renderOnce();

  const after = async (send: () => void) => {
    send();
    await setup.waitForVisualIdle();
  };

  const harness: AppHarness = {
    setup,
    frame: () => setup.captureCharFrame(),
    press: (key) => after(() => setup.mockInput.pressKey(key)),
    pressKeys: (keys) => after(() => setup.mockInput.pressKeys(keys)),
    pressEnter: () => after(() => setup.mockInput.pressEnter()),
    pressSpace: () => after(() => setup.mockInput.pressKey(" ")),
    pressArrow: (direction) => after(() => setup.mockInput.pressArrow(direction)),
    pressCtrlC: () => after(() => setup.mockInput.pressCtrlC()),
    settle: () => setup.waitForVisualIdle(),
    destroy: () => setup.renderer.destroy(),
  };

  if (!shuffle) await turnOffShuffle(harness, quizzes);
  return harness;
}

/** Reads the list screen and enters the currently selected quiz. */
export async function startQuiz(app: AppHarness, questionCount: number) {
  await app.pressEnter();
  expect(app.frame(), "enter should open the selected quiz").toContain(`Question 1 / ${questionCount}`);
}

export type ChoiceRow = { label: string; text: string; highlighted: boolean; selected: boolean };

/**
 * Extracts the rendered answer rows. Relies on fixture prompts, choice text and
 * descriptions never containing an `A)`-style label followed by a space.
 */
export function choiceRows(frame: string): ChoiceRow[] {
  return frame.split("\n").flatMap((line) => {
    const labelled = /\b([A-H]\)) (.+?)\s*│/.exec(line);
    if (!labelled) return [];
    return [{
      label: labelled[1]!,
      text: labelled[2]!,
      highlighted: line.includes("▶"),
      selected: /\[x\]/.test(line),
    }];
  });
}

/** Visible choice texts in display order. */
export function displayedChoices(frame: string): string[] {
  return choiceRows(frame).map((row) => row.text);
}

/** Labels of the choices under the cursor. */
export function highlightedChoices(frame: string): string[] {
  return choiceRows(frame).filter((row) => row.highlighted).map((row) => row.label);
}

/** Choice texts that are ticked, in display order. */
export function selectedChoices(frame: string): string[] {
  return choiceRows(frame).filter((row) => row.selected).map((row) => row.text);
}

/** The Status panel's headline, so "Correct" cannot match inside "Incorrect". */
export function status(frame: string): string {
  return /│\s*(Correct|Incorrect|Unanswered)\s+│/.exec(frame)?.[1] ?? "";
}

/**
 * s -> space -> q: open settings, untick shuffle, close. Fails loudly if that route changes.
 *
 * Done from the quiz screen on purpose: settings opened from the list screen
 * leaves the list's `<select>` focused behind the overlay, so space/enter there
 * hit `select-current` and start the quiz instead of ticking the checkbox.
 */
async function turnOffShuffle(app: AppHarness, quizzes: Quiz[]) {
  if (!quizzes.length) return;

  await app.pressEnter();
  await app.press("s");
  expect(app.frame(), "settings should open over the quiz screen").toContain("[x] Shuffle answers");

  await app.pressSpace();
  expect(app.frame(), "space should untick shuffle").toContain("[ ] Shuffle answers");

  await app.press("q");
  expect(app.frame(), "q should close settings").toContain("Quiz: j/k move");

  await app.press("q");
  expect(app.frame(), "q should return to the list screen").toContain("Select quiz");
}