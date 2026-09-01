import type { Metadata } from "next";
import { Library } from "@/components/library";

export const metadata: Metadata = {
  title: "Biblioteca · Arcade Vault",
};

export default function BibliotecaPage() {
  return <Library />;
}
