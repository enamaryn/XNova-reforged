import { apiClient, apiRequest } from "./client";

export type SupportKind = "bug" | "question" | "suggestion" | "account";
export type SupportStatus = "new" | "seen" | "resolved" | "ignored";

export const SUPPORT_KINDS: SupportKind[] = ["bug", "question", "suggestion", "account"];
export const SUPPORT_STATUSES: SupportStatus[] = ["new", "seen", "resolved", "ignored"];
/** Mêmes bornes que l'API (`packages/game-config/src/support.ts`). */
export const SUPPORT_LIMITS = { subjectMin: 3, subjectMax: 120, bodyMin: 10, bodyMax: 4000, replyMax: 2000 } as const;

export interface SupportReportInput {
  kind: SupportKind;
  subject: string;
  body: string;
  pagePath?: string;
  appVersion?: string;
}

export interface SupportReplyView {
  id: string;
  body: string;
  createdAt: string;
}

export interface MySupportReport {
  id: string;
  kind: SupportKind;
  subject: string;
  status: SupportStatus;
  createdAt: string;
  replies: SupportReplyView[];
}

export interface AdminSupportReport {
  id: string;
  kind: SupportKind;
  subject: string;
  body: string;
  pagePath: string | null;
  appVersion: string | null;
  userAgent: string | null;
  status: SupportStatus;
  createdAt: string;
  resolvedAt: string | null;
  user: { id: string; username: string; email: string };
  replies: (SupportReplyView & { author: string | null })[];
}

export interface AdminSupportList {
  page: number;
  pageSize: number;
  total: number;
  newCount: number;
  items: AdminSupportReport[];
}

export const supportApi = {
  create: (input: SupportReportInput) => apiClient.post<{ id: string; createdAt: string }>("/support/reports", input),
  mine: () => apiClient.get<MySupportReport[]>("/support/reports/mine"),
  adminList: (status: SupportStatus | "all", page: number) =>
    apiClient.get<AdminSupportList>(`/admin/support/reports?page=${page}${status === "all" ? "" : `&status=${status}`}`),
  reply: (id: string, body: string) =>
    apiClient.post<{ id: string; createdAt: string; status: SupportStatus }>(`/admin/support/reports/${encodeURIComponent(id)}/replies`, { body }),
  setStatus: (id: string, status: SupportStatus) =>
    apiRequest<{ id: string; status: SupportStatus }>(`/admin/support/reports/${encodeURIComponent(id)}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ status }),
    }),
};
