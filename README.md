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

## Build

Build native executable(s):

```bash
bun scripts/build.ts --single
```

Use `--all` to build all targets in `scripts/build.ts`.
