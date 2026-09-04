import { notFound } from "next/navigation";
import { getGameWithScores } from "@/lib/supabase/games";
import { GamePlayer } from "@/components/game-player";

export default async function GamePlayerPage({
  params,
}: PageProps<"/juego/[id]/jugar">) {
  const { id } = await params;
  const result = await getGameWithScores(id);
  if (!result) notFound();

  return <GamePlayer game={result.game} />;
}
