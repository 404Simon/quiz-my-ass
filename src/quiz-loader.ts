import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { normalizeSelection } from "./quiz-utils";
import type { LoadResult, Quiz, QuizQuestion } from "./types";

export function loadQuizzes(): LoadResult {
  const quizDir = join(process.cwd(), "quizzes");
  const errors: string[] = [];

  if (!existsSync(quizDir)) {
    return { quizzes: [], errors: [`Missing quiz folder at ${quizDir}`] };
  }

  const files = readdirSync(quizDir).filter((file) => extname(file).toLowerCase() === ".json");
  const quizzes: Quiz[] = [];

  for (const file of files) {
    const filePath = join(quizDir, file);
    try {
      const raw = JSON.parse(readFileSync(filePath, "utf-8"));
      const quiz = normalizeQuiz(raw, filePath, errors);
      if (quiz) quizzes.push(quiz);
    } catch (err) {
      errors.push(`Failed to parse ${file}: ${String(err)}`);
    }
  }

  return { quizzes, errors };
}

function normalizeQuiz(raw: unknown, sourcePath: string, errors: string[]): Quiz | null {
  if (!raw || typeof raw !== "object") {
    errors.push(`Quiz ${sourcePath} is not a JSON object.`);
    return null;
  }

  const quizData = raw as Record<string, unknown>;
  const title = typeof quizData.title === "string" ? quizData.title.trim() : "";
  if (!title) {
    errors.push(`Quiz ${sourcePath} is missing a title.`);
    return null;
  }

  const id =
    typeof quizData.id === "string" && quizData.id.trim()
      ? quizData.id.trim()
      : slugify(basename(sourcePath));
  const description = typeof quizData.description === "string" ? quizData.description.trim() : undefined;
  const rawQuestions = Array.isArray(quizData.questions) ? quizData.questions : [];

  if (!rawQuestions.length) {
    errors.push(`Quiz ${title} has no questions.`);
    return null;
  }

  const questions: QuizQuestion[] = [];

  rawQuestions.forEach((q, index) => {
    const question = normalizeQuestion(q, index, title, errors);
    if (question) questions.push(question);
  });

  if (!questions.length) {
    errors.push(`Quiz ${title} has no valid questions.`);
    return null;
  }

  return { id, title, description, questions, sourcePath: sourcePath.replace(process.cwd(), ".") };
}

function normalizeQuestion(raw: unknown, index: number, quizTitle: string, errors: string[]): QuizQuestion | null {
  if (!raw || typeof raw !== "object") {
    errors.push(`Quiz ${quizTitle} question ${index + 1} is not an object.`);
    return null;
  }

  const questionData = raw as Record<string, unknown>;
  const prompt = typeof questionData.prompt === "string" ? questionData.prompt.trim() : "";
  if (!prompt) {
    errors.push(`Quiz ${quizTitle} question ${index + 1} is missing a prompt.`);
    return null;
  }

  const choices = Array.isArray(questionData.choices) ? questionData.choices.map(String) : [];
  if (choices.length < 2 || choices.length > 8) {
    errors.push(`Quiz ${quizTitle} question ${index + 1} must have 2-8 choices.`);
    return null;
  }

  const rawAnswerIndices = Array.isArray(questionData.answerIndices) ? questionData.answerIndices : null;
  const answerIndices = rawAnswerIndices
    ? rawAnswerIndices.map((value) => Number(value)).filter((value) => Number.isInteger(value))
    : [];
  const answerIndex = Number.isInteger(questionData.answerIndex) ? (questionData.answerIndex as number) : null;

  if (!answerIndices.length && answerIndex !== null) {
    answerIndices.push(answerIndex);
  }

  const normalizedAnswerIndices = normalizeSelection(answerIndices);
  const hasInvalidAnswer =
    !normalizedAnswerIndices.length ||
    normalizedAnswerIndices.some((value) => value < 0 || value >= choices.length);

  if (hasInvalidAnswer) {
    errors.push(`Quiz ${quizTitle} question ${index + 1} has invalid answerIndices.`);
    return null;
  }

  const hint = typeof questionData.hint === "string" ? questionData.hint.trim() : undefined;
  const explanation =
    typeof questionData.explanation === "string" ? questionData.explanation.trim() : undefined;
  const id =
    typeof questionData.id === "string" && questionData.id.trim()
      ? questionData.id.trim()
      : `${slugify(quizTitle)}-q${index + 1}`;

  return { id, prompt, choices, answerIndices: normalizedAnswerIndices, hint, explanation };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
