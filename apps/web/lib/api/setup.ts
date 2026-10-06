import { apiRequest } from "@/lib/api/client";

/** Réglages serveur modifiables pendant l'installation (mêmes clés que l'administration). */
export interface ServerSettings {
  gameSpeed: number;
  fleetSpeed: number;
  resourceMultiplier: number;
  buildingCostMultiplier: number;
  researchCostMultiplier: number;
  shipCostMultiplier: number;
  planetSize: number;
  maxBuildingLevel: number;
  maxTechnologyLevel: number;
  baseMetal: number;
  baseCrystal: number;
  baseDeuterium: number;
}

export interface SetupState {
  completed: false;
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    username: string;
    fromEmail: string;
    fromName: string;
    passwordSet: boolean;
    passwordUnreadable: boolean;
    configured: boolean;
    tested: boolean;
  };
  settings: { saved: boolean; values: ServerSettings };
  admin: { username: string; email: string; verified: boolean } | null;
}

export interface SetupSmtpPayload {
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  password?: string;
  fromEmail?: string;
  fromName?: string;
}

const withToken = (token: string): RequestInit => ({ headers: { "x-setup-token": token } });

/** Public : faut-il proposer le parcours d'installation ? */
export function getSetupStatus() {
  return apiRequest<{ setupRequired: boolean }>("/setup/status");
}

export function getSetupState(token: string) {
  return apiRequest<SetupState>("/setup/state", withToken(token));
}

export function saveSetupSmtp(token: string, payload: SetupSmtpPayload) {
  return apiRequest<SetupState>("/setup/smtp", { ...withToken(token), method: "PUT", body: JSON.stringify(payload) });
}

export function testSetupSmtp(token: string, to: string) {
  return apiRequest<{ success: boolean; to: string }>("/setup/smtp/test", {
    ...withToken(token),
    method: "POST",
    body: JSON.stringify({ to }),
  });
}

export function saveSetupSettings(token: string, payload: Partial<ServerSettings>) {
  return apiRequest<SetupState>("/setup/settings", { ...withToken(token), method: "PUT", body: JSON.stringify(payload) });
}

export function createSetupAdmin(token: string, payload: { username: string; email: string; password: string }) {
  return apiRequest<SetupState>("/setup/admin", { ...withToken(token), method: "POST", body: JSON.stringify(payload) });
}

export function resendSetupAdmin(token: string) {
  return apiRequest<{ message: string }>("/setup/admin/resend", { ...withToken(token), method: "POST" });
}
