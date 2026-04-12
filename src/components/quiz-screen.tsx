import { TextAttributes } from "@opentui/core";
import { For, Show } from "solid-js";
import type { Quiz, QuizQuestion } from "../types";

type QuizScreenProps = {
  quiz?: Quiz;
  question?: QuizQuestion;
  currentQuestionIndex: number;
  questionCount: number;
  answeredCount: number;
  currentCursor: number;
  currentAnswerIndices: number[];
  hintShown: boolean;
  explanationShown: boolean;
  isMultiSelect: boolean;
  questionStatus: string;
  answerStatusText: string;
  choiceLabel: (index: number) => string;
  choiceFgColor: (index: number) => string | undefined;
  choiceBgColor: (index: number) => string;
};

export function QuizScreen(props: QuizScreenProps) {
  return (
    <>
      <box width="65%" border borderStyle="single" borderColor="brightBlack" padding={1} gap={1}>
        <box flexDirection="column" gap={1}>
          <text attributes={TextAttributes.BOLD}>
            {props.quiz?.title} · Question {props.currentQuestionIndex + 1} / {props.questionCount}
          </text>
          <text wrapMode="word">{props.question?.prompt}</text>
          <box flexDirection="column" gap={1} height="100%">
            <For each={props.question?.choices ?? []}>
              {(choice, index) => (
                <box backgroundColor={props.choiceBgColor(index())} paddingX={1} width="100%">
                  <text fg={props.choiceFgColor(index())}>
                    {props.currentCursor === index() ? "▶ " : "  "}
                    {props.isMultiSelect && (props.currentAnswerIndices.includes(index()) ? "[x]" : "[ ]")} {" "}
                    {props.choiceLabel(index())} {choice}
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
            <text>{props.questionStatus}</text>
            <text attributes={TextAttributes.DIM}>
              Answered: {props.answeredCount} / {props.questionCount}
            </text>
          </box>
        </box>

        <box border borderStyle="single" borderColor="brightBlack" padding={1} gap={1}>
          <box flexDirection="column" gap={1}>
            <text attributes={TextAttributes.BOLD}>Hint</text>
            <Show when={props.hintShown}>
              <text wrapMode="word">{props.question?.hint ?? "No hint available."}</text>
            </Show>
            <Show when={!props.hintShown}>
              <text attributes={TextAttributes.DIM}>Press ? to reveal hint.</text>
            </Show>
          </box>
        </box>

        <box border borderStyle="single" borderColor="brightBlack" padding={1} gap={1}>
          <box flexDirection="column" gap={1}>
            <text attributes={TextAttributes.BOLD}>Explanation</text>
            <Show when={props.explanationShown}>
              <text wrapMode="word">{props.question?.explanation ?? "No explanation provided."}</text>
              <text attributes={TextAttributes.DIM}>{props.answerStatusText}</text>
            </Show>
            <Show when={!props.explanationShown}>
              <text attributes={TextAttributes.DIM}>Press e to toggle explanation.</text>
            </Show>
          </box>
        </box>
      </box>
    </>
  );
}
