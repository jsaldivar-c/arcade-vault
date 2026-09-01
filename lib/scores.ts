const STORAGE_KEY = "av_scores";

export interface SavedScore {
  game: string;
  score: number;
  name: string;
  at: number;
}

export function saveScore(entry: SavedScore): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: SavedScore[] = raw ? JSON.parse(raw) : [];
    all.push(entry);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // localStorage no disponible — la puntuación simplemente no persiste
  }
}
