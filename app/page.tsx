import type { Metadata } from "next";
import { Home } from "@/components/home";

export const metadata: Metadata = {
  title: "Arcade Vault · El arcade clásico está de vuelta",
};

export default function HomePage() {
  return <Home />;
}
