import { createCliRenderer } from "@opentui/core";
import { render } from "@opentui/solid";
import { App } from "./app";
import { loadQuizzes } from "./quiz-loader";

const loadResult = loadQuizzes();

async function main() {
  const renderer = await createCliRenderer();
  render(() => <App quizzes={loadResult.quizzes} errors={loadResult.errors} />, renderer);

  function quit() {
    renderer.destroy();
  }

  process.on("SIGINT", quit);
  process.on("SIGTERM", quit);
}

main();
