import { spawnSync } from "node:child_process";

type ClipboardResult = {
  ok: boolean;
  method: string;
  error?: string;
};

export function copyQuestionTextToClipboard(prompt: string, choices: string[], choiceLabel: (index: number) => string) {
  const text = [
    prompt,
    "",
    ...choices.map((choice, index) => `${choiceLabel(index)} ${choice}`),
  ].join("\n");
  return copyToClipboard(text);
}

function copyToClipboard(text: string): ClipboardResult {
  const attempts: Array<[string, string[]]> = [];
  if (process.platform === "darwin") attempts.push(["pbcopy", []]);
  if (process.env.WAYLAND_DISPLAY) attempts.push(["wl-copy", []]);
  if (process.env.DISPLAY) {
    attempts.push(["xclip", ["-selection", "clipboard"]]);
    attempts.push(["xsel", ["--clipboard", "--input"]]);
  }
  if (process.platform === "win32") attempts.push(["clip", []]);

  let lastError: string | undefined;
  for (const [command, args] of attempts) {
    const result = spawnSync(command, args, { input: text, encoding: "utf-8" });
    if (!result.error && result.status === 0) {
      if (command === "xclip" && !verifyXclipClipboard(text)) {
        lastError = "xclip verification failed";
        continue;
      }
      if (command === "xsel" && !verifyXselClipboard(text)) {
        lastError = "xsel verification failed";
        continue;
      }
      const oscOk = tryOsc52(text);
      return { ok: true, method: oscOk ? `${command}+osc52` : command };
    }
    if (result.error) lastError = result.error.message;
  }

  if (tryOsc52(text)) return { ok: true, method: "osc52" };
  return { ok: false, method: "none", error: lastError ?? "no clipboard tool available" };
}

function verifyXclipClipboard(expected: string) {
  const result = spawnSync("xclip", ["-selection", "clipboard", "-o"], { encoding: "utf-8" });
  if (result.error || result.status !== 0 || typeof result.stdout !== "string") return false;
  return result.stdout.replace(/\r\n/g, "\n") === expected;
}

function verifyXselClipboard(expected: string) {
  const result = spawnSync("xsel", ["--clipboard", "--output"], { encoding: "utf-8" });
  if (result.error || result.status !== 0 || typeof result.stdout !== "string") return false;
  return result.stdout.replace(/\r\n/g, "\n") === expected;
}

function tryOsc52(text: string) {
  if (!process.stdout.isTTY) return false;
  const payload = Buffer.from(text, "utf-8").toString("base64");
  const sequence = `\u001b]52;c;${payload}\u0007`;
  try {
    process.stdout.write(sequence);
    return true;
  } catch {
    return false;
  }
}
