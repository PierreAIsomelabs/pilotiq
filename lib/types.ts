export interface Chunk {
  id: number;
  text: string;
  start: number;
}

export interface StoredDocument {
  id: string;
  name: string;
  text: string;
  pages: number;
  chunks: Chunk[];
  toc: string[];
  totalChars: number;
  indexedAt: string;
}

export interface Question {
  id: number;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
  topic: string;
  points?: number;
}

export interface SessionResult {
  type: "quiz" | "exam";
  score: number;
  total: number;
  date: string;
  topic: string;
  wrongTopics: string[];
}

export type Section = "theory" | "pratique" | "qt" | "flight-vision" | "parametres";
export type TheoryTab = "cours" | "exercices" | "qcm" | "examen";
