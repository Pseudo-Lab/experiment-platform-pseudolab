const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api/v1';

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';

// ────────────────────────────────────────────────────────────
// Experiment Result (Bayesian)
// ────────────────────────────────────────────────────────────
export interface VariantResult {
  variant_id: string;
  variant_name: string;
  users: number;
  conversions: number;
  rate: number;
}
export interface ExperimentResult {
  experiment_id: string;
  primary_metric: string | null;
  treatment: VariantResult | null;
  control: VariantResult | null;
  uplift: number | null;
  probability_treatment_wins: number | null;
  srm_warning: boolean;
  sample_size: number;
  message?: string;
}

// ────────────────────────────────────────────────────────────
// Decision & Learning Note
// ────────────────────────────────────────────────────────────
export type DecisionType = 'SHIP' | 'HOLD' | 'ROLLBACK';
export interface Decision {
  id: string;
  experiment_id: string;
  decision: DecisionType;
  reason: string;
  decided_by: string;
  decided_at: string;
}
export interface LearningNote {
  id: string;
  experiment_id: string;
  content: string;
  created_by?: string;
  created_at: string;
}

// ────────────────────────────────────────────────────────────
// Feature Flag
// ────────────────────────────────────────────────────────────
export interface FeatureFlag {
  flag_key: string;
  description?: string;
  rollout_pct: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}
export interface FeatureFlagCreate {
  flag_key: string;
  description?: string;
  rollout_pct?: number;
  enabled?: boolean;
}
export interface FeatureFlagUpdate {
  description?: string;
  rollout_pct?: number;
  enabled?: boolean;
}

// ────────────────────────────────────────────────────────────
// Analytics
// ────────────────────────────────────────────────────────────
export interface TrendPoint { date: string; count: number; }
export interface TrendsResponse { event_name: string; granularity: string; data: TrendPoint[]; }
export interface FunnelStep { step: string; users: number; conversion_rate: number | null; }
export interface FunnelResponse { steps: FunnelStep[]; }
export interface RetentionCell { cohort_week: string; week_num: number; retained: number; cohort_size: number; retention_rate: number; }
export interface RetentionResponse { event_name: string; data: RetentionCell[]; }

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

export const experimentResultApi = {
  getResult: async (id: string): Promise<ExperimentResult> => {
    const res = await fetch(`${API_BASE_URL}/experiments/${id}/result`);
    if (!res.ok) throw new Error('Failed to fetch result');
    return res.json();
  },
};

export const decisionApi = {
  create: async (data: { experiment_id: string; decision: DecisionType; reason: string; decided_by: string }): Promise<Decision> => {
    const res = await fetch(`${API_BASE_URL}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create decision');
    return res.json();
  },
  list: async (experimentId: string): Promise<Decision[]> => {
    const res = await fetch(`${API_BASE_URL}/experiments/${experimentId}/decisions`);
    if (!res.ok) throw new Error('Failed to fetch decisions');
    return res.json();
  },
  createNote: async (data: { experiment_id: string; content: string; created_by?: string }): Promise<LearningNote> => {
    const res = await fetch(`${API_BASE_URL}/learning-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create note');
    return res.json();
  },
  listNotes: async (experimentId: string): Promise<LearningNote[]> => {
    const res = await fetch(`${API_BASE_URL}/experiments/${experimentId}/learning-notes`);
    if (!res.ok) throw new Error('Failed to fetch notes');
    return res.json();
  },
};

export const featureFlagApi = {
  list: async (): Promise<FeatureFlag[]> => {
    const res = await fetch(`${API_BASE_URL}/feature-flags/`);
    if (!res.ok) throw new Error('Failed to fetch flags');
    return res.json();
  },
  create: async (data: FeatureFlagCreate): Promise<FeatureFlag> => {
    const res = await fetch(`${API_BASE_URL}/feature-flags/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create flag');
    return res.json();
  },
  update: async (flagKey: string, data: FeatureFlagUpdate): Promise<FeatureFlag> => {
    const res = await fetch(`${API_BASE_URL}/feature-flags/${flagKey}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update flag');
    return res.json();
  },
  decide: async (flagKey: string, userId: string): Promise<{ variant: string }> => {
    const res = await fetch(`${API_BASE_URL}/feature-flags/decide?flag_key=${flagKey}&user_id=${userId}`);
    if (!res.ok) throw new Error('Failed to decide');
    const json = await res.json();
    return json.data;
  },
};

export const analyticsApi = {
  getTrends: async (eventName: string, from: string, to: string, granularity = 'day'): Promise<TrendsResponse> => {
    const params = new URLSearchParams({ event_name: eventName, from, to, granularity });
    const res = await fetch(`${API_BASE_URL}/analytics/trends?${params}`);
    if (!res.ok) throw new Error('Failed to fetch trends');
    return res.json();
  },
  getEventNames: async (): Promise<string[]> => {
    const res = await fetch(`${API_BASE_URL}/analytics/event-names`);
    if (!res.ok) throw new Error('Failed to fetch event names');
    return res.json();
  },
  getFunnels: async (steps: string[], from?: string, to?: string): Promise<FunnelResponse> => {
    const res = await fetch(`${API_BASE_URL}/analytics/funnels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps, from_: from, to }),
    });
    if (!res.ok) throw new Error('Failed to fetch funnels');
    return res.json();
  },
  getRetention: async (eventName: string): Promise<RetentionResponse> => {
    const res = await fetch(`${API_BASE_URL}/analytics/retention?event_name=${eventName}`);
    if (!res.ok) throw new Error('Failed to fetch retention');
    return res.json();
  },
};
