"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const MIN_ID = 1;
const MAX_ID = 1025;

interface PokemonData {
  id: number;
  name: string;
  sprite: string;
  types: string[];
}

interface PokeApiResponse {
  id: number;
  name: string;
  sprites: {
    front_default: string | null;
    other: {
      "official-artwork": {
        front_default: string | null;
      };
    };
  };
  types: { type: { name: string } }[];
}

interface FetchResult {
  requestId: number;
  data: PokemonData | null;
  error: string | null;
}

export function PokemonCounter() {
  const [count, setCount] = useState(MIN_ID);
  const [retryKey, setRetryKey] = useState(0);
  const [result, setResult] = useState<FetchResult | null>(null);

  const requestId = count * 1000 + retryKey;
  const loading = result?.requestId !== requestId;

  useEffect(() => {
    const controller = new AbortController();

    fetch(`https://pokeapi.co/api/v2/pokemon/${count}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("No se encontró ese Pokémon.");
        return res.json() as Promise<PokeApiResponse>;
      })
      .then((data) => {
        setResult({
          requestId,
          error: null,
          data: {
            id: data.id,
            name: data.name,
            sprite:
              data.sprites.other["official-artwork"].front_default ??
              data.sprites.front_default ??
              "",
            types: data.types.map((t) => t.type.name),
          },
        });
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResult({
          requestId,
          data: null,
          error: "No se pudo cargar el Pokémon. Intenta de nuevo.",
        });
      });

    return () => controller.abort();
  }, [count, requestId]);

  const pokemon = !loading ? (result?.data ?? null) : null;
  const error = !loading ? (result?.error ?? null) : null;
  const atMin = count <= MIN_ID;
  const atMax = count >= MAX_ID;

  return (
    <div className="fade-in mx-auto flex max-w-xl flex-col items-center gap-8 px-4 py-16 text-center">
      <div>
        <div className="pixel neon-yellow text-[11px] tracking-[0.24em]">
          ▸ CONTADOR POKÉMON
        </div>
        <h1 className="pixel mt-3 text-[clamp(22px,4vw,34px)] tracking-[0.05em] text-ink">
          UNO EN UNO, POKÉMON POR POKÉMON
        </h1>
      </div>

      <div className="pixel neon-cyan text-[clamp(48px,10vw,80px)] leading-none">
        {count}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          className="btn ghost"
          onClick={() => setCount((c) => Math.max(MIN_ID, c - 1))}
          disabled={atMin}
        >
          ◀ ANTERIOR
        </button>
        <button
          className="btn magenta"
          onClick={() => setCount(MIN_ID)}
          disabled={count === MIN_ID}
        >
          REINICIAR
        </button>
        <button
          className="btn"
          onClick={() => setCount((c) => Math.min(MAX_ID, c + 1))}
          disabled={atMax}
        >
          SIGUIENTE ▶
        </button>
      </div>

      <div className="flex min-h-[340px] w-full flex-col items-center justify-center gap-4 border border-[var(--line)] bg-bg-2 p-8">
        {loading && (
          <p className="pixel neon-yellow flicker text-xs">CARGANDO...</p>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center gap-3">
            <p className="pixel neon-magenta text-xs">{error}</p>
            <button
              className="btn ghost"
              onClick={() => setRetryKey((k) => k + 1)}
            >
              REINTENTAR
            </button>
          </div>
        )}

        {!loading && !error && pokemon && (
          <>
            <div className="relative h-48 w-48">
              {pokemon.sprite ? (
                <Image
                  src={pokemon.sprite}
                  alt={pokemon.name}
                  fill
                  sizes="192px"
                  className="object-contain [image-rendering:pixelated]"
                  priority
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-ink-faint">
                  SIN IMAGEN
                </div>
              )}
            </div>
            <div className="pixel text-lg tracking-[0.06em] text-ink">
              #{String(pokemon.id).padStart(3, "0")}{" "}
              {pokemon.name.toUpperCase()}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {pokemon.types.map((type) => (
                <span
                  key={type}
                  className="pixel border border-[var(--line-2)] px-2 py-1 text-[9px] tracking-[0.1em] text-ink-dim"
                >
                  {type.toUpperCase()}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
