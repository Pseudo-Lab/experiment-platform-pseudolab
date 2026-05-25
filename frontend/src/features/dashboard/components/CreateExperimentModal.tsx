import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { X, Plus, Trash2 } from 'lucide-react';
import { experimentApi, experimentPlacementApi } from '../../../services/api';

interface VariantInput {
  name: string;
  traffic_ratio: string;
}

interface CreateExperimentModalProps {
  lang: 'en' | 'ko';
  onClose: () => void;
  onCreated: () => void;
}

const translations = {
  en: {
    title: 'New Experiment',
    labelName: 'Experiment Name',
    placeholderName: 'e.g. Button Color Test',
    labelHypothesis: 'Hypothesis',
    placeholderHypothesis: 'e.g. Changing the button color will increase CTR.',
    labelPrimaryMetric: 'Primary Metric',
    placeholderPrimaryMetric: 'e.g. weekly_session_attended',
    labelVariants: 'Variants',
    placeholderVariantName: 'Variant name',
    placeholderRatio: 'Ratio',
    addVariant: 'Add Variant',
    ratioWarning: 'Traffic ratio must sum to 1.0 (currently: {sum})',
    cancel: 'Cancel',
    create: 'Create',
    creating: 'Creating...',
    nameRequired: 'Experiment name is required.',
    configurePlacement: 'Create UI exposure slot with this experiment',
    placementKey: 'Slot key',
    placementKeyPlaceholder: 'e.g. product-home-primary-cta',
    placementKeyHelp: 'Frontend-owned placement key sent to the decide API.',
    uiId: 'UI ID',
    uiIdPlaceholder: 'e.g. onboarding-start-banner',
    uiIdHelp: 'Stable UI identifier returned for analytics and rendering.',
    uiType: 'UI type',
    uiTypeHelp: 'Rendering hint returned to the frontend. The service still owns the component implementation.',
    uiTitle: 'Slot title',
    uiTitlePlaceholder: 'e.g. Start onboarding',
    uiTitleHelp: 'Copy returned as ui.title.',
    uiDescription: 'Slot description',
    uiDescriptionPlaceholder: 'Short copy shown in the product UI',
    uiDescriptionHelp: 'Copy returned as ui.description.',
    targetUrl: 'Target URL',
    targetUrlPlaceholder: 'e.g. /onboarding/start',
    targetUrlHelp: 'Service-owned destination URL. The platform stores and returns it, but does not own the route.',
    source: 'Exposure source',
    sourceHelp: 'Analytics source key for where the slot is rendered.',
    targetCohort: 'Target cohort',
    targetCohortPlaceholder: 'Use * for all cohorts',
    targetCohortHelp: 'Coarse cohort targeting rule. Use * when this slot is not cohort-limited.',
    allowedRoles: 'Allowed roles',
    allowedRolesPlaceholder: 'e.g. builder, runner, mentor',
    allowedRolesHint: 'Comma-separated project role keys. Leave empty to allow all roles.',
    placementEnabled: 'Enable slot immediately',
    placementRequired: 'Fill all UI exposure slot fields or turn off slot creation.',
    placementCreateFailed: 'Experiment was created, but UI exposure slot creation failed. Add the slot from the experiment detail page.',
  },
  ko: {
    title: '새 실험 생성',
    labelName: '실험 이름',
    placeholderName: '예: 버튼 색상 테스트',
    labelHypothesis: '가설',
    placeholderHypothesis: '예: 버튼 색상 변경이 클릭률을 높일 것이다.',
    labelPrimaryMetric: 'Primary Metric',
    placeholderPrimaryMetric: '예: weekly_session_attended',
    labelVariants: 'Variants',
    placeholderVariantName: 'Variant 이름',
    placeholderRatio: '비율',
    addVariant: 'Variant 추가',
    ratioWarning: 'traffic_ratio 합계는 1.0이어야 합니다 (현재: {sum})',
    cancel: '취소',
    create: '생성',
    creating: '생성 중...',
    nameRequired: '실험 이름을 입력해주세요.',
    configurePlacement: '실험 생성과 함께 UI 노출 슬롯 생성',
    placementKey: '슬롯 키',
    placementKeyPlaceholder: '예: product-home-primary-cta',
    placementKeyHelp: '서비스 프론트가 decide API에 전달하는 슬롯 식별자입니다.',
    uiId: 'UI ID',
    uiIdPlaceholder: '예: onboarding-start-banner',
    uiIdHelp: '분석과 렌더링 식별에 사용할 안정적인 UI 식별자입니다.',
    uiType: 'UI 타입',
    uiTypeHelp: '프론트에 내려줄 렌더링 힌트입니다. 실제 컴포넌트 구현은 각 서비스가 소유합니다.',
    uiTitle: '슬롯 제목',
    uiTitlePlaceholder: '예: 새 온보딩 시작하기',
    uiTitleHelp: '응답의 ui.title로 내려갈 문구입니다.',
    uiDescription: '슬롯 설명',
    uiDescriptionPlaceholder: '제품 UI에 보여줄 짧은 설명',
    uiDescriptionHelp: '응답의 ui.description으로 내려갈 문구입니다.',
    targetUrl: '이동 URL',
    targetUrlPlaceholder: '예: /onboarding/start',
    targetUrlHelp: '각 서비스가 소유한 이동 경로입니다. 실험 플랫폼은 저장하고 응답으로 돌려줄 뿐 라우트를 소유하지 않습니다.',
    source: '노출 소스',
    sourceHelp: '어느 화면/영역에서 노출됐는지 분석하기 위한 source 키입니다.',
    targetCohort: '대상 코호트',
    targetCohortPlaceholder: '* 입력 시 전체 기수',
    targetCohortHelp: '코호트 기준의 간단한 대상 조건입니다. 제한하지 않으려면 *를 사용합니다.',
    allowedRoles: '허용 역할',
    allowedRolesPlaceholder: '예: builder, runner, mentor',
    allowedRolesHint: '쉼표로 구분한 프로젝트 역할 키입니다. 비워두면 모든 역할을 허용합니다.',
    placementEnabled: '슬롯 즉시 활성화',
    placementRequired: 'UI 노출 슬롯 필드를 모두 입력하거나 슬롯 생성을 끄세요.',
    placementCreateFailed: '실험은 생성됐지만 UI 노출 슬롯 생성에 실패했습니다. 실험 상세 화면에서 슬롯을 추가하세요.',
  },
};

