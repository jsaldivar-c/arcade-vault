import { HallOfFame } from "@/components/hall-of-fame";
import { getAllGamesWithScores } from "@/lib/supabase/games";

export default async function SalonPage() {
  const entries = await getAllGamesWithScores(12);
  return <HallOfFame entries={entries} />;
}
