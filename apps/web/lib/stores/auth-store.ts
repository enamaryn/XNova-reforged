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
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        syncAccessTokenCookie(state?.tokens?.accessToken ?? null);
      },
      partialize: (state) => ({
        user: state.user,
        tokens: state.remember ? state.tokens : null,
        remember: state.remember,
      }),
    }
  )
);
