"use client";

import { createContext, useCallback, useContext, useSyncExternalStore, type ReactNode } from "react";

const STORAGE_KEY = "av_user";

export interface SessionUser {
  name: string;
}

type Listener = () => void;
const listeners = new Set<Listener>();

let cachedRaw: string | null = null;
let cachedUser: SessionUser | null = null;

function readUser(): SessionUser | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    try {
      cachedUser = raw ? JSON.parse(raw) : null;
    } catch {
      cachedUser = null;
    }
  }
  return cachedUser;
}

function getServerSnapshot(): SessionUser | null {
  return null;
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function writeUser(user: SessionUser | null) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage no disponible (modo privado, etc.) — la sesión sigue funcionando en memoria
  }
  listeners.forEach((listener) => listener());
}

interface SessionContextValue {
  user: SessionUser | null;
  login: (name: string) => void;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(subscribe, readUser, getServerSnapshot);

  const login = useCallback((name: string) => writeUser({ name }), []);
  const logout = useCallback(() => writeUser(null), []);

  return (
    <SessionContext.Provider value={{ user, login, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de un SessionProvider");
  return ctx;
}
