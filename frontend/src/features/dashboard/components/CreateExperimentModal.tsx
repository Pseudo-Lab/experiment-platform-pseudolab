import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { X, Plus, Trash2 } from 'lucide-react';
import { experimentApi, experimentPlacementApi, featureFlagApi, projectApi, type FeatureFlag, type Project } from '../../../services/api';

interface VariantInput {
  name: string;
  traffic_ratio: string;
}

type ExperimentType = 'ab_test' | 'quasi_experiment' | 'rollout';

interface CreateExperimentModalProps {
  lang: 'en' | 'ko';
  onClose: () => void;
  onCreated: () => void;
}

const translations = {
  en: {
    title: 'New Experiment',
    labelId: 'Experiment ID',
    placeholderId: 'e.g. s12-mid-reflection',
    idHelp: 'Stable API slug. Leave empty to auto-generate.',
    labelName: '* Experiment Name',
    placeholderName: 'e.g. Button Color Test',
    requiredLegend: '* required',
    labelProduct: 'Product',
    placeholderProduct: 'e.g. lvup',
    productHelp: 'Product or service this experiment belongs to.',
    labelType: 'Experiment type',
    labelHypothesis: 'Hypothesis',
    placeholderHypothesis: 'e.g. Changing the button color will increase CTR.',
    labelExpectedEffect: 'Expected effect',
    placeholderExpectedEffect: 'e.g. Increase completed reflections',
    labelPrimaryMetric: '* Primary Metric',
    placeholderPrimaryMetric: 'e.g. weekly_session_attended',
    primaryMetricHint: 'Required to transition the experiment to running.',
    labelCompletionEvent: 'Completion event',
    placeholderCompletionEvent: 'e.g. project_reflection_submitted',
    completionEventHelp: 'Event used to return completed=true from placement decide.',
    labelCohortId: 'Cohort ID',
    placeholderCohortId: 'e.g. 12',
    labelStartAt: 'Exposure starts',
    labelEndAt: 'Exposure ends',
    scheduleHelp: 'Placement decide uses this experiment schedule. End time is exclusive.',
    labelVariants: '* Variants',
    placeholderVariantName: 'Variant name',
    placeholderRatio: 'Ratio',
    addVariant: 'Add Variant',
    ratioWarning: 'Traffic ratio must sum to 1.0 (currently: {sum})',
    cancel: 'Cancel',
    create: 'Create',
    creating: 'Creating...',
    nameRequired: 'Experiment name is required.',
    labelFlagKey: 'Linked feature flag',
    flagKeyNone: '(none — use legacy SHA256 assignment)',
    flagKeyHelp: 'When linked, decide() writes both flag exposure and experiment assignment. Variant names must match flag rule variants.',
    variantsAutoFilled: 'Variants auto-filled from the flag rules. Traffic ratios are ignored when linked — the flag rollout drives bucketing.',
    launchChecklist: 'To start (running) this experiment later, the following are required:',
    checklistMetric: 'Set Primary Metric',
    checklistFlag: 'Link a Feature Flag (required for A/B tests)',
    configurePlacement: 'Create placement with this experiment',
    placementIntro: 'A placement is a frontend-owned decision point. The product service renders the UI and owns routes; this platform decides eligibility and returns optional payload.',
    placementIdentity: 'Placement identity',
    placementIdentityHelp: 'Stable integration keys used by product frontends and decide APIs.',
    placementTargeting: 'Audience targeting',
    placementTargetingHelp: 'Temporary coarse targeting for this placement. Later this should move to reusable segments and targeting rules.',
    placementPayload: 'Response payload',
    placementPayloadHelp: 'Optional rendering config returned to the product service. The service still owns components and routes.',
    placementLogging: 'Logging context',
    placementLoggingHelp: 'Analytics context used when the product service logs view, click, or conversion events.',
    placementKey: 'Placement key',
    placementKeyPlaceholder: 'e.g. product-home-primary-cta',
    placementKeyHelp: 'Frontend-owned decision key sent to the placement decide API.',
    uiId: 'UI ID',
    uiIdPlaceholder: 'e.g. onboarding-start-banner',
    uiIdHelp: 'Stable UI identifier returned as payload for analytics and rendering.',
    uiType: 'UI type',
    uiTypeHelp: 'Payload hint for how the service may render this UI. The service owns the implementation.',
    uiTitle: 'Title',
    uiTitlePlaceholder: 'e.g. Start onboarding',
    uiTitleHelp: 'Payload copy returned as ui.title.',
    uiDescription: 'Description',
    uiDescriptionPlaceholder: 'Short copy shown in the product UI',
    uiDescriptionHelp: 'Payload copy returned as ui.description.',
    targetUrl: 'Target URL payload',
    targetUrlPlaceholder: 'e.g. /onboarding/start',
    targetUrlHelp: 'Service-owned destination URL. The platform stores and returns it, but does not own the route.',
    source: 'Logging source',
    sourceHelp: 'Analytics source key for where this placement is rendered.',
    targetCohort: 'Target cohort',
    targetCohortPlaceholder: 'Use * for all cohorts',
    targetCohortHelp: 'Coarse cohort targeting fallback. Use * when this placement is not cohort-limited.',
    allowedRoles: 'Allowed roles',
    allowedRolesPlaceholder: 'e.g. builder, runner, mentor',
    allowedRolesHint: 'Comma-separated project role keys. Leave empty to allow all roles.',
    placementEnabled: 'Enable placement immediately',
    placementRequired: 'Fill all placement fields or turn off placement creation.',
    placementCreateFailed: 'Experiment was created, but placement creation failed. Add the placement from the experiment detail page.',
  },
  ko: {
    title: '새 실험 생성',
    labelId: '실험 ID',
    placeholderId: '예: s12-mid-reflection',
    idHelp: 'API와 운영 설정에서 쓰는 안정적인 slug입니다. 비워두면 자동 생성됩니다.',
    labelName: '* 실험 이름',
    placeholderName: '예: 버튼 색상 테스트',
    requiredLegend: '* 필수 입력',
    labelProduct: '제품/서비스',
    placeholderProduct: '예: lvup',
    productHelp: '이 실험이 속한 제품 또는 서비스입니다.',
    labelType: '실험 유형',
    labelHypothesis: '가설',
    placeholderHypothesis: '예: 버튼 색상 변경이 클릭률을 높일 것이다.',
    labelExpectedEffect: '기대 효과',
    placeholderExpectedEffect: '예: 회고 제출 수 확보',
    labelPrimaryMetric: '* Primary Metric',
    placeholderPrimaryMetric: '예: weekly_session_attended',
    primaryMetricHint: '실험을 running으로 전환하려면 필수입니다.',
    labelCompletionEvent: '완료 이벤트',
    placeholderCompletionEvent: '예: project_reflection_submitted',
    completionEventHelp: 'placement decide에서 completed=true를 판단할 이벤트입니다.',
    labelCohortId: '코호트 ID',
    placeholderCohortId: '예: 12',
    labelStartAt: '노출 시작',
    labelEndAt: '노출 종료',
    scheduleHelp: 'Placement decide는 이 실험 기간을 기준으로 노출 여부를 판단합니다. 종료 시각은 포함하지 않습니다.',
    labelVariants: '* Variants',
    placeholderVariantName: 'Variant 이름',
    placeholderRatio: '비율',
    addVariant: 'Variant 추가',
    ratioWarning: 'traffic_ratio 합계는 1.0이어야 합니다 (현재: {sum})',
    cancel: '취소',
    create: '생성',
    creating: '생성 중...',
    nameRequired: '실험 이름을 입력해주세요.',
    labelFlagKey: '연결할 Feature Flag',
    flagKeyNone: '(연결 안 함 — 기존 SHA256 배정 사용)',
    flagKeyHelp: '연결하면 decide() 한 번으로 노출 기록과 실험 배정이 동시에 일어납니다. variant 이름이 Flag rule과 일치해야 합니다.',
    variantsAutoFilled: 'Flag rule에서 variants를 자동으로 가져왔습니다. 연결 시 traffic_ratio는 무시되고 Flag rollout이 분배를 결정합니다.',
    launchChecklist: '나중에 running으로 전환하려면 다음이 필요합니다:',
    checklistMetric: 'Primary Metric 설정',
    checklistFlag: 'Feature Flag 연결 (A/B 테스트는 필수)',
    configurePlacement: '실험 생성과 함께 Placement 생성',
    placementIntro: 'Placement는 서비스 프론트가 소유한 노출 결정 지점입니다. 실제 UI 렌더링과 라우트는 각 서비스가 소유하고, 실험 플랫폼은 대상 여부와 응답 payload를 결정합니다.',
    placementIdentity: 'Placement 기본 정보',
    placementIdentityHelp: '서비스 프론트와 decide API가 공유하는 안정적인 연동 키입니다.',
    placementTargeting: '대상 조건',
    placementTargetingHelp: '현재는 Placement 단위의 간단한 대상 조건입니다. 추후에는 재사용 가능한 Segment/Targeting rule로 분리하는 것이 좋습니다.',
    placementPayload: '응답 Payload',
    placementPayloadHelp: '서비스 프론트 렌더링에 참고할 설정값입니다. 실제 컴포넌트와 라우트는 각 서비스가 소유합니다.',
    placementLogging: '분석/로깅 컨텍스트',
    placementLoggingHelp: '서비스 프론트가 view, click, conversion 이벤트를 남길 때 함께 보낼 분석 컨텍스트입니다.',
    placementKey: 'Placement 키',
    placementKeyPlaceholder: '예: product-home-primary-cta',
    placementKeyHelp: '서비스 프론트가 placement decide API에 전달하는 노출 결정 키입니다.',
    uiId: 'UI ID',
    uiIdPlaceholder: '예: onboarding-start-banner',
    uiIdHelp: '분석과 렌더링 식별에 사용할 payload 식별자입니다.',
    uiType: 'UI 타입',
    uiTypeHelp: '서비스가 UI를 어떻게 렌더링할지 참고하는 payload 힌트입니다. 구현은 각 서비스가 소유합니다.',
    uiTitle: '제목',
    uiTitlePlaceholder: '예: 새 온보딩 시작하기',
    uiTitleHelp: '응답의 ui.title로 내려갈 payload 문구입니다.',
    uiDescription: '설명',
    uiDescriptionPlaceholder: '제품 UI에 보여줄 짧은 설명',
    uiDescriptionHelp: '응답의 ui.description으로 내려갈 payload 문구입니다.',
    targetUrl: '이동 URL payload',
    targetUrlPlaceholder: '예: /onboarding/start',
    targetUrlHelp: '각 서비스가 소유한 이동 경로입니다. 실험 플랫폼은 저장하고 응답으로 돌려줄 뿐 라우트를 소유하지 않습니다.',
    source: '로깅 소스',
    sourceHelp: '어느 화면/영역에서 노출됐는지 분석하기 위한 source 키입니다.',
    targetCohort: '대상 코호트',
    targetCohortPlaceholder: '* 입력 시 전체 기수',
    targetCohortHelp: '코호트 기준의 간단한 대상 조건입니다. 제한하지 않으려면 *를 사용합니다.',
    allowedRoles: '허용 역할',
    allowedRolesPlaceholder: '예: builder, runner, mentor',
    allowedRolesHint: '쉼표로 구분한 프로젝트 역할 키입니다. 비워두면 모든 역할을 허용합니다.',
    placementEnabled: 'Placement 즉시 활성화',
    placementRequired: 'Placement 필드를 모두 입력하거나 Placement 생성을 끄세요.',
    placementCreateFailed: '실험은 생성됐지만 Placement 생성에 실패했습니다. 실험 상세 화면에서 Placement를 추가하세요.',
  },
};

