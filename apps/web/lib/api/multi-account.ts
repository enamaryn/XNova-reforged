import { apiClient } from "./client";

export interface MultiAccountConfig {
  enforceRegistration: boolean;
  maxAccountsPerIp: number;
  ipWindowDays: number;
  blockLinkedTransfers: boolean;
  retentionDays: number;
}

export type LinkReason = { type: "ip" | "email"; value: string };

export interface LinkedUser {
  id: string;
  username: string;
  email: string;
  role: string;
  createdAt: string;
  lastActive: string;
  bannedUntil: string | null;
}

export interface LinkedPair {
  a: string;
  b: string;
  reasons: LinkReason[];
  exempt: boolean;
  exemptionReason: string | null;
}

export interface LinkedGroup {
  users: LinkedUser[];
  pairs: LinkedPair[];
  /** Au moins une paire n'est pas encore exemptée. */
  open: boolean;
}

export interface MultiAccountOverview {
  config: MultiAccountConfig;
  defaults: MultiAccountConfig;
  groups: LinkedGroup[];
  openGroups: number;
}

export const multiAccountApi = {
  overview: () => apiClient.get<MultiAccountOverview>("/admin/multi-account"),
  update: (config: MultiAccountConfig) => apiClient.put<MultiAccountOverview>("/admin/multi-account/config", config),
  reset: () => apiClient.delete<MultiAccountOverview>("/admin/multi-account/config"),
  addExemption: (userA: string, userB: string, reason: string) =>
    apiClient.post<MultiAccountOverview>("/admin/multi-account/exemptions", { userA, userB, reason }),
  removeExemption: (userA: string, userB: string) =>
    apiClient.delete<MultiAccountOverview>("/admin/multi-account/exemptions", { body: JSON.stringify({ userA, userB }) }),
};
