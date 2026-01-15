import { apiClient } from './client';

export type CombatResult = 'attacker_win' | 'defender_win' | 'draw';

export interface CombatReportSummary {
  id: string;
  attackerId: string;
  defenderId: string;
  result: CombatResult;
  createdAt: string;
}

export interface CombatReportDetail {
  id: string;
  attackerId: string;
  defenderId: string;
  attackerShips: Record<string, number>;
  defenderShips: Record<string, number>;
  attackerLosses: Record<string, number>;
  defenderLosses: Record<string, number>;
  defenderDefs: Record<string, number>;
  result: CombatResult;
  rounds: number;
  timeline?: {
    round: number;
    attackerRemaining: Record<string, number>;
    defenderRemaining: Record<string, number>;
    attackerLosses: Record<string, number>;
    defenderLosses: Record<string, number>;
  }[];
  loot: {
    metal: number;
    crystal: number;
    deuterium: number;
  };
  debris: {
    metal: number;
    crystal: number;
  };
  createdAt: string;
}

export const reportsApi = {
  getReports: () => apiClient.get<CombatReportSummary[]>('/reports'),
  getReport: (reportId: string) => apiClient.get<CombatReportDetail>(`/reports/${reportId}`),
};
