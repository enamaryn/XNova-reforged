import { apiClient } from "./client";

export interface WorldEventEffects {
  productionBonus: number;
  marketTaxReduction: number;
}

export interface WorldEventView {
  id: string;
  kind: string;
  templateId: string | null;
  /** Nom d'un événement personnalisé ; null pour un modèle (nom traduit côté interface). */
  name: string | null;
  status: "ACTIVE" | "ENDED" | "CANCELLED";
  startsAt: string;
  endsAt: string;
  endedAt: string | null;
  auto: boolean;
  effects: WorldEventEffects;
}

export interface WorldEventTemplateView {
  id: string;
  kind: string;
  effects: WorldEventEffects;
  auto: boolean;
  phase: "active" | "reminder" | "later";
  year: number;
  startsAt: string;
  endsAt: string;
  launched: boolean;
  reminder: boolean;
}

export interface AdminWorldEvents {
  active: WorldEventView[];
  history: WorldEventView[];
  templates: WorldEventTemplateView[];
  reminders: number;
}

export const worldEventsApi = {
  active: () => apiClient.get<{ events: WorldEventView[]; effects: WorldEventEffects }>("/world-events/active"),
  admin: () => apiClient.get<AdminWorldEvents>("/admin/world-events"),
  launchTemplate: (body: { templateId: string; days?: number }) =>
    apiClient.post<WorldEventView>("/admin/world-events/launch-template", body),
  launchCustom: (body: { name: string; days: number; productionBonus?: number; marketTaxReduction?: number }) =>
    apiClient.post<WorldEventView>("/admin/world-events/launch-custom", body),
  setAuto: (templateId: string, auto: boolean) =>
    apiClient.put<{ templateId: string; auto: boolean }>(`/admin/world-events/templates/${encodeURIComponent(templateId)}/auto`, { auto }),
  end: (id: string) => apiClient.delete<WorldEventView>(`/admin/world-events/${id}`),
};
