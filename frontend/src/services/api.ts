const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api/v1';

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';

export interface Variant {
  id: string;
  experiment_id: string;
  name: string;
  traffic_ratio: number;
  description?: string;
  created_at: string;
}

export interface Experiment {
  id: string;
  name: string;
  hypothesis?: string;
  status: ExperimentStatus;
  owner_id?: string;
  start_at?: string;
  end_at?: string;
  created_at: string;
  updated_at: string;
  variants: Variant[];
}

export interface ExperimentCreate {
  name: string;
  hypothesis?: string;
  owner_id?: string;
  variants: { name: string; traffic_ratio: number; description?: string }[];
}

export interface ExperimentUpdate {
  name?: string;
  hypothesis?: string;
  status?: ExperimentStatus;
}

export const experimentApi = {
  list: async (status?: ExperimentStatus): Promise<Experiment[]> => {
    const url = new URL(`${API_BASE_URL}/experiments/`, window.location.origin);
    if (status) url.searchParams.set('status', status);
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Failed to fetch experiments');
    return response.json();
  },

  get: async (id: string): Promise<Experiment> => {
    const response = await fetch(`${API_BASE_URL}/experiments/${id}`);
    if (!response.ok) throw new Error('Failed to fetch experiment');
    return response.json();
  },

  create: async (data: ExperimentCreate): Promise<Experiment> => {
    const response = await fetch(`${API_BASE_URL}/experiments/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create experiment');
    return response.json();
  },

  update: async (id: string, data: ExperimentUpdate): Promise<Experiment> => {
    const response = await fetch(`${API_BASE_URL}/experiments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update experiment');
    return response.json();
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/experiments/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete experiment');
  },
};

export type BugCategory = 'ui' | 'functional' | 'performance' | 'feature_request' | 'other';
export type BugStatus = 'reported' | 'in_progress' | 'resolved';
export type BugSeverity = 'minor' | 'major' | 'critical';

export interface Attachment {
  name: string;
  key: string;
  type: string;
  url?: string;
}

export interface Comment {
  id: string;
  report_id: string;
  author?: string;
  content: string;
  created_at: string;
}

export interface BugReport {
  id: string;
  title: string;
  category: BugCategory;
  severity: BugSeverity;
  description?: string;
  status: BugStatus;
  attachments: Attachment[];
  comments: Comment[];
  created_at: string;
  updated_at: string;
}

export interface BugReportCreate {
  title: string;
  category: BugCategory;
  severity: BugSeverity;
  description?: string;
  attachment_keys: Attachment[];
}

export const bugReportApi = {
  list: async (status?: BugStatus): Promise<BugReport[]> => {
    const url = new URL(`${API_BASE_URL}/bug-reports/`, window.location.origin);
    if (status) url.searchParams.set('status', status);
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error('Failed to fetch bug reports');
    return response.json();
  },

  get: async (id: string): Promise<BugReport> => {
    const response = await fetch(`${API_BASE_URL}/bug-reports/${id}`);
    if (!response.ok) throw new Error('Failed to fetch bug report');
    return response.json();
  },

  create: async (data: BugReportCreate): Promise<BugReport> => {
    const response = await fetch(`${API_BASE_URL}/bug-reports/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create bug report');
    return response.json();
  },

  update: async (id: string, data: Partial<{ status: BugStatus; severity: BugSeverity; title: string; description: string }>): Promise<BugReport> => {
    const response = await fetch(`${API_BASE_URL}/bug-reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update bug report');
    return response.json();
  },

  addComment: async (id: string, content: string, author?: string): Promise<BugReport> => {
    const response = await fetch(`${API_BASE_URL}/bug-reports/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, author }),
    });
    if (!response.ok) throw new Error('Failed to add comment');
    return response.json();
  },

  uploadAttachment: async (file: File): Promise<Attachment> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/bug-reports/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload attachment');
    return response.json();
  },

  delete: async (id: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/bug-reports/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete bug report');
  },
};