const PRODUCT_OPTIONS = ['lvup', 'demo-app', 'pseudo-lab'];
const uiTypeOptions = ['banner', 'card', 'modal', 'cta'];
const experimentTypeOptions: { value: ExperimentType; en: string; ko: string }[] = [
  { value: 'quasi_experiment', en: 'Quasi experiment', ko: '준실험' },
  { value: 'ab_test', en: 'A/B test', ko: 'A/B 테스트' },
  { value: 'rollout', en: 'Rollout', ko: '점진 배포' },
];

const toApiDatetime = (value: string) => (value ? new Date(value).toISOString() : undefined);

const parseCsvList = (value: string) => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

export const CreateExperimentModal: React.FC<CreateExperimentModalProps> = ({ lang, onClose, onCreated }) => {
  const t = translations[lang];
  const [experimentId, setExperimentId] = useState('');
  const [name, setName] = useState('');
  const [experimentType, setExperimentType] = useState<ExperimentType>('quasi_experiment');
  const [hypothesis, setHypothesis] = useState('');
  const [primaryMetric, setPrimaryMetric] = useState('');
  const [completionEvent, setCompletionEvent] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [variants, setVariants] = useState<VariantInput[]>([
    { name: 'control', traffic_ratio: '0.5' },
    { name: 'treatment', traffic_ratio: '0.5' },
  ]);
  const [projectId, setProjectId] = useState('');
  const [availableProjects, setAvailableProjects] = useState<Project[]>([]);
  const [flagKey, setFlagKey] = useState<string>('');
  const [availableFlags, setAvailableFlags] = useState<FeatureFlag[]>([]);
  const [configurePlacement, setConfigurePlacement] = useState(false);
  const [placementKey, setPlacementKey] = useState('');
  const [uiId, setUiId] = useState('');
  const [uiType, setUiType] = useState('banner');
  const [slotTitle, setSlotTitle] = useState('');
  const [slotDescription, setSlotDescription] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [source, setSource] = useState('unknown');
  const [targetCohort, setTargetCohort] = useState('*');
  const [allowedRolesText, setAllowedRolesText] = useState('');
  const [placementEnabled, setPlacementEnabled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ratioSum = variants.reduce((sum, v) => sum + (parseFloat(v.traffic_ratio) || 0), 0);
  const ratioValid = Math.abs(ratioSum - 1.0) <= 0.01;

  useEffect(() => {
    featureFlagApi.list(false).then(setAvailableFlags).catch(() => setAvailableFlags([]));
    projectApi.list().then(setAvailableProjects).catch(() => setAvailableProjects([]));
  }, []);

  // Flag 선택 시 그 Flag의 enabled rule variants로 variants 자동 채움.
  // 연결 해제하거나 빈 값이면 사용자 입력 보존.
  useEffect(() => {
    if (!flagKey) return;
    let cancelled = false;
    featureFlagApi
      .listRules(flagKey)
      .then((rules) => {
        if (cancelled) return;
        const ruleVariants = Array.from(
          new Set(rules.filter((r) => r.enabled).map((r) => r.variant)),
        ).filter((v) => v !== 'control');
        const names = ['control', ...ruleVariants];
        const ratio = (1 / names.length).toFixed(2);
        setVariants(names.map((name) => ({ name, traffic_ratio: ratio })));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [flagKey]);

  const addVariant = () => setVariants((prev) => [...prev, { name: '', traffic_ratio: '0' }]);
  const removeVariant = (i: number) => setVariants((prev) => prev.filter((_, idx) => idx !== i));
  const updateVariant = (i: number, field: keyof VariantInput, value: string) => {
    setVariants((prev) => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v));
  };
  const placementValid = Boolean(
    placementKey.trim() &&
    uiId.trim() &&
    uiType.trim() &&
    slotTitle.trim() &&
    slotDescription.trim() &&
    targetUrl.trim() &&
    source.trim() &&
    targetCohort.trim(),
  );

  const handleSubmit = async () => {
    if (!name.trim()) { setError(t.nameRequired); return; }
    if (variants.length > 0 && !ratioValid) { setError(t.ratioWarning.replace('{sum}', ratioSum.toFixed(2))); return; }
    if (configurePlacement && !placementValid) { setError(t.placementRequired); return; }

    setSubmitting(true);
    setError(null);
    try {
      const created = await experimentApi.create({
        id: experimentId.trim() || undefined,
        name: name.trim(),
        hypothesis: hypothesis.trim() || undefined,
        primary_metric: primaryMetric.trim() || undefined,
        completion_event: completionEvent.trim() || undefined,
        experiment_type: experimentType,
        cohort_id: cohortId.trim() || undefined,
        flag_key: flagKey || undefined,
        project_id: projectId || undefined,
        product: projectId || undefined,
        start_at: toApiDatetime(startAt),
        end_at: toApiDatetime(endAt),
        variants: variants.map((v) => ({
          name: v.name,
          traffic_ratio: parseFloat(v.traffic_ratio) || 0,
        })),
      });
      if (configurePlacement) {
        try {
          await experimentPlacementApi.create(created.id, {
            placement_key: placementKey.trim(),
            ui_id: uiId.trim(),
            ui_type: uiType.trim(),
            title: slotTitle.trim(),
            description: slotDescription.trim(),
            target_url: targetUrl.trim(),
            source: source.trim(),
            target_cohort: targetCohort.trim(),
            allowed_roles: parseCsvList(allowedRolesText),
            enabled: placementEnabled,
          });
        } catch {
          window.alert(t.placementCreateFailed);
        }
      }
      onCreated();
    } catch {
      setError(lang === 'ko' ? '생성 중 오류가 발생했습니다.' : 'Failed to create experiment.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.requiredLegend}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelId}</label>
              <Input
                value={experimentId}
                onChange={(e) => setExperimentId(e.target.value)}
                placeholder={t.placeholderId}
                className="rounded-xl"
                aria-label={t.labelId}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">{t.idHelp}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelType}</label>
              <Select value={experimentType} onValueChange={(value) => setExperimentType(value as ExperimentType)}>
                <SelectTrigger className="rounded-xl" aria-label={t.labelType}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {experimentTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelName}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.placeholderName}
                className="rounded-xl"
                aria-label={t.labelName}
              />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelProduct}</label>
            <Select
              value={projectId || '__none__'}
              onValueChange={(v) => setProjectId(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="rounded-xl" aria-label={t.labelProduct}>
                <SelectValue placeholder={t.placeholderProduct} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{lang === 'ko' ? '(없음)' : '(none)'}</SelectItem>
                {availableProjects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} ({p.id})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.productHelp}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelHypothesis}</label>
            <Textarea
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder={t.placeholderHypothesis}
              className="rounded-xl resize-none"
              rows={2}
              aria-label={t.labelHypothesis}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelPrimaryMetric}</label>
            <Input
              value={primaryMetric}
              onChange={(e) => setPrimaryMetric(e.target.value)}
              placeholder={t.placeholderPrimaryMetric}
              className="rounded-xl"
              aria-label={t.labelPrimaryMetric}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.primaryMetricHint}</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelFlagKey}</label>
            <Select value={flagKey || '__none__'} onValueChange={(v) => setFlagKey(v === '__none__' ? '' : v)}>
              <SelectTrigger className="rounded-xl" aria-label={t.labelFlagKey}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t.flagKeyNone}</SelectItem>
                {availableFlags.map((flag) => (
                  <SelectItem key={flag.flag_key} value={flag.flag_key}>
                    {flag.flag_key}{flag.description ? ` — ${flag.description}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.flagKeyHelp}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr]">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelCohortId}</label>
              <Input
                value={cohortId}
                onChange={(e) => setCohortId(e.target.value)}
                placeholder={t.placeholderCohortId}
                className="rounded-xl"
                aria-label={t.labelCohortId}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelStartAt}</label>
              <Input
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="rounded-xl"
                type="datetime-local"
                aria-label={t.labelStartAt}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelEndAt}</label>
              <Input
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="rounded-xl"
                type="datetime-local"
                aria-label={t.labelEndAt}
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 sm:col-span-3">{t.scheduleHelp}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelVariants}</label>
            {flagKey && (
              <p className="text-xs text-indigo-600 dark:text-indigo-400">{t.variantsAutoFilled}</p>
            )}
            {variants.map((v, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={v.name}
                  onChange={(e) => updateVariant(i, 'name', e.target.value)}
                  placeholder={t.placeholderVariantName}
                  className="rounded-xl flex-1"
                />
                <Input
                  value={v.traffic_ratio}
                  onChange={(e) => updateVariant(i, 'traffic_ratio', e.target.value)}
                  placeholder={t.placeholderRatio}
                  className="rounded-xl w-20 text-center"
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                />
                {variants.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeVariant(i)}>
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                )}
              </div>
            ))}
            {variants.length > 0 && !ratioValid && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t.ratioWarning.replace('{sum}', ratioSum.toFixed(2))}
              </p>
            )}
            <Button variant="outline" size="sm" className="gap-1 rounded-xl" onClick={addVariant}>
              <Plus className="h-3.5 w-3.5" />
              {t.addVariant}
            </Button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/60 space-y-4">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={configurePlacement}
                onChange={(e) => setConfigurePlacement(e.target.checked)}
              />
              {t.configurePlacement}
            </label>

            {configurePlacement && (
              <div className="space-y-4">
                <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{t.placementIntro}</p>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelCompletionEvent}</label>
                  <Input
                    value={completionEvent}
                    onChange={(e) => setCompletionEvent(e.target.value)}
                    placeholder={t.placeholderCompletionEvent}
                    className="rounded-xl"
                    aria-label={t.labelCompletionEvent}
                  />
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.completionEventHelp}</p>
                </div>

                <section className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.placementIdentity}</h3>
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{t.placementIdentityHelp}</p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={placementEnabled}
                      onChange={(e) => setPlacementEnabled(e.target.checked)}
                    />
                    {t.placementEnabled}
                  </label>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.placementKey}</label>
                    <Input
                      value={placementKey}
                      onChange={(e) => setPlacementKey(e.target.value)}
                      placeholder={t.placementKeyPlaceholder}
                      className="rounded-xl"
                      aria-label={t.placementKey}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.placementKeyHelp}</p>
                  </div>
                </section>

                <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.placementTargeting}</h3>
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{t.placementTargetingHelp}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.targetCohort}</label>
                      <Input
                        value={targetCohort}
                        onChange={(e) => setTargetCohort(e.target.value)}
                        placeholder={t.targetCohortPlaceholder}
                        className="rounded-xl"
                        aria-label={t.targetCohort}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.targetCohortHelp}</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.allowedRoles}</label>
                      <Input
                        value={allowedRolesText}
                        onChange={(e) => setAllowedRolesText(e.target.value)}
                        placeholder={t.allowedRolesPlaceholder}
                        className="rounded-xl"
                        aria-label={t.allowedRoles}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.allowedRolesHint}</p>
                    </div>
                  </div>
                </section>

                <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.placementPayload}</h3>
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{t.placementPayloadHelp}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.uiId}</label>
                      <Input
                        value={uiId}
                        onChange={(e) => setUiId(e.target.value)}
                        placeholder={t.uiIdPlaceholder}
                        className="rounded-xl"
                        aria-label={t.uiId}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.uiIdHelp}</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.uiType}</label>
                      <Select value={uiType} onValueChange={setUiType}>
                        <SelectTrigger className="rounded-xl" aria-label={t.uiType}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {uiTypeOptions.map((value) => (
                            <SelectItem key={value} value={value}>{value}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.uiTypeHelp}</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.uiTitle}</label>
                      <Input
                        value={slotTitle}
                        onChange={(e) => setSlotTitle(e.target.value)}
                        placeholder={t.uiTitlePlaceholder}
                        className="rounded-xl"
                        aria-label={t.uiTitle}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.uiTitleHelp}</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.targetUrl}</label>
                      <Input
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        placeholder={t.targetUrlPlaceholder}
                        className="rounded-xl"
                        aria-label={t.targetUrl}
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400">{t.targetUrlHelp}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.uiDescription}</label>
                    <Textarea
                      value={slotDescription}
                      onChange={(e) => setSlotDescription(e.target.value)}
                      placeholder={t.uiDescriptionPlaceholder}
                      className="rounded-xl resize-none"
                      rows={2}
                      aria-label={t.uiDescription}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.uiDescriptionHelp}</p>
                  </div>
                </section>

                <section className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">{t.placementLogging}</h3>
                    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{t.placementLoggingHelp}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.source}</label>
                    <Input
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="rounded-xl"
                      aria-label={t.source}
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t.sourceHelp}</p>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>

        {(() => {
          const missingMetric = !primaryMetric.trim();
          const missingFlag = experimentType === 'ab_test' && !flagKey;
          if (!missingMetric && !missingFlag) return null;
          return (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-semibold mb-1">{t.launchChecklist}</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {missingMetric && <li>{t.checklistMetric}</li>}
                {missingFlag && <li>{t.checklistFlag}</li>}
              </ul>
            </div>
          );
        })()}

        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" className="rounded-xl" onClick={onClose} disabled={submitting}>
            {t.cancel}
          </Button>
          <Button className="rounded-xl" onClick={handleSubmit} disabled={submitting}>
            {submitting ? t.creating : t.create}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};
