import { apiRequest } from "@/lib/api/client";
import type { AuthResponseDto, AuthUserDto } from "@/lib/api/types";
import { useAuthStore } from "@/lib/stores/auth-store";

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export async function login(payload: LoginPayload) {
  const data = await apiRequest<AuthResponseDto>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  applyAuthResponse(data);
  return data;
}

export async function register(payload: RegisterPayload) {
  const data = await apiRequest<AuthResponseDto>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  applyAuthResponse(data);
  return data;
}

export async function getMe() {
  return apiRequest<AuthUserDto>("/auth/me", { auth: true });
}

export function logout() {
  useAuthStore.getState().reset();
}

function applyAuthResponse(data: AuthResponseDto) {
  const store = useAuthStore.getState();
  store.setUser(data.user);
  store.setTokens(data.tokens);
  store.setStatus("authenticated");
}
