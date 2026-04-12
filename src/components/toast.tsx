import { Show } from "solid-js";

type ToastProps = {
  message: string;
  tone: "success" | "error";
};

export function Toast(props: ToastProps) {
  const isError = () => props.tone === "error";

  return (
    <Show when={props.message}>
      <box position="absolute" top={1} right={2} zIndex={100} border borderStyle="single" borderColor={isError() ? "brightRed" : "brightGreen"} backgroundColor="black" paddingX={2} paddingY={0} maxWidth="60%">
        <text fg={isError() ? "#fca5a5" : "#86efac"} wrapMode="word">
          {props.message}
        </text>
      </box>
    </Show>
  );
}