const uiTypeOptions = ['banner', 'card', 'modal', 'cta'];

const parseCsvList = (value: string) => value
  .split(',')
  .map((item) => item.trim())
  .filter(Boolean);

export const CreateExperimentModal: React.FC<CreateExperimentModalProps> = ({ lang, onClose, onCreated }) => {
  const t = translations[lang];
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [primaryMetric, setPrimaryMetric] = useState('');
  const [variants, setVariants] = useState<VariantInput[]>([
    { name: 'control', traffic_ratio: '0.5' },
    { name: 'treatment', traffic_ratio: '0.5' },
  ]);
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
        name: name.trim(),
        hypothesis: hypothesis.trim() || undefined,
        primary_metric: primaryMetric.trim() || undefined,
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
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{t.title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelName}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.placeholderName}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelHypothesis}</label>
            <Textarea
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder={t.placeholderHypothesis}
              className="rounded-xl resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelPrimaryMetric}</label>
            <Input
              value={primaryMetric}
              onChange={(e) => setPrimaryMetric(e.target.value)}
              placeholder={t.placeholderPrimaryMetric}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t.labelVariants}</label>
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
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    checked={placementEnabled}
                    onChange={(e) => setPlacementEnabled(e.target.checked)}
                  />
                  {t.placementEnabled}
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
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
            )}
          </div>
        </div>

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
