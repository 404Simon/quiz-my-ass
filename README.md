# Quiz My Ass

Terminal quiz app built with Bun + OpenTUI + Solid. Load quizzes from JSON, run through questions fast with keyboard, get instant correctness feedback.

## Features

- Read all quizzes in `quizzes/`
- Single- and Multiple-choice questions
- Per-question hint and explanation toggles
- Vim-style navigation (`j/k`, `h/l`, `gg`, `G`) plus arrow keys
- Copy current question to clipboard with `yy`

## Quiz Format

Each file in `quizzes/` must be JSON like:

```json
{
  "id": "my-quiz",
  "title": "My Quiz",
  "description": "Optional",
  "questions": [
    {
      "id": "q1",
      "prompt": "Question text",
      "choices": ["A", "B"],
      "answerIndex": 0,
      "hint": "Optional",
      "explanation": "Optional"
    }
  ]
}
```

Notes:
- Use `answerIndex` for single choice or `answerIndices` for multi-select.
- Choice count must be 2-8.

## Run

```bash
bun install
bun dev
```

## Test

```bash
bun test
```

Use the `bun run test` script (or `bun test --preload @opentui/solid/preload`).
Bun does not apply `bunfig.toml`'s top-level `preload` to the test runner, and it
refuses to accept `preload` in both `bunfig.toml` and a `[test]` section, so the
script passes it explicitly. Without it `solid-js` resolves to its SSR build and
every test fails with `Orphan text error`.

Layout:

| Path | What it covers |
|------|----------------|
| `src/quiz-utils.test.ts` | Answer scoring and choice labels |
| `src/quiz-loader.test.ts` | Quiz file validation, plus a check that everything in `quizzes/` loads cleanly |
| `src/app.test.tsx` | Keyboard-driven UI on OpenTUI's in-memory test renderer |
| `test/fixtures.ts` | Small in-memory quizzes, so a quiz-data edit cannot fail a UI test |
| `test/harness.tsx` | `mountApp`, key helpers, and frame readers |

UI tests drive the real terminal input parser via `mockInput`, so `escape`,
arrows, and chords like `gg` are covered. They do not cover `yy`, which shells
out to `wl-copy`/`xclip`/`xsel` and emits an OSC 52 escape, because the result
depends on the host's clipboard tools.

## Build

Build native executable(s):

```bash
bun scripts/build.ts --single
```

Use `--all` to build all targets in `scripts/build.ts`.
