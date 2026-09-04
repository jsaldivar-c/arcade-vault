import { createClient } from "@/lib/supabase/server";
import type { Game, ScoreRow } from "@/lib/data";

interface GameRow {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: string;
  cover: string;
  color: string;
}

interface ScoreDbRow {
  player_name: string;
  score: number;
  created_at: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${d.getUTCFullYear()}`;
}

function toGame(row: GameRow, scores: { score: number }[]): Game {
  return {
    id: row.id,
    title: row.title,
    short: row.short,
    long: row.long,
    cat: row.cat as Game["cat"],
    cover: row.cover,
    color: row.color as Game["color"],
    best: scores.length > 0 ? Math.max(...scores.map((s) => s.score)) : 0,
    plays: scores.length,
  };
}

function toScoreRows(scores: ScoreDbRow[], limit: number): ScoreRow[] {
  return [...scores]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s, i) => ({
      rank: i + 1,
      name: s.player_name,
      score: s.score,
      date: formatDate(s.created_at),
    }));
}

export async function getGames(): Promise<Game[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select("id, title, short, long, cat, cover, color, scores(score)");

  if (error) throw new Error(error.message);

  return (data as (GameRow & { scores: { score: number }[] })[]).map((row) =>
    toGame(row, row.scores ?? []),
  );
}

export async function getGameWithScores(
  id: string,
  limit = 10,
): Promise<{ game: Game; scores: ScoreRow[] } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(
      "id, title, short, long, cat, cover, color, scores(player_name, score, created_at)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as GameRow & { scores: ScoreDbRow[] };
  const scores = row.scores ?? [];

  return {
    game: toGame(row, scores),
    scores: toScoreRows(scores, limit),
  };
}

export async function getAllGamesWithScores(
  limit = 12,
): Promise<{ game: Game; scores: ScoreRow[] }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("games")
    .select(
      "id, title, short, long, cat, cover, color, scores(player_name, score, created_at)",
    );

  if (error) throw new Error(error.message);

  return (data as (GameRow & { scores: ScoreDbRow[] })[]).map((row) => {
    const scores = row.scores ?? [];
    return {
      game: toGame(row, scores),
      scores: toScoreRows(scores, limit),
    };
  });
}
