import { TextAttributes, createCliRenderer } from "@opentui/core";
import type { SelectRenderable } from "@opentui/core";
import { render, useKeyboard, useRenderer } from "@opentui/solid";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";

type QuizQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  answerIndices: number[];
  hint?: string;
  explanation?: string;
};

type Quiz = {
  id: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  sourcePath: string;
};

type LoadResult = {
  quizzes: Quiz[];
  errors: string[];
};

const loadResult = loadQuizzes();

async function main() {
  const renderer = await createCliRenderer();
  render(() => <App quizzes={loadResult.quizzes} errors={loadResult.errors} />, renderer);

  function quit() {
    renderer.destroy();
    process.exit(0);
  }

  process.on("SIGINT", quit);
  process.on("SIGTERM", quit);
}

main();

function App(props: { quizzes: Quiz[]; errors: string[] }) {
  const [screen, setScreen] = createSignal<"list" | "quiz">("list");
  const [selectedQuizIndex, setSelectedQuizIndex] = createSignal(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = createSignal(0);
  const [answers, setAnswers] = createSignal<Record<number, number[]>>({});
  const [cursorByQuestion, setCursorByQuestion] = createSignal<Record<number, number>>({});
  const [hintShownByQuestion, setHintShownByQuestion] = createSignal<Record<number, boolean>>({});
  const [explanationShownByQuestion, setExplanationShownByQuestion] = createSignal<Record<number, boolean>>({});
  const [submittedByQuestion, setSubmittedByQuestion] = createSignal<Record<number, boolean>>({});
  const [activeQuizId, setActiveQuizId] = createSignal<string | undefined>(undefined);

  let quizSelect: SelectRenderable | undefined;

  const quiz = createMemo(() => props.quizzes[selectedQuizIndex()]);
  const questionCount = createMemo(() => quiz()?.questions.length ?? 0);
  const question = createMemo(() => quiz()?.questions[currentQuestionIndex()]);
  const currentAnswerIndices = createMemo(() => answers()[currentQuestionIndex()] ?? []);
  const hintShown = createMemo(() => hintShownByQuestion()[currentQuestionIndex()] ?? false);
  const explanationShown = createMemo(() => explanationShownByQuestion()[currentQuestionIndex()] ?? false);
  const submitted = createMemo(() => submittedByQuestion()[currentQuestionIndex()] ?? false);

  const currentCursor = createMemo(() => {
    const index = currentQuestionIndex();
    const savedCursor = cursorByQuestion()[index];
    const savedAnswer = answers()[index]?.[0];
    return savedCursor ?? savedAnswer ?? 0;
  });

  const score = createMemo(() => {
    const quizValue = quiz();
    if (!quizValue) return 0;
    let total = 0;
    for (const [idx, answer] of Object.entries(answers())) {
      if (!submittedByQuestion()[Number(idx)]) continue;
      const q = quizValue.questions[Number(idx)];
      if (q && isCorrectAnswer(q, answer)) total += 1;
    }
    return total;
  });

  const answeredCount = createMemo(
    () => Object.values(submittedByQuestion()).filter((value) => value).length,
  );
  const renderer = useRenderer();

  useKeyboard((key) => {
    if (key.eventType === "release") return;
    if (key.ctrl && key.name === "c") {
      renderer.destroy();
      process.exit(0);
    }

    if (screen() === "list") {
      handleListKeys(key);
      return;
    }

    if (screen() === "quiz") {
      handleQuizKeys(key);
    }
  });

  let lastGTime = 0;
  function isDoubleG() {
    const now = Date.now();
    const isDouble = now - lastGTime < 350;
    lastGTime = now;
    return isDouble;
  }

  function handleListKeys(key: { name: string; shift?: boolean }) {
    if (key.name === "q") {
      renderer.destroy();
      process.exit(0);
    }
    if (key.name === "g" && !key.shift && isDoubleG()) {
      quizSelect?.setSelectedIndex(0);
      return;
    }
    if (key.name === "g" && key.shift) {
      const last = props.quizzes.length - 1;
      if (last >= 0) quizSelect?.setSelectedIndex(last);
      return;
    }
    if (key.name === "enter" || key.name === "space" || key.name === "right" || key.name === "l") {
      startQuiz();
    }
  }

  function handleQuizKeys(key: { name: string; shift?: boolean }) {
    if (key.name === "q" || key.name === "escape") {
      setScreen("list");
      return;
    }
    if (key.name === "j" || key.name === "down") {
      moveAnswerCursor(1);
      return;
    }
    if (key.name === "k" || key.name === "up") {
      moveAnswerCursor(-1);
      return;
    }
    if (key.name === "space") {
      if (isMultiSelect()) {
        toggleCurrentChoice();
      } else {
        submitCurrentAnswer();
      }
      return;
    }
    if (key.name === "enter" || key.name === "return" || key.name === "linefeed") {
      submitCurrentAnswer();
      return;
    }
    if (key.name === "h" || key.name === "left" || key.name === "p") {
      goToQuestion(currentQuestionIndex() - 1);
      return;
    }
    if (key.name === "l" || key.name === "right" || key.name === "n") {
      goToQuestion(currentQuestionIndex() + 1);
      return;
    }
    if (key.name === "g" && !key.shift && isDoubleG()) {
      goToQuestion(0);
      return;
    }
    if (key.name === "g" && key.shift) {
      goToQuestion(questionCount() - 1);
      return;
    }
    if (key.name === "r") {
      resetQuiz();
      return;
    }
    if (key.name === "?" || (key.name === "/" && key.shift)) {
      toggleHint();
      return;
    }
    if (key.name === "e") {
      toggleExplanation();
      return;
    }
  }

  function startQuiz() {
    const nextQuiz = quiz();
    if (!nextQuiz) return;
    if (activeQuizId() !== nextQuiz.id) {
      resetQuiz();
      setActiveQuizId(nextQuiz.id);
    }
    setScreen("quiz");
    setCurrentQuestionIndex(0);
  }

  function resetQuiz() {
    setAnswers({});
    setCursorByQuestion({});
    setHintShownByQuestion({});
    setExplanationShownByQuestion({});
    setSubmittedByQuestion({});
    setCurrentQuestionIndex(0);
  }

  function goToQuestion(index: number) {
    const total = questionCount();
    if (!total) return;
    const clamped = Math.max(0, Math.min(total - 1, index));
    setCurrentQuestionIndex(clamped);
  }

  function toggleHint() {
    const idx = currentQuestionIndex();
    setHintShownByQuestion((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  function toggleExplanation() {
    const idx = currentQuestionIndex();
    setExplanationShownByQuestion((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }

  function handleAnswerChange(index: number) {
    const qIndex = currentQuestionIndex();
    setCursorByQuestion((prev) => ({ ...prev, [qIndex]: index }));
  }

  function handleAnswerSelect(index: number) {
    const qIndex = currentQuestionIndex();
    setCursorByQuestion((prev) => ({ ...prev, [qIndex]: index }));
    setAnswers((prev) => ({ ...prev, [qIndex]: [index] }));
  }

  function handleQuizChange(index: number) {
    setSelectedQuizIndex(index);
  }

  function moveAnswerCursor(delta: number) {
    const q = question();
    if (!q) return;
    const total = q.choices.length;
    if (!total) return;
    let next = currentCursor() + delta;
    if (next < 0) next = total - 1;
    if (next >= total) next = 0;
    handleAnswerChange(next);
  }

  function toggleCurrentChoice() {
    if (!isMultiSelect()) return;
    const q = question();
    if (!q) return;
    const qIndex = currentQuestionIndex();
    const index = Math.min(Math.max(0, currentCursor()), q.choices.length - 1);
    setAnswers((prev) => {
      const current = prev[qIndex] ?? [];
      const exists = current.includes(index);
      const next = exists ? current.filter((value) => value !== index) : [...current, index];
      return { ...prev, [qIndex]: next };
    });
    setSubmittedByQuestion((prev) => ({ ...prev, [qIndex]: false }));
    setExplanationShownByQuestion((prev) => ({ ...prev, [qIndex]: false }));
  }

  function submitCurrentAnswer() {
    const q = question();
    if (!q) return;
    const qIndex = currentQuestionIndex();
    const cursorIndex = Math.min(Math.max(0, currentCursor()), q.choices.length - 1);
    if (!isMultiSelect()) {
      handleAnswerSelect(cursorIndex);
    } else if (!answers()[qIndex]?.length) {
      handleAnswerSelect(cursorIndex);
    }
    setSubmittedByQuestion((prev) => ({ ...prev, [qIndex]: true }));
    setExplanationShownByQuestion((prev) => ({ ...prev, [qIndex]: true }));
  }

  function choiceFgColor(index: number) {
    const q = question();
    if (!q || !submitted()) return undefined;
    const answersForQuestion = currentAnswerIndices();
    if (q.answerIndices.includes(index)) return "#22c55e";
    if (answersForQuestion.includes(index)) return "#ef4444";
    return undefined;
  }

  function choiceBgColor(index: number) {
    return currentCursor() === index ? "#1f2937" : "black";
  }

  function questionStatus() {
    const q = question();
    if (!q || !submitted()) return "Unanswered";
    return isCorrectAnswer(q, currentAnswerIndices()) ? "Correct" : "Incorrect";
  }

  function answerStatusText() {
    const q = question();
    if (!q || !submitted()) {
      return isMultiSelect()
        ? "Select one or more answers, then press Enter to submit."
        : "Press Enter to submit the highlighted answer.";
    }
    const correct = isCorrectAnswer(q, currentAnswerIndices());
    const label = correct ? "Correct" : "Incorrect";
    return `${label}. Correct answer: ${choiceListLabel(q.answerIndices)}.`;
  }

  function isMultiSelect() {
    const q = question();
    return q ? q.answerIndices.length > 1 : false;
  }

  return (
    <box flexDirection="column" height="100%" width="100%" backgroundColor="black" padding={1} gap={1}>
      <box
        border
        borderStyle="rounded"
        borderColor="brightBlue"
        paddingX={2}
        paddingY={1}
        alignItems="center"
        justifyContent="space-between"
      >
        <box flexDirection="row" alignItems="center" gap={2}>
          <ascii_font font="tiny" text="Quiz My Ass" />
          <box flexDirection="column" justifyContent="center">
            <text attributes={TextAttributes.BOLD}>Terminal Quiz Console</text>
            <text attributes={TextAttributes.DIM}>
              Load quizzes from JSON, answer with vim keys, learn fast.
            </text>
          </box>
        </box>
        <box flexDirection="column" alignItems="flex-end">
          <text attributes={TextAttributes.DIM}>Quizzes: {props.quizzes.length}</text>
          <Show when={screen() === "quiz"}>
            <text attributes={TextAttributes.DIM}>
              Score: {score()}/{questionCount()}
            </text>
          </Show>
        </box>
      </box>

      <box width="100%" flexDirection="row" gap={1}>
        <Show when={screen() === "list"}>
          <box width="50%" border borderStyle="single" borderColor="brightBlack" padding={1}>
            <box flexDirection="column" gap={1}>
              <text attributes={TextAttributes.BOLD}>Select a quiz</text>
              <select
                ref={(el) => (quizSelect = el)}
                options={props.quizzes.map((quizItem) => ({
                  name: quizItem.title,
                  description: quizItem.description ?? "",
                }))}
                selectedIndex={selectedQuizIndex()}
                focused
                showDescription
                wrapSelection
                showScrollIndicator
                itemSpacing={1}
                keyBindings={[
                  { name: "j", action: "move-down" },
                  { name: "k", action: "move-up" },
                  { name: "down", action: "move-down" },
                  { name: "up", action: "move-up" },
                  { name: "enter", action: "select-current" },
                  { name: "space", action: "select-current" },
                ]}
                onChange={(index) => handleQuizChange(index)}
                onSelect={() => startQuiz()}
                height="100%"
              />
            </box>
          </box>
          <box width="50%" border borderStyle="single" borderColor="brightBlack" padding={1} gap={1}>
            <box flexDirection="column" gap={1}>
              <text attributes={TextAttributes.BOLD}>Details</text>
              <Show when={quiz()}>
                <text wrapMode="word">{quiz()?.description ?? "No description provided."}</text>
                <text attributes={TextAttributes.DIM}>
                  Questions: {quiz()?.questions.length ?? 0}
                </text>
                <text attributes={TextAttributes.DIM}>
                  Source: {quiz()?.sourcePath ?? "unknown"}
                </text>
              </Show>
              <Show when={!quiz()}>
                <text>No quizzes found. Add JSON files in the quizzes folder.</text>
              </Show>
              <Show when={props.errors.length}>
                <box flexDirection="column" gap={1} border borderStyle="single" borderColor="brightRed" padding={1}>
                  <text attributes={TextAttributes.BOLD}>Load warnings</text>
                  <For each={props.errors}>{(err) => <text wrapMode="word">{err}</text>}</For>
                </box>
              </Show>
            </box>
          </box>
        </Show>

        <Show when={screen() === "quiz" && quiz() && question()}>
          <box width="65%" border borderStyle="single" borderColor="brightBlack" padding={1} gap={1}>
            <box flexDirection="column" gap={1}>
              <text attributes={TextAttributes.BOLD}>
                {quiz()?.title} · Question {currentQuestionIndex() + 1} / {questionCount()}
              </text>
              <text wrapMode="word">{question()?.prompt}</text>
              <box flexDirection="column" gap={1} height="100%">
                <For each={question()?.choices ?? []}>
                  {(choice, index) => (
                    <box
                      backgroundColor={choiceBgColor(index())}
                      paddingX={1}
                      paddingY={0}
                      width="100%"
                    >
                      <text fg={choiceFgColor(index())}>
                        {currentCursor() === index() ? "▶ " : "  "}
                        {isMultiSelect() && (currentAnswerIndices().includes(index()) ? "[x]" : "[ ]")}{" "}
                        {choiceLabel(index())} {choice}
                      </text>
                    </box>
                  )}
                </For>
              </box>
            </box>
          </box>

          <box width="35%" flexDirection="column" gap={1}>
            <box border borderStyle="single" borderColor="brightBlack" padding={1} gap={1}>
              <box flexDirection="column" gap={1}>
                <text attributes={TextAttributes.BOLD}>Status</text>
                <text>{questionStatus()}</text>
                <text attributes={TextAttributes.DIM}>
                  Answered: {answeredCount()} / {questionCount()}
                </text>
              </box>
            </box>

            <box border borderStyle="single" borderColor="brightBlack" padding={1} gap={1}>
              <box flexDirection="column" gap={1}>
                <text attributes={TextAttributes.BOLD}>Hint</text>
                <Show when={hintShown()}>
                  <text wrapMode="word">{question()?.hint ?? "No hint available."}</text>
                </Show>
                <Show when={!hintShown()}>
                  <text attributes={TextAttributes.DIM}>Press ? to reveal a hint.</text>
                </Show>
              </box>
            </box>

            <box border borderStyle="single" borderColor="brightBlack" padding={1} gap={1}>
              <box flexDirection="column" gap={1}>
                <text attributes={TextAttributes.BOLD}>Explanation</text>
                <Show when={explanationShown()}>
                  <text wrapMode="word">{question()?.explanation ?? "No explanation provided."}</text>
                  <text attributes={TextAttributes.DIM}>{answerStatusText()}</text>
                </Show>
                <Show when={!explanationShown()}>
                  <text attributes={TextAttributes.DIM}>Press e to toggle explanation.</text>
                </Show>
              </box>
            </box>
          </box>
        </Show>
      </box>

      <box
        border
        borderStyle="single"
        borderColor="brightBlack"
        paddingX={2}
        paddingY={1}
        justifyContent="space-between"
      >
        <text attributes={TextAttributes.DIM}>
          List: j/k move · enter start · q quit
        </text>
        <text attributes={TextAttributes.DIM}>
          Quiz: j/k select · space toggle (multi) · enter submit · h/l/n/p prev/next · gg/G jump · ? hint · e explain · r reset · q back
        </text>
      </box>
    </box>
  );
}

function choiceLabel(index: number) {
  return String.fromCharCode(65 + index) + ")";
}

function choiceListLabel(indices: number[]) {
  return indices.map(choiceLabel).join(", ");
}

function isCorrectAnswer(question: QuizQuestion, selections: number[]) {
  const selected = normalizeSelection(selections);
  const correct = normalizeSelection(question.answerIndices);
  if (selected.length !== correct.length) return false;
  return selected.every((value, index) => value === correct[index]);
}

function normalizeSelection(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function loadQuizzes(): LoadResult {
  const quizDir = join(process.cwd(), "quizzes");
  const errors: string[] = [];

  if (!existsSync(quizDir)) {
    return { quizzes: [], errors: [`Missing quiz folder at ${quizDir}`] };
  }

  const files = readdirSync(quizDir).filter((file) => extname(file).toLowerCase() === ".json");
  const quizzes: Quiz[] = [];

  for (const file of files) {
    const filePath = join(quizDir, file);
    try {
      const raw = JSON.parse(readFileSync(filePath, "utf-8"));
      const quiz = normalizeQuiz(raw, filePath, errors);
      if (quiz) quizzes.push(quiz);
    } catch (err) {
      errors.push(`Failed to parse ${file}: ${String(err)}`);
    }
  }

  return { quizzes, errors };
}

function normalizeQuiz(raw: any, sourcePath: string, errors: string[]): Quiz | null {
  if (!raw || typeof raw !== "object") {
    errors.push(`Quiz ${sourcePath} is not a JSON object.`);
    return null;
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) {
    errors.push(`Quiz ${sourcePath} is missing a title.`);
    return null;
  }

  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : slugify(basename(sourcePath));
  const description = typeof raw.description === "string" ? raw.description.trim() : undefined;
  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];

  if (!rawQuestions.length) {
    errors.push(`Quiz ${title} has no questions.`);
    return null;
  }

  const questions: QuizQuestion[] = [];

  rawQuestions.forEach((q: any, index: number) => {
    const question = normalizeQuestion(q, index, title, errors);
    if (question) questions.push(question);
  });

  if (!questions.length) {
    errors.push(`Quiz ${title} has no valid questions.`);
    return null;
  }

  return { id, title, description, questions, sourcePath: sourcePath.replace(process.cwd(), ".") };
}

function normalizeQuestion(raw: any, index: number, quizTitle: string, errors: string[]): QuizQuestion | null {
  if (!raw || typeof raw !== "object") {
    errors.push(`Quiz ${quizTitle} question ${index + 1} is not an object.`);
    return null;
  }

  const prompt = typeof raw.prompt === "string" ? raw.prompt.trim() : "";
  if (!prompt) {
    errors.push(`Quiz ${quizTitle} question ${index + 1} is missing a prompt.`);
    return null;
  }

  const choices = Array.isArray(raw.choices) ? raw.choices.map(String) : [];
  if (choices.length < 2 || choices.length > 8) {
    errors.push(`Quiz ${quizTitle} question ${index + 1} must have 2-8 choices.`);
    return null;
  }

  const rawAnswerIndices = Array.isArray(raw.answerIndices) ? raw.answerIndices : null;
  const answerIndices = rawAnswerIndices
    ? rawAnswerIndices.map((value: any) => Number(value)).filter((value) => Number.isInteger(value))
    : [];
  const answerIndex = Number.isInteger(raw.answerIndex) ? raw.answerIndex : null;

  if (!answerIndices.length && answerIndex !== null) {
    answerIndices.push(answerIndex);
  }

  const normalizedAnswerIndices = normalizeSelection(answerIndices);
  const hasInvalidAnswer = !normalizedAnswerIndices.length || normalizedAnswerIndices.some((value) => {
    return value < 0 || value >= choices.length;
  });

  if (hasInvalidAnswer) {
    errors.push(`Quiz ${quizTitle} question ${index + 1} has invalid answerIndices.`);
    return null;
  }

  const hint = typeof raw.hint === "string" ? raw.hint.trim() : undefined;
  const explanation = typeof raw.explanation === "string" ? raw.explanation.trim() : undefined;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : `${slugify(quizTitle)}-q${index + 1}`;

  return { id, prompt, choices, answerIndices: normalizedAnswerIndices, hint, explanation };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
