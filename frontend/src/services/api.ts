import { API_BASE_URL, apiFetch } from './http';

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';

// ────────────────────────────────────────────────────────────
// Projects
// ────────────────────────────────────────────────────────────
export interface Project {
  id: string;
  name: string;
  api_key: string;
  base_url?: string | null;
  project_type: 'ab_test' | 'quasi_experiment';
  created_at: string;
}
export interface ProjectCreate {
  id: string;
  name: string;
  base_url?: string;
  project_type?: 'ab_test' | 'quasi_experiment';
}
export interface ProjectSdkStatus {
  project_id: string;
  status: 'connected' | 'not_connected';
}
export interface VisualChange {
  id: string;
  experiment_id: string;
  variation_key: string;
  selector: string;
  type: string;
  value: string;
  created_at: string;
}
export interface VisualChangeCreate {
  variation_key: string;
  selector: string;
  type: string;
  value: string;
}

export const projectApi = {
  list: async (): Promise<Project[]> => {
    const res = await apiFetch(`${API_BASE_URL}/projects/`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },
  get: async (id: string): Promise<Project> => {
    const res = await apiFetch(`${API_BASE_URL}/projects/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Failed to fetch project');
    return res.json();
  },
  patch: async (id: string, data: { base_url?: string | null }): Promise<Project> => {
    const res = await apiFetch(`${API_BASE_URL}/projects/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update project');
    return res.json();
  },
  create: async (data: ProjectCreate): Promise<Project> => {
    const res = await apiFetch(`${API_BASE_URL}/projects/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let detail = 'Failed to create project';
      try {
        const b = await res.json();
        if (Array.isArray(b?.detail)) {
          detail = b.detail.map((e: { msg: string }) => e.msg).join('; ');
        } else if (b?.detail) {
          detail = b.detail;
        }
      } catch { /* */ }
      throw new Error(detail);
    }
    return res.json();
  },
  delete: async (id: string): Promise<void> => {
    const res = await apiFetch(`${API_BASE_URL}/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) {
      let detail = 'Failed to delete project';
      try {
        const b = await res.json();
        if (Array.isArray(b?.detail)) {
          detail = b.detail.map((e: { msg: string }) => e.msg).join('; ');
        } else if (b?.detail) {
          detail = b.detail;
        }
      } catch { /* */ }
      throw new Error(detail);
    }
  },
  sdkStatus: async (id: string): Promise<ProjectSdkStatus> => {
    const res = await apiFetch(`${API_BASE_URL}/projects/${encodeURIComponent(id)}/sdk-status`);
    if (!res.ok) throw new Error('Failed to fetch SDK status');
    return res.json();
  },
};

export const visualChangeApi = {
  list: async (experimentId: string, variationKey?: string): Promise<VisualChange[]> => {
    const q = variationKey ? `?variation_key=${encodeURIComponent(variationKey)}` : '';
    const res = await apiFetch(`${API_BASE_URL}/experiments/${encodeURIComponent(experimentId)}/visual-changes${q}`);
    if (!res.ok) throw new Error('Failed to fetch visual changes');
    return res.json();
  },
  create: async (experimentId: string, data: VisualChangeCreate): Promise<VisualChange> => {
    const res = await apiFetch(`${API_BASE_URL}/experiments/${encodeURIComponent(experimentId)}/visual-changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to save visual change');
    return res.json();
  },
  delete: async (changeId: string): Promise<void> => {
    const res = await apiFetch(`${API_BASE_URL}/visual-changes/${encodeURIComponent(changeId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete visual change');
  },
};

// ────────────────────────────────────────────────────────────
// Experiment Result (Bayesian)
// ────────────────────────────────────────────────────────────
export interface VariantResult {
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
  product?: string | null;
  project_id?: string | null;
  archived_at?: string | null;
  created_at: string;
  updated_at: string;
}
export interface FeatureFlagCreate {
  flag_key: string;
  description?: string;
  rollout_pct?: number;
  enabled?: boolean;
  product?: string;
  project_id?: string;
}
export interface FeatureFlagUpdate {
  description?: string;
  rollout_pct?: number;
  enabled?: boolean;
  product?: string;
  project_id?: string;
}

export interface FeatureFlagExposureSummary {
  flag_key: string;
  from?: string | null;
  to?: string | null;
  total_exposures: number;
  unique_users: number;
  first_exposure_users: number;
  variant_counts: Record<string, number>;
}

export interface FeatureFlagRule {
  id: string;
  flag_key: string;
  priority: number;
  segment_id?: string | null;
  rollout_pct: number;
  variant: string;
  enabled: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  created_at: string;
  updated_at: string;
}
export interface FeatureFlagRuleCreate {
  id?: string;
  priority?: number;
  segment_id?: string;
  rollout_pct?: number;
  variant?: string;
  enabled?: boolean;
  starts_at?: string;
  ends_at?: string;
}
export type FeatureFlagRuleUpdate = Partial<FeatureFlagRuleCreate>;

export interface Segment {
  id: string;
  name: string;
  description?: string | null;
  source: 'manual' | 'query' | string;
  query_name?: string | null;
  rules_json?: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  member_count: number;
}
export interface SegmentCreate {
  id: string;
  name: string;
  description?: string;
  source?: 'manual' | 'query';
  query_name?: string;
  rules_json?: string;
  enabled?: boolean;
  user_ids?: string[];
}
export interface SegmentMember {
  segment_id: string;
  user_id: string;
  reason?: string | null;
  refreshed_at: string;
}
export interface SegmentRefreshResponse {
  segment_id: string;
  refreshed_count: number;
  source: string;
}
export interface SegmentQueryTemplate {
  query_name: string;
  description: string;
  rules_schema: Record<string, unknown>;
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
  experiment_id: string;
  name: string;
  traffic_ratio?: number;
  description?: string;
}

export interface Experiment {
  id: string;
  name: string;
  hypothesis?: string;
  expected_effect?: string;
  primary_metric?: string;
  completion_event?: string;
  experiment_type?: 'ab_test' | 'quasi_experiment' | 'rollout';
  cohort_id?: string;
  flag_key?: string | null;
  product?: string | null;
  project_id?: string | null;
  status: ExperimentStatus;
  owner_id?: string;
  start_at?: string;
  end_at?: string;
  reflection_start_date?: string;
  reflection_window_days?: number;
  created_at: string;
  updated_at: string;
  variants: Variant[];
}

export interface ExperimentCreate {
  id?: string;
  name: string;
  hypothesis?: string;
  expected_effect?: string;
  primary_metric?: string;
  completion_event?: string;
  experiment_type?: 'ab_test' | 'quasi_experiment' | 'rollout';
  cohort_id?: string;
  flag_key?: string;
  owner_id?: string;
  product?: string;
  project_id?: string;
  start_at?: string;
  end_at?: string;
  variants: { name: string; traffic_ratio: number; description?: string }[];
}

export interface ExperimentUpdate {
  name?: string;
  hypothesis?: string;
  expected_effect?: string;
  primary_metric?: string;
  completion_event?: string;
  experiment_type?: 'ab_test' | 'quasi_experiment' | 'rollout';
  cohort_id?: string;
  flag_key?: string;
  product?: string;
  project_id?: string;
  start_at?: string;
  end_at?: string;
  status?: ExperimentStatus;
}

export interface ExperimentPlacementConfig {
  experiment_id: string;
  placement_key: string;
  variant_key: string | null;
  ui_id: string;
  ui_type: string;
  title: string;
  description: string;
  target_url: string;
  source: string;
  target_cohort: string;
  allowed_roles: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExperimentPlacementConfigUpdate {
  ui_id?: string;
  ui_type?: string;
  title?: string;
  description?: string;
  target_url?: string;
  source?: string;
  target_cohort?: string;
  allowed_roles?: string[];
  enabled?: boolean;
}

export interface ExperimentPlacementConfigCreate extends ExperimentPlacementConfigUpdate {
  placement_key: string;
  variant_key?: string | null;
  ui_id: string;
  ui_type: string;
  title: string;
  description: string;
  target_url: string;
  source: string;
  target_cohort: string;
  allowed_roles: string[];
  enabled: boolean;
}

export const experimentApi = {
  list: async (status?: ExperimentStatus): Promise<Experiment[]> => {
    const url = new URL(`${API_BASE_URL}/experiments/`, window.location.origin);
    if (status) url.searchParams.set('status', status);
    const response = await apiFetch(url.toString());
    if (!response.ok) throw new Error('Failed to fetch experiments');
    return response.json();
  },

  get: async (id: string): Promise<Experiment> => {
    const response = await apiFetch(`${API_BASE_URL}/experiments/${id}`);
    if (!response.ok) throw new Error('Failed to fetch experiment');
    return response.json();
  },

  create: async (data: ExperimentCreate): Promise<Experiment> => {
    const response = await apiFetch(`${API_BASE_URL}/experiments/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create experiment');
    return response.json();
  },

  update: async (id: string, data: ExperimentUpdate): Promise<Experiment> => {
    const response = await apiFetch(`${API_BASE_URL}/experiments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      let detail = 'Failed to update experiment';
      try {
        const body = await response.json();
        if (body?.detail) detail = body.detail;
      } catch { /* ignore parse error */ }
      throw new Error(detail);
    }
    return response.json();
  },

  delete: async (id: string): Promise<void> => {
    const response = await apiFetch(`${API_BASE_URL}/experiments/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete experiment');
  },
};

export const experimentPlacementApi = {
  list: async (experimentId: string): Promise<ExperimentPlacementConfig[]> => {
    const response = await apiFetch(`${API_BASE_URL}/experiments/${encodeURIComponent(experimentId)}/placements`);
    if (!response.ok) throw new Error('Failed to fetch experiment placements');
    return response.json();
  },

  create: async (
    experimentId: string,
    data: ExperimentPlacementConfigCreate,
  ): Promise<ExperimentPlacementConfig> => {
    const response = await apiFetch(`${API_BASE_URL}/experiments/${encodeURIComponent(experimentId)}/placements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create experiment placement');
    return response.json();
  },

  update: async (
    experimentId: string,
    placementKey: string,
    data: ExperimentPlacementConfigUpdate,
  ): Promise<ExperimentPlacementConfig> => {
    const response = await apiFetch(
      `${API_BASE_URL}/experiments/${encodeURIComponent(experimentId)}/placements/${encodeURIComponent(placementKey)}/config`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      },
    );
    if (!response.ok) throw new Error('Failed to update experiment placement');
    return response.json();
  },

  delete: async (experimentId: string, placementKey: string): Promise<void> => {
    const response = await apiFetch(
      `${API_BASE_URL}/experiments/${encodeURIComponent(experimentId)}/placements/${encodeURIComponent(placementKey)}`,
      { method: 'DELETE' },
    );
    if (!response.ok) throw new Error('Failed to delete experiment placement');
  },
};

// ────────────────────────────────────────────────────────────
// Placements (quasi-experiments)
// ────────────────────────────────────────────────────────────
export interface Placement {
  key: string;
  name: string;
  description?: string | null;
  project_id?: string | null;
  status: string;
  target_cohort?: string | null;
  allowed_roles?: string[] | null;
  start_at?: string | null;
  end_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface PlacementCreate {
  key: string;
  name: string;
  description?: string;
  project_id?: string;
  status?: string;
  target_cohort?: string;
  allowed_roles?: string[];
  start_at?: string;
  end_at?: string;
}

export interface PlacementDecideResponse {
  key: string;
  show: boolean;
  completed: boolean;
  reason?: string | null;
}

export const placementApi = {
  list: async (projectId?: string): Promise<Placement[]> => {
    const params = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
    const res = await apiFetch(`${API_BASE_URL}/placements/${params}`);
    if (!res.ok) throw new Error('Failed to fetch placements');
    return res.json();
  },
  get: async (key: string): Promise<Placement> => {
    const res = await apiFetch(`${API_BASE_URL}/placements/${encodeURIComponent(key)}`);
    if (!res.ok) throw new Error('Failed to fetch placement');
    return res.json();
  },
  create: async (data: PlacementCreate): Promise<Placement> => {
    const res = await apiFetch(`${API_BASE_URL}/placements/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      let detail = 'Failed to create placement';
      try {
        const b = await res.json();
        if (b?.detail) detail = b.detail;
      } catch { /* */ }
      throw new Error(detail);
    }
    return res.json();
  },
  delete: async (key: string): Promise<void> => {
    const res = await apiFetch(`${API_BASE_URL}/placements/${encodeURIComponent(key)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete placement');
  },
  decide: async (
    key: string,
    params: { user_id: string; role?: string; cohort?: string; scenario?: string },
  ): Promise<PlacementDecideResponse> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, v); });
    const res = await apiFetch(`${API_BASE_URL}/placements/${encodeURIComponent(key)}/decide?${qs}`);
    if (!res.ok) throw new Error('Failed to decide placement');
    return res.json();
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
    const response = await apiFetch(url.toString());
    if (!response.ok) throw new Error('Failed to fetch bug reports');
    return response.json();
  },

  get: async (id: string): Promise<BugReport> => {
    const response = await apiFetch(`${API_BASE_URL}/bug-reports/${id}`);
    if (!response.ok) throw new Error('Failed to fetch bug report');
    return response.json();
  },

  create: async (data: BugReportCreate): Promise<BugReport> => {
    const response = await apiFetch(`${API_BASE_URL}/bug-reports/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to create bug report');
    return response.json();
  },

  update: async (id: string, data: Partial<{ status: BugStatus; severity: BugSeverity; title: string; description: string }>): Promise<BugReport> => {
    const response = await apiFetch(`${API_BASE_URL}/bug-reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error('Failed to update bug report');
    return response.json();
  },

  addComment: async (id: string, content: string, author?: string): Promise<BugReport> => {
    const response = await apiFetch(`${API_BASE_URL}/bug-reports/${id}/comments`, {
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
    const response = await apiFetch(`${API_BASE_URL}/bug-reports/upload`, {
      method: 'POST',
      body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload attachment');
    return response.json();
  },

  delete: async (id: string): Promise<void> => {
    const response = await apiFetch(`${API_BASE_URL}/bug-reports/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Failed to delete bug report');
  },
};

export const experimentResultApi = {
  getResult: async (id: string): Promise<ExperimentResult> => {
    const res = await apiFetch(`${API_BASE_URL}/experiments/${id}/result`);
    if (!res.ok) throw new Error('Failed to fetch result');
    return res.json();
  },
};

export const decisionApi = {
  create: async (data: { experiment_id: string; decision: DecisionType; reason: string; decided_by: string }): Promise<Decision> => {
    const res = await apiFetch(`${API_BASE_URL}/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create decision');
    return res.json();
  },
  list: async (experimentId: string): Promise<Decision[]> => {
    const res = await apiFetch(`${API_BASE_URL}/experiments/${experimentId}/decisions`);
    if (!res.ok) throw new Error('Failed to fetch decisions');
    return res.json();
  },
  createNote: async (data: { experiment_id: string; content: string; created_by?: string }): Promise<LearningNote> => {
    const res = await apiFetch(`${API_BASE_URL}/learning-notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create note');
    return res.json();
  },
  listNotes: async (experimentId: string): Promise<LearningNote[]> => {
    const res = await apiFetch(`${API_BASE_URL}/experiments/${experimentId}/learning-notes`);
    if (!res.ok) throw new Error('Failed to fetch notes');
    return res.json();
  },
};

export const featureFlagApi = {
  list: async (includeArchived = false): Promise<FeatureFlag[]> => {
    const params = includeArchived ? '?include_archived=true' : '';
    const res = await apiFetch(`${API_BASE_URL}/feature-flags/${params}`);
    if (!res.ok) throw new Error('Failed to fetch flags');
    return res.json();
  },
  create: async (data: FeatureFlagCreate): Promise<FeatureFlag> => {
    const res = await apiFetch(`${API_BASE_URL}/feature-flags/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create flag');
    return res.json();
  },
  update: async (flagKey: string, data: FeatureFlagUpdate): Promise<FeatureFlag> => {
    const res = await apiFetch(`${API_BASE_URL}/feature-flags/${encodeURIComponent(flagKey)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update flag');
    return res.json();
  },
  decide: async (flagKey: string, userId: string): Promise<{ variant: string }> => {
    const params = new URLSearchParams({ flag_key: flagKey, user_id: userId });
    const res = await apiFetch(`${API_BASE_URL}/feature-flags/decide?${params}`);
    if (!res.ok) throw new Error('Failed to decide');
    const json = await res.json();
    return json.data;
  },
  exposureSummary: async (flagKey: string): Promise<FeatureFlagExposureSummary> => {
    const res = await apiFetch(`${API_BASE_URL}/feature-flags/${encodeURIComponent(flagKey)}/exposure-summary`);
    if (!res.ok) throw new Error('Failed to fetch exposure summary');
    return res.json();
  },
  listRules: async (flagKey: string): Promise<FeatureFlagRule[]> => {
    const res = await apiFetch(`${API_BASE_URL}/feature-flags/${encodeURIComponent(flagKey)}/rules`);
    if (!res.ok) throw new Error('Failed to fetch flag rules');
    return res.json();
  },
  createRule: async (flagKey: string, data: FeatureFlagRuleCreate): Promise<FeatureFlagRule> => {
    const res = await apiFetch(`${API_BASE_URL}/feature-flags/${encodeURIComponent(flagKey)}/rules`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create flag rule');
    return res.json();
  },
  archive: async (flagKey: string): Promise<FeatureFlag> => {
    const res = await apiFetch(`${API_BASE_URL}/feature-flags/${encodeURIComponent(flagKey)}/archive`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to archive flag');
    return res.json();
  },
  restore: async (flagKey: string): Promise<FeatureFlag> => {
    const res = await apiFetch(`${API_BASE_URL}/feature-flags/${encodeURIComponent(flagKey)}/restore`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error('Failed to restore flag');
    return res.json();
  },
  updateRule: async (flagKey: string, ruleId: string, data: FeatureFlagRuleUpdate): Promise<FeatureFlagRule> => {
    const res = await apiFetch(`${API_BASE_URL}/feature-flags/${encodeURIComponent(flagKey)}/rules/${encodeURIComponent(ruleId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to update flag rule');
    return res.json();
  },
};

export const segmentApi = {
  queryTemplates: async (): Promise<SegmentQueryTemplate[]> => {
    const res = await apiFetch(`${API_BASE_URL}/segments/query-templates`);
    if (!res.ok) throw new Error('Failed to fetch segment query templates');
    return res.json();
  },
  list: async (): Promise<Segment[]> => {
    const res = await apiFetch(`${API_BASE_URL}/segments/`);
    if (!res.ok) throw new Error('Failed to fetch segments');
    return res.json();
  },
  create: async (data: SegmentCreate): Promise<Segment> => {
    const res = await apiFetch(`${API_BASE_URL}/segments/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Failed to create segment');
    return res.json();
  },
  refresh: async (segmentId: string, data?: { user_ids?: string[]; reason?: string }): Promise<SegmentRefreshResponse> => {
    const res = await apiFetch(`${API_BASE_URL}/segments/${encodeURIComponent(segmentId)}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data ?? {}),
    });
    if (!res.ok) throw new Error('Failed to refresh segment');
    return res.json();
  },
  members: async (segmentId: string, limit = 100): Promise<SegmentMember[]> => {
    const params = new URLSearchParams({ limit: String(limit) });
    const res = await apiFetch(`${API_BASE_URL}/segments/${encodeURIComponent(segmentId)}/members?${params}`);
    if (!res.ok) throw new Error('Failed to fetch segment members');
    return res.json();
  },
};

export const analyticsApi = {
  getTrends: async (eventName: string, from: string, to: string, granularity = 'day'): Promise<TrendsResponse> => {
    const params = new URLSearchParams({ event_name: eventName, from, to, granularity });
    const res = await apiFetch(`${API_BASE_URL}/analytics/trends?${params}`);
    if (!res.ok) throw new Error('Failed to fetch trends');
    return res.json();
  },
  getEventNames: async (): Promise<string[]> => {
    const res = await apiFetch(`${API_BASE_URL}/analytics/event-names`);
    if (!res.ok) throw new Error('Failed to fetch event names');
    return res.json();
  },
  getFunnels: async (steps: string[], from?: string, to?: string): Promise<FunnelResponse> => {
    const res = await apiFetch(`${API_BASE_URL}/analytics/funnels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps, from_: from, to }),
    });
    if (!res.ok) throw new Error('Failed to fetch funnels');
    return res.json();
  },
  getRetention: async (eventName: string): Promise<RetentionResponse> => {
    const res = await apiFetch(`${API_BASE_URL}/analytics/retention?event_name=${eventName}`);
    if (!res.ok) throw new Error('Failed to fetch retention');
    return res.json();
  },
};
