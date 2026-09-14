import { createCliRenderer } from "@opentui/core";
import { render } from "@opentui/solid";
import { App } from "./app";
import { loadQuizzes } from "./quiz-loader";

const loadResult = loadQuizzes();

async function main() {
  const renderer = await createCliRenderer();

  function quit() {
    renderer.destroy();
    process.exit(0);
  }

  render(
    () => <App quizzes={loadResult.quizzes} errors={loadResult.errors} onQuit={quit} />,
    renderer,
  );

  // TypeScript 7 currently loses Node's signal overloads when Bun augments Process.
  const onSignal = process.on.bind(process) as unknown as (
    signal: NodeJS.Signals,
    listener: () => void,
  ) => NodeJS.Process;
  onSignal("SIGINT", () => quit());
  onSignal("SIGTERM", () => quit());
}

main();
