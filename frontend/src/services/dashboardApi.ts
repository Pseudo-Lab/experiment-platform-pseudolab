import type { DashboardOverviewResponse } from '@/features/dashboard/types/overview';
import type { DiscordOverviewResponse, GitHubOverviewResponse } from '@/features/dashboard/types/metrics';
import { API_BASE_URL, apiFetch } from './http';

export const dashboardApi = {
  overview: async (window: '30d' | '7d' = '30d'): Promise<DashboardOverviewResponse> => {
    const response = await apiFetch(`${API_BASE_URL}/dashboard/overview?window=${window}`);
    if (!response.ok) {
      throw new Error('Failed to fetch dashboard overview');
    }
    return response.json();
  },
  githubOverview: async (window: '30d' | '7d' = '30d'): Promise<GitHubOverviewResponse> => {
    const response = await apiFetch(`${API_BASE_URL}/dashboard/github/overview?window=${window}`);
    if (!response.ok) {
      throw new Error('Failed to fetch github overview');
    }
    return response.json();
  },
  discordOverview: async (window: '30d' | '7d' = '30d'): Promise<DiscordOverviewResponse> => {
    const response = await apiFetch(`${API_BASE_URL}/dashboard/discord/overview?window=${window}`);
    if (!response.ok) {
      throw new Error('Failed to fetch discord overview');
    }
    return response.json();
  },
};
