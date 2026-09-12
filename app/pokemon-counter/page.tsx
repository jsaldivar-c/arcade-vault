import type { Metadata } from "next";
import { PokemonCounter } from "@/components/pokemon-counter";

export const metadata: Metadata = {
  title: "Contador Pokémon · Arcade Vault",
};

export default function PokemonCounterPage() {
  return <PokemonCounter />;
}
