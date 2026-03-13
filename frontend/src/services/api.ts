const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api/v1';

export interface Experiment {
    id: string;
    name: string;
    status: 'draft' | 'active' | 'completed';
    created_at: string;
}

export const experimentApi = {
    list: async (): Promise<Experiment[]> => {
        const response = await fetch(`${API_BASE_URL}/experiments/`);
        if (!response.ok) {
            throw new Error('Failed to fetch experiments');
        }
        return response.json();
    }
};
