export type DashboardLang = 'en' | 'ko';

export interface DashboardKpiItem {
  id: 'active_experiments' | 'total_experiments' | 'draft_experiments' | 'completion_rate';
  label: string;
  value: string;
  changeText?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export interface DashboardTrendPoint {
  date: string;
  value: number;
}

export interface DashboardRankingItem {
  experimentId: string;
  experimentName: string;
  status: 'draft' | 'active' | 'completed';
  createdAt: string;
}

export interface DashboardData {
  kpis: DashboardKpiItem[];
  trend: DashboardTrendPoint[];
  ranking: DashboardRankingItem[];
}
