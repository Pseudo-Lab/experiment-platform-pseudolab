import type { DashboardOverviewResponse } from '@/features/dashboard/types/overview';
import type { DiscordOverviewResponse, GitHubOverviewResponse } from '@/features/dashboard/types/metrics';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api/v1';

export const dashboardApi = {
  overview: async (window: '30d' | '7d' = '30d'): Promise<DashboardOverviewResponse> => {
    const response = await fetch(`${API_BASE_URL}/dashboard/overview?window=${window}`);
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard overview');
    }
    return response.json();
  },
  githubOverview: async (window: '30d' | '7d' = '30d'): Promise<GitHubOverviewResponse> => {
    const response = await fetch(`${API_BASE_URL}/dashboard/github/overview?window=${window}`);
    if (!response.ok) {
      throw new Error('Failed to fetch github overview');
    }
    return response.json();
  },
  discordOverview: async (window: '30d' | '7d' = '30d'): Promise<DiscordOverviewResponse> => {
    const response = await fetch(`${API_BASE_URL}/dashboard/discord/overview?window=${window}`);
    if (!response.ok) {
      throw new Error('Failed to fetch discord overview');
    }
    return response.json();
  },
};
