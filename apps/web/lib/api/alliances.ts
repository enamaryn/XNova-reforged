import { apiClient } from "./client";

export interface AllianceUser {
  id: string;
  username: string;
  points: number;
  rank: number;
}

export interface AllianceMember {
  id: string;
  rank: string;
  joinedAt: string;
  user: AllianceUser;
}

export interface Alliance {
  id: string;
  tag: string;
  name: string;
  description?: string | null;
  founderId: string;
  createdAt: string;
  members: AllianceMember[];
}

export interface AllianceMembership {
  id: string;
  rank: string;
  joinedAt: string;
  alliance: Alliance;
}

export interface CreateAlliancePayload {
  tag: string;
  name: string;
  description?: string;
}

export interface InviteAlliancePayload {
  username: string;
}

export function getMyAlliance() {
  return apiClient.get<AllianceMembership | null>("/alliances/me");
}

export function getAlliance(allianceId: string) {
  return apiClient.get<Alliance>(`/alliances/${allianceId}`);
}

export function createAlliance(payload: CreateAlliancePayload) {
  return apiClient.post<Alliance>("/alliances/create", payload);
}

export function inviteAllianceMember(allianceId: string, payload: InviteAlliancePayload) {
  return apiClient.post<{ success: boolean }>(`/alliances/${allianceId}/invite`, payload);
}

export function joinAlliance(allianceId: string) {
  return apiClient.post<{ id: string; rank: string; joinedAt: string }>(
    `/alliances/${allianceId}/join`,
  );
}

export function leaveAlliance(allianceId: string) {
  return apiClient.delete<{ success: boolean }>(`/alliances/${allianceId}/leave`);
}
