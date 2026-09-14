import { TextAttributes } from "@opentui/core";

type SettingsScreenProps = {
  shuffleAnswers: boolean;
};

export function SettingsScreen(props: SettingsScreenProps) {
  return (
    <box
      position="absolute"
      top={5}
      left="25%"
      zIndex={50}
      width="50%"
      border
      borderStyle="double"
      borderColor="brightBlue"
      backgroundColor="black"
      padding={1}
    >
      <box flexDirection="column" gap={1}>
        <text attributes={TextAttributes.BOLD}>Settings</text>
        <box backgroundColor="#1f2937" paddingX={1} width="100%">
          <text>
            ▶ [{props.shuffleAnswers ? "x" : " "}] Shuffle answers
          </text>
        </box>
        <text attributes={TextAttributes.DIM}>Space toggle · Esc close</text>
      </box>
    </box>
  );
}
