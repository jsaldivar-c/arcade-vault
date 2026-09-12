"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("email not confirmed")) {
    return "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.";
  }
  if (lower.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (lower.includes("already registered")) {
    return "Ese correo ya está registrado.";
  }
  if (
    lower.includes("duplicate") ||
    lower.includes("database error saving new user")
  ) {
    return "Ese usuario ya existe, elige otro.";
  }
  return message;
}

export function AuthForm() {
  const router = useRouter();
  const { logout } = useSession();
  const [supabase] = useState(() => createClient());
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const changeTab = (next: "in" | "up") => {
    setTab(next);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (tab === "up") {
      const username = user.trim();
      if (username.length < 3 || username.length > 20) {
        setError("El usuario debe tener entre 3 y 20 caracteres.");
        return;
      }
      setLoading(true);
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: pass,
        options: {
          data: { username },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setLoading(false);
      if (signUpError) {
        setError(translateAuthError(signUpError.message));
        return;
      }
      setCheckEmail(true);
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    setLoading(false);
    if (signInError) {
      setError(translateAuthError(signInError.message));
      return;
    }
    router.push("/");
  };

  const playAsGuest = async () => {
    await logout();
    router.push("/");
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(translateAuthError(oauthError.message));
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Ingresa tu correo para recuperar tu contraseña.");
      return;
    }
    setError(null);
    setResetLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      { redirectTo: `${window.location.origin}/auth/reset-password` },
    );
    setResetLoading(false);
    if (resetError) {
      setError(translateAuthError(resetError.message));
      return;
    }
    setResetSent(true);
  };

  if (resetSent) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          <div className="auth-header">
            <div className="mark" />
            <h2 className="neon-cyan">REVISA TU CORREO</h2>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--ink-faint)",
                letterSpacing: "0.16em",
                marginTop: 6,
              }}
            >
              RECUPERA EL ACCESO A TU CUENTA
            </div>
          </div>

          <div
            className="mono"
            style={{
              textAlign: "center",
              padding: "24px 8px",
              color: "var(--ink-dim)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Te enviamos un enlace para restablecer tu contraseña a{" "}
            <strong>{email}</strong>. Ábrelo para elegir una nueva.
          </div>

          <button
            className="btn ghost"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => setResetSent(false)}
          >
            VOLVER
          </button>
        </div>
      </div>
    );
  }

  if (checkEmail) {
    return (
      <div className="av-auth-wrap fade-in">
        <div className="auth-card">
          <div className="auth-header">
            <div className="mark" />
            <h2 className="neon-cyan">REVISA TU CORREO</h2>
            <div
              className="mono"
              style={{
                fontSize: 11,
                color: "var(--ink-faint)",
                letterSpacing: "0.16em",
                marginTop: 6,
              }}
            >
              CONFIRMA TU CUENTA PARA ENTRAR AL VAULT
            </div>
          </div>

          <div
            className="mono"
            style={{
              textAlign: "center",
              padding: "24px 8px",
              color: "var(--ink-dim)",
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            Te enviamos un enlace de confirmación a <strong>{email}</strong>.
            Ábrelo para activar tu cuenta y luego inicia sesión.
          </div>

          <button
            className="btn ghost"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => setCheckEmail(false)}
          >
            VOLVER
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={tab === "in" ? "on" : ""}
            onClick={() => changeTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            type="button"
            className={tab === "up" ? "on" : ""}
            onClick={() => changeTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit}>
          {tab === "up" && (
            <div className="field slide-in">
              <label>Usuario</label>
              <input
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="px_kai"
              />
            </div>
          )}
          <div className="field">
            <label>Correo electrónico</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {tab === "in" && (
            <div style={{ textAlign: "right", marginTop: -4, marginBottom: 4 }}>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="mono"
                style={{
                  background: "none",
                  border: 0,
                  padding: 0,
                  fontSize: 11,
                  color: "var(--cyan)",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                {resetLoading ? "ENVIANDO…" : "¿Olvidaste tu contraseña?"}
              </button>
            </div>
          )}

          {error && (
            <div
              className="mono"
              style={{ color: "var(--magenta)", fontSize: 11, marginTop: 8 }}
            >
              ▸ {error}
            </div>
          )}

          <button
            className="btn lg"
            type="submit"
            disabled={loading}
            style={{ width: "100%", marginTop: 8 }}
          >
            {loading
              ? "PROCESANDO…"
              : tab === "in"
                ? "ENTRAR AL VAULT"
                : "CREAR Y JUGAR"}
          </button>
        </form>

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={playAsGuest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            onClick={() => handleOAuth("google")}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => handleOAuth("github")}
          >
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
