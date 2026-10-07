import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface Planet {
  id: string;
  name: string;
  galaxy: number;
  system: number;
  position: number;
}

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  points: number;
  rank: number;
  role?: string;
  createdAt: string;
  planets?: Planet[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

type AuthStatus = "idle" | "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  status: AuthStatus;
  remember: boolean;
  setUser: (user: AuthUser | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setStatus: (status: AuthStatus) => void;
  setRemember: (remember: boolean) => void;
  reset: () => void;
}

function syncAccessTokenCookie(tokens: AuthTokens | null, remember = false) {
  if (typeof document === "undefined") return;
  if (!tokens) {
    document.cookie =
      "xnova_access=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    return;
  }
  let maxAge = '';
  if (remember) {
    try {
      const payload = tokens.refreshToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const expires = Number(JSON.parse(atob(payload)).exp);
      if (Number.isFinite(expires)) maxAge = `; Max-Age=${Math.max(0, Math.floor(expires - Date.now() / 1000))}`;
    } catch { /* Un jeton invalide sera refusé par l’API à la restauration. */ }
  }
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `xnova_access=${tokens.accessToken}; path=/; SameSite=Lax${secure}${maxAge}`;
}

/**
 * Stockage de session : « Se souvenir de moi » conserve la session dans localStorage (persistante) ;
 * sinon elle reste dans sessionStorage (survit aux rechargements de l'onglet, disparaît à sa fermeture).
 * Auparavant, sans « se souvenir », les jetons n'étaient jamais écrits : tout rechargement complet
 * (dont la redirection après inscription ou connexion) renvoyait le joueur à la page de connexion.
 */
const sessionAwareStorage = {
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name) ?? sessionStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      const remember = JSON.parse(value)?.state?.remember === true;
      const target = remember ? localStorage : sessionStorage;
      const other = remember ? sessionStorage : localStorage;
      target.setItem(name, value);
      other.removeItem(name);
    } catch {
      // Stockage indisponible (navigation privée, quota) : la session reste en mémoire
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
      sessionStorage.removeItem(name);
    } catch {
      // ignoré
    }
  },
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      tokens: null,
      status: "idle",
      remember: false,
      setUser: (user) => set({ user }),
      setTokens: (tokens) => {
        syncAccessTokenCookie(tokens, get().remember);
        set({ tokens });
      },
      setStatus: (status) => set({ status }),
      setRemember: (remember) => {
        set({ remember });
        syncAccessTokenCookie(get().tokens, remember);
      },
      reset: () => {
        syncAccessTokenCookie(null);
        set({
          user: null,
          tokens: null,
          status: "unauthenticated",
          remember: false,
        });
      },
    }),
    {
      name: "xnova-auth",
      storage: createJSONStorage(() => sessionAwareStorage),
      onRehydrateStorage: () => (state) => {
        syncAccessTokenCookie(state?.tokens ?? null, state?.remember);
      },
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        remember: state.remember,
      }),
    }
  )
);
