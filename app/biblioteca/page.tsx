import type { Metadata } from "next";
import { Library } from "@/components/library";
import { getGames } from "@/lib/supabase/games";

export const metadata: Metadata = {
  title: "Biblioteca · Arcade Vault",
};

export default async function BibliotecaPage() {
  const games = await getGames();
  return <Library games={games} />;
}
