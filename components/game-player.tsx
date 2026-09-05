"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Game } from "@/lib/data";
import { useSession } from "@/lib/session";
import { saveScore } from "@/lib/scores";
import { AsteroidsCanvas } from "@/components/games/asteroids-canvas";

export function GamePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const { user } = useSession();
  const isAsteroids = game.id === "asteroids";

  const [score, setScore] = useState(0);
  const [lives] = useState(3);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(user?.name ?? "INVITADO");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [restartKey, setRestartKey] = useState(0);
  const [engineState, setEngineState] = useState({
    score: 0,
    lives: 3,
    level: 1,
  });

  // Sincroniza el nombre editable con la sesión la primera vez que se resuelve
  // (hidratación de localStorage), sin pisar lo que el jugador ya haya escrito.
  const [syncedUserName, setSyncedUserName] = useState(user?.name ?? null);
  if ((user?.name ?? null) !== syncedUserName) {
    setSyncedUserName(user?.name ?? null);
    setName(user?.name ?? "INVITADO");
  }

  const level = Math.floor(score / 2500) + 1;

  useEffect(() => {
    if (isAsteroids || over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [isAsteroids, over, paused]);

  const displayScore = isAsteroids ? engineState.score : score;
  const displayLives = isAsteroids ? engineState.lives : lives;
  const displayLevel = isAsteroids ? engineState.level : level;

  const endGame = () => {
    if (isAsteroids) setScore(engineState.score);
    setOver(true);
  };
  const restart = () => {
    setScore(0);
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveError(null);
    if (isAsteroids) {
      setEngineState({ score: 0, lives: 3, level: 1 });
      setRestartKey((k) => k + 1);
    }
  };
  const handleEngineGameOver = (finalScore: number) => {
    setScore(finalScore);
    setOver(true);
  };
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const { error } = await saveScore({ game: game.id, score, name });
    setSaving(false);
    if (error) {
      setSaveError(error);
      return;
    }
    setSaved(true);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{displayScore.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(displayLives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(displayLevel).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/juego/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isAsteroids ? (
            <AsteroidsCanvas
              paused={paused || over}
              restartKey={restartKey}
              onStateChange={setEngineState}
              onGameOver={handleEngineGameOver}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor" />
              <div className="enemy e1" />
              <div className="enemy e2" />
              <div className="enemy e3" />
              <div className="player-ship" />
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>{game.title} · CRT-83 · 60 HZ</span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                </button>
                {saveError && (
                  <div
                    className="mono"
                    style={{
                      color: "var(--magenta)",
                      fontSize: 11,
                      marginTop: 8,
                    }}
                  >
                    ▸ ERROR AL GUARDAR: {saveError}. INTENTA DE NUEVO.
                  </div>
                )}
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <button className="btn magenta" onClick={() => router.push("/")}>
                VOLVER AL VAULT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
