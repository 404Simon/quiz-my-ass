import { TextAttributes } from "@opentui/core";
import type { SelectRenderable } from "@opentui/core";
import { For, Show } from "solid-js";
import type { Quiz } from "../types";

type ListScreenProps = {
  quizzes: Quiz[];
  errors: string[];
  selectedQuizIndex: number;
  selectedQuiz?: Quiz;
  onQuizRef: (ref: SelectRenderable | undefined) => void;
  onChangeQuiz: (index: number) => void;
  onStartQuiz: () => void;
};

export function ListScreen(props: ListScreenProps) {
  return (
    <>
      <box width="50%" border borderStyle="single" borderColor="brightBlack" padding={1}>
        <box flexDirection="column" gap={1}>
          <text attributes={TextAttributes.BOLD}>Select quiz</text>
          <select
            ref={(el) => props.onQuizRef(el)}
            options={props.quizzes.map((quizItem) => ({
              name: quizItem.title,
              description: quizItem.description ?? "",
            }))}
            selectedIndex={props.selectedQuizIndex}
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
            onChange={(index) => props.onChangeQuiz(index)}
            onSelect={props.onStartQuiz}
            height="100%"
          />
        </box>
      </box>

      <box width="50%" border borderStyle="single" borderColor="brightBlack" padding={1} gap={1}>
        <box flexDirection="column" gap={1}>
          <text attributes={TextAttributes.BOLD}>Details</text>
          <Show when={props.selectedQuiz}>
            <text wrapMode="word">{props.selectedQuiz?.description ?? "No description provided."}</text>
            <text attributes={TextAttributes.DIM}>Questions: {props.selectedQuiz?.questions.length ?? 0}</text>
            <text attributes={TextAttributes.DIM}>Source: {props.selectedQuiz?.sourcePath ?? "unknown"}</text>
          </Show>
          <Show when={!props.selectedQuiz}>
            <text>No quizzes found. Add JSON files in quizzes folder.</text>
          </Show>
          <Show when={props.errors.length}>
            <box flexDirection="column" gap={1} border borderStyle="single" borderColor="brightRed" padding={1}>
              <text attributes={TextAttributes.BOLD}>Load warnings</text>
              <For each={props.errors}>{(err) => <text wrapMode="word">{err}</text>}</For>
            </box>
          </Show>
        </box>
      </box>
    </>
  );
}
