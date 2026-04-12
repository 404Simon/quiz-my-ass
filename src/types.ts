export type QuizQuestion = {
  id: string;
  prompt: string;
  choices: string[];
  answerIndices: number[];
  hint?: string;
  explanation?: string;
};

export type Quiz = {
  id: string;
  title: string;
  description?: string;
  questions: QuizQuestion[];
  sourcePath: string;
};

export type LoadResult = {
  quizzes: Quiz[];
  errors: string[];
};
