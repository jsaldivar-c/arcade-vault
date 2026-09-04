import { createClient } from "@/lib/supabase/client";

export interface NewScore {
  game: string;
  score: number;
  name: string;
}

export async function saveScore(
  entry: NewScore,
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.from("scores").insert({
    game_id: entry.game,
    player_name: entry.name,
    score: entry.score,
  });

  return { error: error?.message ?? null };
}
