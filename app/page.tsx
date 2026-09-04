import type { Metadata } from "next";
import { Home } from "@/components/home";
import { getGames } from "@/lib/supabase/games";

export const metadata: Metadata = {
  title: "Arcade Vault · El arcade clásico está de vuelta",
};

export default async function HomePage() {
  const games = await getGames();
  return <Home games={games} />;
}
