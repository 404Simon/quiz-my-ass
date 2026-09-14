import type { SelectRenderable } from "@opentui/core";
import { TextAttributes } from "@opentui/core";
import { useKeyboard } from "@opentui/solid";
import { createMemo, createSignal, onCleanup, Show } from "solid-js";
import { copyQuestionTextToClipboard } from "./clipboard";
import { ListScreen } from "./components/list-screen";
import { QuizScreen } from "./components/quiz-screen";
import { SettingsScreen } from "./components/settings-screen";
import { Toast } from "./components/toast";
import { choiceLabel, choiceListLabel, isCorrectAnswer } from "./quiz-utils";
import type { Quiz } from "./types";

type AppProps = {
  quizzes: Quiz[];
  errors: string[];
  onQuit: () => void;
};

type KeyInput = {
  name: string;
  shift?: boolean;
  ctrl?: boolean;
  eventType?: string;
};

type ToastState = {
  message: string;
  tone: "success" | "error";
};

export function App(props: AppProps) {
  const [screen, setScreen] = createSignal<"list" | "quiz" | "settings">("list");
  const [settingsReturnScreen, setSettingsReturnScreen] = createSignal<"list" | "quiz">("list");
  const [shuffleAnswers, setShuffleAnswers] = createSignal(true);
  const [choiceOrderByQuestion, setChoiceOrderByQuestion] = createSignal<Record<number, number[]>>({});
  const [selectedQuizIndex, setSelectedQuizIndex] = createSignal(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = createSignal(0);
  const [answers, setAnswers] = createSignal<Record<number, number[]>>({});
  const [cursorByQuestion, setCursorByQuestion] = createSignal<Record<number, number>>({});
  const [hintShownByQuestion, setHintShownByQuestion] = createSignal<Record<number, boolean>>({});
  const [explanationShownByQuestion, setExplanationShownByQuestion] = createSignal<Record<number, boolean>>({});
  const [submittedByQuestion, setSubmittedByQuestion] = createSignal<Record<number, boolean>>({});
  const [activeQuizId, setActiveQuizId] = createSignal<string | undefined>(undefined);
  const [toast, setToast] = createSignal<ToastState>({ message: "", tone: "success" });

  let quizSelect: SelectRenderable | undefined;
  let toastTimeout: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => {
    if (toastTimeout) clearTimeout(toastTimeout);
  });

  const quiz = createMemo(() => props.quizzes[selectedQuizIndex()]);
  const questionCount = createMemo(() => quiz()?.questions.length ?? 0);
  const question = createMemo(() => quiz()?.questions[currentQuestionIndex()]);
  const currentChoiceOrder = createMemo(() => {
    const q = question();
    if (!q) return [];
    return choiceOrderByQuestion()[currentQuestionIndex()] ?? q.choices.map((_, index) => index);
  });
  const currentAnswerIndices = createMemo(() => answers()[currentQuestionIndex()] ?? []);
  const hintShown = createMemo(() => hintShownByQuestion()[currentQuestionIndex()] ?? false);
  const explanationShown = createMemo(() => explanationShownByQuestion()[currentQuestionIndex()] ?? false);
  const submitted = createMemo(() => submittedByQuestion()[currentQuestionIndex()] ?? false);

  const currentCursor = createMemo(() => {
    const index = currentQuestionIndex();
    const savedCursor = cursorByQuestion()[index];
    const savedAnswer = answers()[index]?.[0];
    const savedAnswerPosition = savedAnswer === undefined
      ? undefined
      : currentChoiceOrder().indexOf(savedAnswer);
    return savedCursor ?? (savedAnswerPosition === -1 ? undefined : savedAnswerPosition) ?? 0;
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

  const headerLine = createMemo(() => {
    if (screen() === "quiz" || (screen() === "settings" && settingsReturnScreen() === "quiz")) {
      return `Quiz My Ass · ${currentQuestionIndex() + 1}/${questionCount()} · score ${score()}/${questionCount()}`;
    }
    return `Quiz My Ass · ${props.quizzes.length} quizzes`;
  });

  const footerLine = createMemo(() =>
    screen() === "list"
      ? "List: j/k move · enter start · gg/G jump · s settings · q quit"
      : screen() === "settings"
        ? "Settings: space/enter toggle · q/esc back"
        : "Quiz: j/k move · space toggle/select · enter submit · h/l prev/next · gg/G jump · yy copy · ? hint · e explain · r reset · s settings · q back",
  );

  useKeyboard((key) => {
    if (key.eventType === "release") return;
    if (key.ctrl && key.name === "c") {
      quitApp();
      return;
    }

    if (screen() === "list") {
      handleListKeys(key);
      return;
    }

    if (screen() === "quiz") {
      handleQuizKeys(key);
      return;
    }

    if (screen() === "settings") {
      handleSettingsKeys(key);
    }
  });

  let lastGTime = 0;
  let lastYTime = 0;

  function quitApp() {
    props.onQuit();
  }

  function isDoubleG() {
    const now = Date.now();
    const isDouble = now - lastGTime < 350;
    lastGTime = now;
    return isDouble;
  }

  function isDoubleY() {
    const now = Date.now();
    const isDouble = now - lastYTime < 350;
    lastYTime = now;
    return isDouble;
  }

  function handleListKeys(key: KeyInput) {
    if (key.name === "s") {
      openSettings("list");
      return;
    }
    if (key.name === "q") {
      quitApp();
      return;
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

  function handleQuizKeys(key: KeyInput) {
    if (key.name === "s") {
      openSettings("quiz");
      return;
    }
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
    if (key.name === "y" && isDoubleY()) {
      copyCurrentQuestionToClipboard();
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
    }
  }

  function openSettings(returnScreen: "list" | "quiz") {
    setSettingsReturnScreen(returnScreen);
    setScreen("settings");
  }

  function handleSettingsKeys(key: KeyInput) {
    if (key.name === "q" || key.name === "escape" || key.name === "left" || key.name === "h") {
      setScreen(settingsReturnScreen());
      return;
    }
    if (key.name === "space" || key.name === "enter" || key.name === "return") {
      setShuffleAnswers((enabled) => {
        const next = !enabled;
        createChoiceOrders(next);
        return next;
      });
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
    createChoiceOrders(shuffleAnswers());
  }

  function resetQuiz() {
    setAnswers({});
    setCursorByQuestion({});
    setHintShownByQuestion({});
    setExplanationShownByQuestion({});
    setSubmittedByQuestion({});
    setCurrentQuestionIndex(0);
    createChoiceOrders(shuffleAnswers());
  }

  function createChoiceOrders(shouldShuffle: boolean) {
    const quizValue = quiz();
    if (!quizValue) return;
    const orders: Record<number, number[]> = {};
    quizValue.questions.forEach((quizQuestion, questionIndex) => {
      const order = quizQuestion.choices.map((_, index) => index);
      if (shouldShuffle) {
        for (let index = order.length - 1; index > 0; index -= 1) {
          const swapIndex = Math.floor(Math.random() * (index + 1));
          [order[index], order[swapIndex]] = [order[swapIndex]!, order[index]!];
        }
      }
      orders[questionIndex] = order;
    });
    setChoiceOrderByQuestion(orders);
    setCursorByQuestion({});
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

  function showToast(message: string, tone: "success" | "error") {
    setToast({ message, tone });
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => setToast({ message: "", tone: "success" }), 1500);
  }

  function copyCurrentQuestionToClipboard() {
    const q = question();
    if (!q) return;
    const displayedChoices = currentChoiceOrder().map((index) => q.choices[index]!);
    const result = copyQuestionTextToClipboard(q.prompt, displayedChoices, choiceLabel);
    if (result.ok) {
      showToast(`Copied question (${result.method}).`, "success");
      return;
    }
    showToast(`Clipboard failed: ${result.error ?? "unknown error"}.`, "error");
  }

  function handleAnswerChange(index: number) {
    const qIndex = currentQuestionIndex();
    setCursorByQuestion((prev) => ({ ...prev, [qIndex]: index }));
  }

  function handleAnswerSelect(index: number) {
    const qIndex = currentQuestionIndex();
    setCursorByQuestion((prev) => ({ ...prev, [qIndex]: index }));
    const sourceIndex = currentChoiceOrder()[index];
    if (sourceIndex === undefined) return;
    setAnswers((prev) => ({ ...prev, [qIndex]: [sourceIndex] }));
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
      const sourceIndex = currentChoiceOrder()[index];
      if (sourceIndex === undefined) return prev;
      const exists = current.includes(sourceIndex);
      const next = exists ? current.filter((value) => value !== sourceIndex) : [...current, sourceIndex];
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
    const sourceIndex = currentChoiceOrder()[index];
    if (sourceIndex === undefined) return undefined;
    const shouldBeSelected = q.answerIndices.includes(sourceIndex);
    const isSelected = answersForQuestion.includes(sourceIndex);
    if (shouldBeSelected !== isSelected) return "#ef4444";
    if (shouldBeSelected) return "#22c55e";
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
        : "Press Enter to submit highlighted answer.";
    }
    const correct = isCorrectAnswer(q, currentAnswerIndices());
    const label = correct ? "Correct" : "Incorrect";
    const displayedCorrectIndices = q.answerIndices
      .map((sourceIndex) => currentChoiceOrder().indexOf(sourceIndex))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b);
    return `${label}. Correct answer: ${choiceListLabel(displayedCorrectIndices)}.`;
  }

  function isMultiSelect() {
    const q = question();
    return q ? q.answerIndices.length > 1 : false;
  }

  return (
    <box
      position="relative"
      flexDirection="column"
      height="100%"
      width="100%"
      backgroundColor="black"
      padding={1}
      gap={1}
    >
      <box
        border
        borderStyle="single"
        borderColor="brightBlue"
        paddingX={1}
        paddingTop={0}
        paddingBottom={1}
      >
        <text attributes={TextAttributes.BOLD} wrapMode="word">
          {headerLine()}
        </text>
      </box>

      <box width="100%" flexDirection="row" gap={1} flexGrow={1} minHeight={0}>
        <Show when={screen() === "list" || (screen() === "settings" && settingsReturnScreen() === "list")}>
          <ListScreen
            quizzes={props.quizzes}
            errors={props.errors}
            selectedQuizIndex={selectedQuizIndex()}
            selectedQuiz={quiz()}
            onQuizRef={(ref) => {
              quizSelect = ref;
            }}
            onChangeQuiz={(index) => setSelectedQuizIndex(index)}
            onStartQuiz={startQuiz}
          />
        </Show>

        <Show when={(screen() === "quiz" || (screen() === "settings" && settingsReturnScreen() === "quiz")) && quiz() && question()}>
          <QuizScreen
            quiz={quiz()}
            question={question()}
            currentQuestionIndex={currentQuestionIndex()}
            questionCount={questionCount()}
            answeredCount={answeredCount()}
            currentCursor={currentCursor()}
            currentAnswerIndices={currentAnswerIndices().map((sourceIndex) => currentChoiceOrder().indexOf(sourceIndex))}
            hintShown={hintShown()}
            explanationShown={explanationShown()}
            isMultiSelect={isMultiSelect()}
            questionStatus={questionStatus()}
            answerStatusText={answerStatusText()}
            choiceLabel={choiceLabel}
            choiceFgColor={choiceFgColor}
            choiceBgColor={choiceBgColor}
            choiceOrder={currentChoiceOrder()}
          />
        </Show>

        <Show when={screen() === "settings"}>
          <SettingsScreen shuffleAnswers={shuffleAnswers()} />
        </Show>
      </box>

      <box
        border
        borderStyle="single"
        borderColor="brightBlack"
        paddingX={1}
        paddingTop={0}
        paddingBottom={1}
      >
        <text attributes={TextAttributes.DIM} wrapMode="word">
          {footerLine()}
        </text>
      </box>

      <Toast message={toast().message} tone={toast().tone} />
    </box>
  );
}
