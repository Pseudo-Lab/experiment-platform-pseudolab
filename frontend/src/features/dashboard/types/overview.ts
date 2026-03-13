export type DashboardLang = 'en' | 'ko';

export interface DashboardAlert {
  code: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  action_url?: string;
}

export interface DashboardOverviewResponse {
  generated_at: string;
  window: { from: string; to: string; timezone: 'Asia/Seoul' };
  summary: {
    active_projects_count: number;
    weekly_active_contributors: number;
    weekly_collab_events: number;
    pr_merge_rate_28d: number | null;
    pipeline_freshness_hours: number;
  };
  timeseries: Array<{
    date: string;
    core_activity: number;
    communication: number;
    merge_rate: number | null;
    is_partial_period?: boolean;
  }>;
  distribution: {
    top_repos_by_activity: Array<{ repo_name: string; events: number; ratio: number }>;
    activity_concentration_top3: number;
  };
  health: {
    coverage_score: number;
    missing_day_ratio_30d: number;
    schema_violation_count: number;
  };
  alerts: DashboardAlert[];
}
