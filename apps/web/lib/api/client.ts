import { useAuthStore } from "@/lib/stores/auth-store";
import type { ApiErrorPayload } from "@/lib/api/types";
import { resolveApiBaseUrl } from "@/lib/api/base-url";

const ENV_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export function getApiBaseUrl() {
  return resolveApiBaseUrl(
    ENV_API_BASE_URL,
    typeof window !== "undefined" ? window.location : undefined,
  );
}

export class ApiError extends Error {
  status: number;
  payload?: ApiErrorPayload;

  constructor(message: string, status: number, payload?: ApiErrorPayload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

function resolveErrorMessage(payload?: ApiErrorPayload) {
  if (!payload) return "Une erreur est survenue.";
  if (Array.isArray(payload.message)) return payload.message.join(" ");
  if (typeof payload.message === "string") return payload.message;
  return "Une erreur est survenue.";
}

async function parseError(response: Response) {
  let payload: ApiErrorPayload | undefined;
  try {
    payload = (await response.json()) as ApiErrorPayload;
  } catch {
    payload = undefined;
  }
  const message = resolveErrorMessage(payload);
  return new ApiError(message, response.status, payload);
}

// Un seul rafraichissement a la fois : le refresh token est a usage unique (rotation, SEC-03)
let refreshInFlight: Promise<{ accessToken: string; refreshToken: string } | null> | null = null;

function refreshAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = doRefreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefreshAccessToken() {
  const { tokens, setTokens, reset } = useAuthStore.getState();
  if (!tokens?.refreshToken) {
    reset();
    return null;
  }

  const response = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      reset();
      return null;
    }
    throw await parseError(response);
  }

  const data = (await response.json()) as { accessToken: string; refreshToken: string };
  const nextTokens = {
    accessToken: data.accessToken,
    // Le serveur fait tourner le refresh token : conserver le nouveau
    refreshToken: data.refreshToken ?? tokens.refreshToken,
  };
  setTokens(nextTokens);
  return nextTokens;
}

interface RequestOptions extends RequestInit {
  auth?: boolean;
  retry?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}) {
  const { auth = false, retry = true, ...fetchOptions } = options;
  const headers = new Headers(fetchOptions.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (auth) {
    const accessToken = useAuthStore.getState().tokens?.accessToken;
    if (accessToken) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...fetchOptions,
      headers,
    });
  } catch {
    // Réseau coupé, API injoignable, contenu mixte ou CORS refusé : le navigateur ne donne aucun détail
    throw new ApiError(
      "Impossible de joindre le serveur. Vérifiez votre connexion ou réessayez dans un instant.",
      0,
    );
  }

  if (response.status === 401 && auth && retry) {
    const tokens = await refreshAccessToken();
    if (tokens?.accessToken) {
      return apiRequest<T>(path, { ...options, retry: false });
    }
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await response.json()) as T;
}

/**
 * Client API avec méthodes HTTP
 */
export const apiClient = {
  get: <T>(path: string, options: Omit<RequestOptions, 'method'> = {}) =>
    apiRequest<T>(path, { ...options, method: 'GET', auth: true }),

  post: <T>(path: string, data?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    apiRequest<T>(path, {
      ...options,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
      auth: true,
    }),

  put: <T>(path: string, data?: unknown, options: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    apiRequest<T>(path, {
      ...options,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
      auth: true,
    }),

  delete: <T>(path: string, options: Omit<RequestOptions, 'method'> = {}) =>
    apiRequest<T>(path, { ...options, method: 'DELETE', auth: true }),
};
