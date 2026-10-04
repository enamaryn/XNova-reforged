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

function syncAccessTokenCookie(token: string | null) {
  if (typeof document === "undefined") return;
  if (!token) {
    document.cookie =
      "xnova_access=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    return;
  }
  document.cookie = `xnova_access=${token}; path=/; SameSite=Lax`;
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
    (set) => ({
      user: null,
      tokens: null,
      status: "idle",
      remember: false,
      setUser: (user) => set({ user }),
      setTokens: (tokens) => {
        syncAccessTokenCookie(tokens?.accessToken ?? null);
        set({ tokens });
      },
      setStatus: (status) => set({ status }),
      setRemember: (remember) => set({ remember }),
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
        syncAccessTokenCookie(state?.tokens?.accessToken ?? null);
      },
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        remember: state.remember,
      }),
    }
  )
);
