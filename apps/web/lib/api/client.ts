import { useAuthStore } from "@/lib/stores/auth-store";
import type { ApiErrorPayload } from "@/lib/api/types";

const DEFAULT_API_BASE_URL = "http://localhost:3001";
const ENV_API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export function getApiBaseUrl() {
  if (ENV_API_BASE_URL) {
    try {
      const url = new URL(ENV_API_BASE_URL);
      if (typeof window !== "undefined") {
        const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
        if (isLocalhost) {
          const port = url.port || "3001";
          return `${url.protocol}//${window.location.hostname}:${port}`;
        }
      }
      return ENV_API_BASE_URL;
    } catch {
      return ENV_API_BASE_URL;
    }
  }

  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }

  return DEFAULT_API_BASE_URL;
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
  } catch (error) {
    payload = undefined;
  }
  const message = resolveErrorMessage(payload);
  return new ApiError(message, response.status, payload);
}

async function refreshAccessToken() {
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
    reset();
    return null;
  }

  const data = (await response.json()) as { accessToken: string };
  const nextTokens = {
    accessToken: data.accessToken,
    refreshToken: tokens.refreshToken,
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

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...fetchOptions,
    headers,
  });

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
