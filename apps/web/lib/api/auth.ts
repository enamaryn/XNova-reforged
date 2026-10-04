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

export async function logout() {
  // Revoque la session cote serveur (meilleur effort), puis nettoie l'etat local
  try {
    await apiRequest("/auth/logout", { method: "POST", auth: true, retry: false });
  } catch {
    // Session deja expiree ou serveur injoignable : on deconnecte quand meme localement
  }
  useAuthStore.getState().reset();
}

function applyAuthResponse(data: AuthResponseDto) {
  const store = useAuthStore.getState();
  store.setUser(data.user);
  store.setTokens(data.tokens);
  store.setStatus("authenticated");
}

export interface MessageResponse {
  message: string;
}

export function forgotPassword(email: string) {
  return apiRequest<MessageResponse>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string) {
  return apiRequest<MessageResponse>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export function verifyEmail(token: string) {
  return apiRequest<MessageResponse & { type: "verify_email" | "change_email" }>(
    "/auth/verify-email",
    { method: "POST", body: JSON.stringify({ token }) },
  );
}

export function resendVerification() {
  return apiRequest<MessageResponse>("/auth/resend-verification", {
    method: "POST",
    auth: true,
    retry: false,
  });
}

export function changePassword(currentPassword: string, newPassword: string) {
  return apiRequest<MessageResponse>("/auth/change-password", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function changeEmail(currentPassword: string, newEmail: string) {
  return apiRequest<MessageResponse>("/auth/change-email", {
    method: "POST",
    auth: true,
    body: JSON.stringify({ currentPassword, newEmail }),
  });
}
