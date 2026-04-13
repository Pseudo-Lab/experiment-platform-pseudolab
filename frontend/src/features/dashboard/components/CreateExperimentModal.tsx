import React, { useState } from 'react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { X, Plus, Trash2 } from 'lucide-react';
import { experimentApi } from '../../../services/api';

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
    labelVariants: 'Variants',
    placeholderVariantName: 'Variant name',
    placeholderRatio: 'Ratio',
    addVariant: 'Add Variant',
    ratioWarning: 'Traffic ratio must sum to 1.0 (currently: {sum})',
    cancel: 'Cancel',
    create: 'Create',
    creating: 'Creating...',
    nameRequired: 'Experiment name is required.',
  },
  ko: {
    title: '새 실험 생성',
    labelName: '실험 이름',
    placeholderName: '예: 버튼 색상 테스트',
    labelHypothesis: '가설',
    placeholderHypothesis: '예: 버튼 색상 변경이 클릭률을 높일 것이다.',
    labelVariants: 'Variants',
    placeholderVariantName: 'Variant 이름',
    placeholderRatio: '비율',
    addVariant: 'Variant 추가',
    ratioWarning: 'traffic_ratio 합계는 1.0이어야 합니다 (현재: {sum})',
    cancel: '취소',
    create: '생성',
    creating: '생성 중...',
    nameRequired: '실험 이름을 입력해주세요.',
  },
};

export const CreateExperimentModal: React.FC<CreateExperimentModalProps> = ({ lang, onClose, onCreated }) => {
  const t = translations[lang];
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [variants, setVariants] = useState<VariantInput[]>([
    { name: 'control', traffic_ratio: '0.5' },
    { name: 'treatment', traffic_ratio: '0.5' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ratioSum = variants.reduce((sum, v) => sum + (parseFloat(v.traffic_ratio) || 0), 0);
  const ratioValid = Math.abs(ratioSum - 1.0) <= 0.01;

  const addVariant = () => setVariants((prev) => [...prev, { name: '', traffic_ratio: '0' }]);
  const removeVariant = (i: number) => setVariants((prev) => prev.filter((_, idx) => idx !== i));
  const updateVariant = (i: number, field: keyof VariantInput, value: string) => {
    setVariants((prev) => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v));
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError(t.nameRequired); return; }
    if (variants.length > 0 && !ratioValid) { setError(t.ratioWarning.replace('{sum}', ratioSum.toFixed(2))); return; }

    setSubmitting(true);
    setError(null);
    try {
      await experimentApi.create({
        name: name.trim(),
        hypothesis: hypothesis.trim() || undefined,
        variants: variants.map((v) => ({
          name: v.name,
          traffic_ratio: parseFloat(v.traffic_ratio) || 0,
        })),
      });
      onCreated();
    } catch {
      setError(lang === 'ko' ? '생성 중 오류가 발생했습니다.' : 'Failed to create experiment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-5">
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
    </div>
  );
};
