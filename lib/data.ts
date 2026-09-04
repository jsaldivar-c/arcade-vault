// Tipos de Arcade Vault — migrado de references/templates/data.jsx

export type CategoryFilter =
  "TODOS" | "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
export type GameColor = "cyan" | "magenta" | "yellow" | "green";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: Exclude<CategoryFilter, "TODOS">;
  cover: string;
  color: GameColor;
  best: number;
  plays: number;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string;
}

export const CATS: CategoryFilter[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];
