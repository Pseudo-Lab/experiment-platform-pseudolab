export interface DashboardWindow {
  from: string;
  to: string;
  timezone: 'Asia/Seoul';
}

export interface GitHubOverviewResponse {
  generated_at: string;
  window: DashboardWindow;
  summary: {
    push_events: number;
    pr_opened: number;
    pr_merged: number;
    issue_comments: number;
    pr_reviews: number;
    merge_rate_28d: number | null;
    total_core_events: number;
    active_contributors: number;
  };
  timeseries: Array<{
    date: string;
    events: number;
    merge_rate: number | null;
  }>;
  top_repos: Array<{
    repo_name: string;
    events: number;
    ratio: number;
  }>;
}

export interface DiscordOverviewResponse {
  generated_at: string;
  window: DashboardWindow;
  summary: {
    message_count: number;
    active_authors: number;
    active_channels: number;
  };
  timeseries: Array<{
    date: string;
    messages: number;
  }>;
  top_channels: Array<{
    channel: string;
    messages: number;
  }>;
  top_authors: Array<{
    author: string;
    messages: number;
  }>;
}
