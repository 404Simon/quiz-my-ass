import type { QuizQuestion } from "./types";

export function choiceLabel(index: number) {
  return String.fromCharCode(65 + index) + ")";
}

export function choiceListLabel(indices: number[]) {
  return indices.map(choiceLabel).join(", ");
}

export function isCorrectAnswer(question: QuizQuestion, selections: number[]) {
  const selected = normalizeSelection(selections);
  const correct = normalizeSelection(question.answerIndices);
  if (selected.length !== correct.length) return false;
  return selected.every((value, index) => value === correct[index]);
}

export function normalizeSelection(values: number[]) {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}
