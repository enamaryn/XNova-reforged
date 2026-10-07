import { apiClient } from "./client";

export interface AdminConfig {
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

export interface AdminOverview {
  players: number;
  alliances: number;
  planets: number;
  onlinePlayers: number;
  serverTime: string;
}

export interface AdminPlayerSummary {
  id: string;
  username: string;
  email: string;
  role: string;
  emailVerifiedAt: string | null;
  points: number;
  rank: number;
  planets: number;
  lastActive: string;
  banned: boolean;
  bannedUntil: string | null;
}

export interface AdminPlayerDetail extends Omit<AdminPlayerSummary, 'planets'> {
  mustVerifyEmail: boolean;
  createdAt: string;
  banReason: string | null;
  technologies: { id: number; name: string; level: number }[];
  planets: {
    id: string;
    name: string;
    coordinates: string;
    resources: { metal: number; crystal: number; deuterium: number };
    energy: { produced: number; used: number };
    fields: { used: number; max: number };
    lastUpdate: string;
    buildings: { id: number; name: string; level: number }[];
  }[];
}

export function getAdminPlayers(search = '', page = 1) {
  return apiClient.get<{ players: AdminPlayerSummary[]; total: number; page: number; pageSize: number }>(`/admin/players?${new URLSearchParams({ search, page: String(page) })}`);
}

export function getAdminPlayer(id: string) {
  return apiClient.get<AdminPlayerDetail>(`/admin/players/${id}`);
}

export function updatePlayerEmail({ id, email }: { id: string; email: string }) {
  return apiClient.put<{ success: boolean; message: string }>(`/admin/players/${id}/email`, { email });
}

export interface AdminAuditLog {
  id: string;
  action: string;
  changes: unknown;
  createdAt: string;
  user: {
    id: string;
    username: string;
  };
}

export interface AdminBanLog {
  id: string;
  action: string;
  reason?: string | null;
  expiresAt?: string | null;
  createdAt: string;
  user: {
    id: string;
    username: string;
  };
  actor: {
    id: string;
    username: string;
  };
}

export interface UpdateRolePayload {
  username: string;
  role: "PLAYER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
}

export interface BanUserPayload {
  username: string;
  reason?: string;
  days?: number;
  hours?: number;
  minutes?: number;
}

export interface UnbanUserPayload {
  username: string;
  reason?: string;
}

export interface BoostDevelopmentPayload {
  username: string;
}

export interface BoostDevelopmentResult {
  success: boolean;
  username: string;
  buildingLevel: number;
  technologyLevel: number;
  planetsUpdated: number;
  technologiesUpdated: number;
}

export function getAdminConfig() {
  return apiClient.get<AdminConfig>("/admin/config");
}

export function updateAdminConfig(payload: Partial<AdminConfig>) {
  return apiClient.put<AdminConfig>("/admin/config", payload);
}

export function getAdminOverview() {
  return apiClient.get<AdminOverview>("/admin/overview");
}

export function updateUserRole(payload: UpdateRolePayload) {
  return apiClient.put<{ id: string; username: string; role: string }>(
    "/admin/roles",
    payload,
  );
}

export function boostDevelopment(payload: BoostDevelopmentPayload) {
  return apiClient.put<BoostDevelopmentResult>("/admin/boost-development", payload);
}

export function banUser(payload: BanUserPayload) {
  return apiClient.put<{ success: boolean; expiresAt: string | null }>(
    "/admin/ban",
    payload,
  );
}

export function unbanUser(payload: UnbanUserPayload) {
  return apiClient.put<{ success: boolean }>("/admin/unban", payload);
}

export function getAuditLogs(limit = 30) {
  return apiClient.get<AdminAuditLog[]>(`/admin/audit?limit=${limit}`);
}

export function getBanLogs(limit = 30) {
  return apiClient.get<AdminBanLog[]>(`/admin/ban-logs?limit=${limit}`);
}

export interface SmtpSettings {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string;
  passwordSet: boolean;
  passwordUnreadable: boolean;
}

export interface UpdateSmtpPayload {
  enabled?: boolean;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  fromEmail?: string;
  fromName?: string;
  /** Absent : le mot de passe enregistré est conservé. */
  password?: string;
  clearPassword?: boolean;
}

export function getSmtpSettings() {
  return apiClient.get<SmtpSettings>("/admin/smtp");
}

export function updateSmtpSettings(payload: UpdateSmtpPayload) {
  return apiClient.put<SmtpSettings>("/admin/smtp", payload);
}

export function sendSmtpTest(to?: string) {
  return apiClient.post<{ success: boolean; to: string }>("/admin/smtp/test", to ? { to } : {});
}
