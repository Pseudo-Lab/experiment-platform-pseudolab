import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent } from '../../../components/ui/card';
import {
  ArrowLeft, Play, Save, Trash2, MousePointerClick, ChevronDown, ChevronUp,
  Pencil, Check, X, Type, Palette, PaintBucket, CaseSensitive, Eye,
  Maximize2, LayoutList, Move, Code,
} from 'lucide-react';
import { visualChangeApi, projectApi, experimentApi, type VisualChange, type Experiment } from '../../../services/api';

interface Props { lang: 'en' | 'ko'; }

const MSG_APPLY = 'exp:apply-change';
const MSG_SELECTED = 'exp:element-selected';
const MSG_READY = 'exp:editor-ready';

type EditType = 'text' | 'color' | 'backgroundColor' | 'fontSize' | 'visibility' | 'size' | 'spacing' | 'position' | 'css';

interface ElementInfo { tagName: string; textContent: string; }
interface SizeValue { width: string; widthUnit: 'px' | '%'; height: string; heightUnit: 'px' | '%'; }
interface SpacingValue {
  marginTop: string; marginRight: string; marginBottom: string; marginLeft: string;
  paddingTop: string; paddingRight: string; paddingBottom: string; paddingLeft: string;
}
interface PositionValue { type: string; top: string; left: string; right: string; bottom: string; }

const EMPTY_SPACING: SpacingValue = {
  marginTop: '', marginRight: '', marginBottom: '', marginLeft: '',
  paddingTop: '', paddingRight: '', paddingBottom: '', paddingLeft: '',
};
const EMPTY_SIZE: SizeValue = { width: '', widthUnit: 'px', height: '', heightUnit: 'px' };
const EMPTY_POSITION: PositionValue = { type: 'relative', top: '', left: '', right: '', bottom: '' };

const TAG_KOREAN: Record<string, string> = {
  button: '버튼', h1: '제목', h2: '제목', h3: '제목', h4: '제목', h5: '제목', h6: '제목',
  p: '문단', img: '이미지', a: '링크', div: '영역', span: '텍스트',
  input: '입력', label: '라벨', li: '목록 항목', ul: '목록', section: '섹션', nav: '내비게이션',
};

const EDIT_TYPES: { type: EditType; icon: React.ElementType; label: string }[] = [
  { type: 'text',            icon: Type,           label: '텍스트 변경' },
  { type: 'color',           icon: Palette,        label: '글자 색상' },
  { type: 'backgroundColor', icon: PaintBucket,    label: '배경 색상' },
  { type: 'fontSize',        icon: CaseSensitive,  label: '글자 크기' },
  { type: 'visibility',      icon: Eye,            label: '보이기/숨기기' },
  { type: 'size',            icon: Maximize2,      label: '크기' },
  { type: 'spacing',         icon: LayoutList,     label: '여백' },
  { type: 'position',        icon: Move,           label: '위치' },
  { type: 'css',             icon: Code,           label: '직접 CSS' },
];

const t = {
  ko: {
    back: 'Projects로',
    title: 'Visual Editor',
    urlPlaceholder: '앱 URL (예: https://sub.pseudolab-devfactory.com/example)',
    load: '로드',
    experimentLabel: '실험 선택',
    experimentPlaceholder: '실험을 선택하세요',
    variantLabel: 'Variant 선택',
    variantPlaceholder: 'Variant를 선택하세요',
    ctaTitle: '왼쪽 앱에서 수정할 요소를 클릭하세요',
    ctaSubtitle: '버튼, 텍스트, 이미지 등 어떤 요소든 클릭하면 여기서 편집할 수 있어요',
    ctaSelectExp: '실험과 Variant를 먼저 선택하세요',
    selectorExpand: '선택자 보기',
    selectorCollapse: '접기',
    editType: '편집 유형',
    value: '값',
    colorPlaceholder: '#000000 또는 색상명',
    fontSizeUnit: 'px',
    displayShow: '보이기',
    displayHide: '숨기기',
    width: '너비',
    height: '높이',
    margin: '마진',
    padding: '패딩',
    top: '상', right: '우', bottom: '하', left: '좌',
    positionType: '포지션',
    customProperty: 'CSS 속성명',
    customPropertyHint: '예: border-radius, opacity, transform ...',
    customValue: '값',
    preview: '미리보기',
    save: '저장',
    saving: '저장 중...',
    savedChanges: '저장된 변경사항',
    noChanges: '저장된 변경사항이 없습니다.',
    delete: '삭제',
    loadFirst: '앱 URL을 입력하고 로드하세요.',
    baseUrlEdit: '앱 URL 설정',
    baseUrlSave: '저장',
    baseUrlCancel: '취소',
    baseUrlPlaceholder: 'https://sub.pseudolab-devfactory.com/example',
  },
  en: {
    back: 'To Projects',
    title: 'Visual Editor',
    urlPlaceholder: 'App URL (e.g. https://sub.pseudolab-devfactory.com/example)',
    load: 'Load',
    experimentLabel: 'Select Experiment',
    experimentPlaceholder: 'Choose an experiment',
    variantLabel: 'Select Variant',
    variantPlaceholder: 'Choose a variant',
    ctaTitle: 'Click an element in the app on the left',
    ctaSubtitle: 'Buttons, text, images — click anything and edit it here',
    ctaSelectExp: 'Select an experiment and variant first',
    selectorExpand: 'Show selector',
    selectorCollapse: 'Collapse',
    editType: 'Edit type',
    value: 'Value',
    colorPlaceholder: '#000000 or color name',
    fontSizeUnit: 'px',
    displayShow: 'Show',
    displayHide: 'Hide',
    width: 'Width',
    height: 'Height',
    margin: 'Margin',
    padding: 'Padding',
    top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left',
    positionType: 'Position',
    customProperty: 'CSS property',
    customPropertyHint: 'e.g. border-radius, opacity, transform ...',
    customValue: 'Value',
    preview: 'Preview',
    save: 'Save',
    saving: 'Saving...',
    savedChanges: 'Saved changes',
    noChanges: 'No saved changes yet.',
    delete: 'Delete',
    loadFirst: 'Enter an app URL and load it.',
    baseUrlEdit: 'Set app URL',
    baseUrlSave: 'Save',
    baseUrlCancel: 'Cancel',
    baseUrlPlaceholder: 'https://sub.pseudolab-devfactory.com/example',
  },
};

export function VisualEditor({ lang }: Props) {
  const tr = t[lang];
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editPanelRef = useRef<HTMLDivElement>(null);

  // Experiment / variant selection
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedExperimentId, setSelectedExperimentId] = useState('');
  const [selectedVariationKey, setSelectedVariationKey] = useState('');

  // URL bar
  const [url, setUrl] = useState('');
  const [loadedSrc, setLoadedSrc] = useState('');
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [editingBaseUrl, setEditingBaseUrl] = useState(false);
  const [baseUrlInput, setBaseUrlInput] = useState('');

  // Element selection
  const [selector, setSelector] = useState('');
  const [elementInfo, setElementInfo] = useState<ElementInfo | null>(null);
  const [selectorExpanded, setSelectorExpanded] = useState(false);

  // Edit type & values
  const [editType, setEditType] = useState<EditType>('text');
  const [value, setValue] = useState('');
  const [customProperty, setCustomProperty] = useState('');
  const [sizeValue, setSizeValue] = useState<SizeValue>(EMPTY_SIZE);
  const [spacingValue, setSpacingValue] = useState<SpacingValue>(EMPTY_SPACING);
  const [positionValue, setPositionValue] = useState<PositionValue>(EMPTY_POSITION);

  // State
  const [changes, setChanges] = useState<VisualChange[]>([]);
  const [saving, setSaving] = useState(false);

  const selectedExperiment = experiments.find((e) => e.id === selectedExperimentId);

  // Load experiments for this project
  useEffect(() => {
    experimentApi.list().then((exps) => {
      const filtered = projectId ? exps.filter((e) => !e.project_id || e.project_id === projectId) : exps;
      setExperiments(filtered);
    }).catch(() => {});
  }, [projectId]);

  // Load base URL from project
  useEffect(() => {
    if (!projectId) return;
    projectApi.get(projectId).then((p) => {
      if (p.base_url) { setBaseUrl(p.base_url); setUrl(p.base_url); }
    }).catch(() => {});
  }, [projectId]);

  const loadChanges = useCallback(() => {
    if (!selectedExperimentId) return;
    visualChangeApi.list(selectedExperimentId, selectedVariationKey || undefined)
      .then(setChanges)
      .catch(() => setChanges([]));
  }, [selectedExperimentId, selectedVariationKey]);

  useEffect(() => { loadChanges(); }, [loadChanges]);

  // Reset variant when experiment changes
  useEffect(() => { setSelectedVariationKey(''); }, [selectedExperimentId]);

  const resetValueState = useCallback(() => {
    setValue('');
    setCustomProperty('');
    setSizeValue(EMPTY_SIZE);
    setSpacingValue(EMPTY_SPACING);
    setPositionValue(EMPTY_POSITION);
  }, []);

  const getEncodedValue = useCallback((): string => {
    switch (editType) {
      case 'size': {
        const obj: Record<string, string> = {};
        if (sizeValue.width) obj.width = `${sizeValue.width}${sizeValue.widthUnit}`;
        if (sizeValue.height) obj.height = `${sizeValue.height}${sizeValue.heightUnit}`;
        return JSON.stringify(obj);
      }
      case 'spacing': {
        const obj: Record<string, string> = {};
        const keys: (keyof SpacingValue)[] = [
          'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
          'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        ];
        for (const k of keys) { if (spacingValue[k]) obj[k] = spacingValue[k]; }
        return JSON.stringify(obj);
      }
      case 'position': {
        const obj: Record<string, string> = { position: positionValue.type };
        if (positionValue.top) obj.top = positionValue.top;
        if (positionValue.left) obj.left = positionValue.left;
        if (positionValue.right) obj.right = positionValue.right;
        if (positionValue.bottom) obj.bottom = positionValue.bottom;
        return JSON.stringify(obj);
      }
      case 'css':
        return JSON.stringify({ property: customProperty, value });
      default:
        return value;
    }
  }, [editType, value, customProperty, sizeValue, spacingValue, positionValue]);

  const postToIframe = useCallback((sel: string, changeType: string, val: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: MSG_APPLY, selector: sel, changeType, value: val },
      '*',
    );
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === MSG_SELECTED && typeof d.selector === 'string') {
        setSelector(d.selector);
        setElementInfo({ tagName: d.tagName || '', textContent: d.textContent || '' });
        setEditType('text');
        resetValueState();
        setSelectorExpanded(false);
        if (window.innerWidth < 1024) {
          setTimeout(() => editPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        }
      } else if (d.type === MSG_READY) {
        changes.forEach((c) => postToIframe(c.selector, c.type, c.value));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [changes, postToIframe, resetValueState]);

  const handleLoad = () => {
    if (!url.trim()) return;
    const trimmed = url.trim();
    const sep = trimmed.includes('?') ? '&' : '?';
    setLoadedSrc(`${trimmed}${sep}__exp_editor=true`);
  };

  const handlePreview = () => {
    if (!selector) return;
    postToIframe(selector, editType, getEncodedValue());
  };

  const handleSave = async () => {
    if (!selectedExperimentId || !selectedVariationKey || !selector) return;
    setSaving(true);
    try {
      const encodedValue = getEncodedValue();
      await visualChangeApi.create(selectedExperimentId, {
        variation_key: selectedVariationKey,
        selector,
        type: editType,
        value: encodedValue,
      });
      postToIframe(selector, editType, encodedValue);
      await loadChanges();
      resetValueState();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (changeId: string) => {
    await visualChangeApi.delete(changeId);
    await loadChanges();
  };

  const handleSaveBaseUrl = async () => {
    if (!projectId) return;
    try {
      const updated = await projectApi.patch(projectId, { base_url: baseUrlInput || null });
      setBaseUrl(updated.base_url ?? null);
      if (updated.base_url) setUrl(updated.base_url);
      setEditingBaseUrl(false);
    } catch { /* ignore */ }
  };

  const isValidHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);
  const koreanTag = elementInfo ? (TAG_KOREAN[elementInfo.tagName] || '텍스트') : '';
  const previewText = elementInfo?.textContent
    ? elementInfo.textContent.slice(0, 30) + (elementInfo.textContent.length > 30 ? '…' : '')
    : '';

  const canSave = !!selectedExperimentId && !!selectedVariationKey && !!selector;

  const selectClass = 'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors';

  const SpacingRow = ({ label, prefix }: { label: string; prefix: 'margin' | 'padding' }) => {
    const keys = ['Top', 'Right', 'Bottom', 'Left'] as const;
    return (
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{label}</p>
        <div className="grid grid-cols-4 gap-1">
          {keys.map((dir) => {
            const k = `${prefix}${dir}` as keyof SpacingValue;
            return (
              <div key={k} className="space-y-0.5">
                <p className="text-[10px] text-center text-slate-400">{tr[dir.toLowerCase() as 'top' | 'right' | 'bottom' | 'left']}</p>
                <Input
                  value={spacingValue[k]}
                  onChange={(e) => setSpacingValue((prev) => ({ ...prev, [k]: e.target.value }))}
                  className="rounded-lg text-xs px-1.5 h-7 font-mono text-center"
                  placeholder="0"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="gap-2 rounded-xl text-slate-500" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-4 w-4" />{tr.back}
        </Button>
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">{tr.title} · {projectId}</h1>
      </div>

      {/* URL bar */}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={tr.urlPlaceholder}
            className="rounded-xl"
            onKeyDown={(e) => { if (e.key === 'Enter') handleLoad(); }}
          />
          <Button className="rounded-xl shrink-0" onClick={handleLoad} disabled={!url.trim()}>{tr.load}</Button>
        </div>
        <div className="flex items-center gap-2 px-1">
          {editingBaseUrl ? (
            <>
              <Input
                value={baseUrlInput}
                onChange={(e) => setBaseUrlInput(e.target.value)}
                placeholder={tr.baseUrlPlaceholder}
                className="rounded-lg text-xs h-7 font-mono"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveBaseUrl(); if (e.key === 'Escape') setEditingBaseUrl(false); }}
                autoFocus
              />
              <Button size="sm" variant="default" className="h-7 px-2 rounded-lg text-xs gap-1" onClick={handleSaveBaseUrl}>
                <Check className="h-3 w-3" />{tr.baseUrlSave}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2 rounded-lg text-xs" onClick={() => setEditingBaseUrl(false)}>
                <X className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <button
              className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-indigo-500 transition-colors"
              onClick={() => { setBaseUrlInput(baseUrl || ''); setEditingBaseUrl(true); }}
            >
              <Pencil className="h-3 w-3" />
              {baseUrl
                ? <span className="text-slate-500 font-mono">{baseUrl}</span>
                : <span>{tr.baseUrlEdit}</span>}
            </button>
          )}
        </div>
      </div>

      {/* Experiment / Variant selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{tr.experimentLabel}</label>
          <select
            value={selectedExperimentId}
            onChange={(e) => setSelectedExperimentId(e.target.value)}
            className={selectClass}
          >
            <option value="">{tr.experimentPlaceholder}</option>
            {experiments.map((exp) => (
              <option key={exp.id} value={exp.id}>{exp.name}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400">{tr.variantLabel}</label>
          <select
            value={selectedVariationKey}
            onChange={(e) => setSelectedVariationKey(e.target.value)}
            className={selectClass}
            disabled={!selectedExperiment}
          >
            <option value="">{tr.variantPlaceholder}</option>
            {selectedExperiment?.variants.map((v) => (
              <option key={v.name} value={v.name}>{v.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main grid: iframe + right panel */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-4">
        {/* iframe */}
        <Card className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 order-2 lg:order-1">
          <CardContent className="p-0">
            {loadedSrc ? (
              <iframe
                ref={iframeRef}
                src={loadedSrc}
                title="visual-editor-preview"
                className="w-full h-[50vh] min-h-[320px] lg:h-[600px] border-0 bg-white"
              />
            ) : (
              <div className="h-[50vh] min-h-[320px] lg:h-[600px] flex items-center justify-center text-sm text-slate-400">
                {tr.loadFirst}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right panel */}
        <Card ref={editPanelRef} className="rounded-2xl border border-slate-200 dark:border-slate-800 order-1 lg:order-2 overflow-hidden">
          <CardContent className="pt-5 space-y-4 max-h-[600px] overflow-y-auto">
            {!selector ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                  <MousePointerClick className="h-8 w-8 text-indigo-500" />
                </div>
                <div>
                  <p className="font-semibold text-base text-slate-700 dark:text-slate-200 leading-snug">
                    {canSave ? tr.ctaTitle : tr.ctaSelectExp}
                  </p>
                  {canSave && (
                    <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-xs mx-auto">
                      {tr.ctaSubtitle}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Element info */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-full bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-0.5 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
                      {koreanTag}
                    </span>
                    {previewText && (
                      <span className="text-sm text-slate-600 dark:text-slate-300 truncate max-w-[160px]">
                        "{previewText}"
                      </span>
                    )}
                  </div>
                  <button
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                    onClick={() => setSelectorExpanded((v) => !v)}
                  >
                    {selectorExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {selectorExpanded ? tr.selectorCollapse : tr.selectorExpand}
                  </button>
                  {selectorExpanded && (
                    <code className="block text-[11px] font-mono break-all rounded-lg bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-indigo-600 dark:text-indigo-300">
                      {selector}
                    </code>
                  )}
                </div>

                {/* Edit type selector */}
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.editType}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {EDIT_TYPES.map(({ type, icon: Icon, label }) => (
                      <button
                        key={type}
                        onClick={() => { setEditType(type); resetValueState(); }}
                        className={[
                          'flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-[11px] font-medium transition-colors',
                          editType === type
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
                        ].join(' ')}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span className="leading-tight text-center">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Value input per type */}
                <div className="space-y-2">
                  {editType === 'text' && (
                    <>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.value}</label>
                      <Input value={value} onChange={(e) => setValue(e.target.value)} className="rounded-xl text-sm" placeholder={previewText || '변경할 텍스트'} />
                    </>
                  )}

                  {(editType === 'color' || editType === 'backgroundColor') && (
                    <>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.value}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={isValidHex(value) ? value : '#000000'}
                          onChange={(e) => setValue(e.target.value)}
                          className="w-10 h-9 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <Input value={value} onChange={(e) => setValue(e.target.value)} className="rounded-xl text-sm font-mono" placeholder={tr.colorPlaceholder} />
                      </div>
                    </>
                  )}

                  {editType === 'fontSize' && (
                    <>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.value}</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number" min={1}
                          value={value.replace(/[^0-9.]/g, '')}
                          onChange={(e) => setValue(e.target.value ? `${e.target.value}px` : '')}
                          className="rounded-xl text-sm w-24" placeholder="16"
                        />
                        <span className="text-sm text-slate-500 shrink-0">{tr.fontSizeUnit}</span>
                      </div>
                    </>
                  )}

                  {editType === 'visibility' && (
                    <>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.value}</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setValue('block')}
                          className={['flex-1 rounded-xl border py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
                            value === 'block'
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          <Eye className="h-3.5 w-3.5" />{tr.displayShow}
                        </button>
                        <button
                          onClick={() => setValue('none')}
                          className={['flex-1 rounded-xl border py-2 text-sm font-medium transition-colors flex items-center justify-center gap-1.5',
                            value === 'none'
                              ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          <Eye className="h-3.5 w-3.5 opacity-40" />{tr.displayHide}
                        </button>
                      </div>
                    </>
                  )}

                  {editType === 'size' && (
                    <div className="space-y-2">
                      {(['width', 'height'] as const).map((dim) => (
                        <div key={dim} className="flex items-center gap-2">
                          <label className="text-xs font-medium text-slate-600 dark:text-slate-400 w-10 shrink-0">
                            {dim === 'width' ? tr.width : tr.height}
                          </label>
                          <Input
                            type="number" min={0}
                            value={sizeValue[dim]}
                            onChange={(e) => setSizeValue((prev) => ({ ...prev, [dim]: e.target.value }))}
                            className="rounded-xl text-sm font-mono" placeholder="100"
                          />
                          <select
                            value={sizeValue[`${dim}Unit`]}
                            onChange={(e) => setSizeValue((prev) => ({ ...prev, [`${dim}Unit`]: e.target.value as 'px' | '%' }))}
                            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
                          >
                            <option value="px">px</option>
                            <option value="%">%</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  )}

                  {editType === 'spacing' && (
                    <div className="space-y-3">
                      <SpacingRow label={tr.margin} prefix="margin" />
                      <SpacingRow label={tr.padding} prefix="padding" />
                    </div>
                  )}

                  {editType === 'position' && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.positionType}</label>
                        <select
                          value={positionValue.type}
                          onChange={(e) => setPositionValue((prev) => ({ ...prev, type: e.target.value }))}
                          className={selectClass}
                        >
                          {['static', 'relative', 'absolute', 'fixed', 'sticky'].map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(['top', 'left', 'right', 'bottom'] as const).map((dir) => (
                          <div key={dir} className="space-y-0.5">
                            <label className="text-[11px] text-slate-500 dark:text-slate-400">{tr[dir]}</label>
                            <Input
                              value={positionValue[dir]}
                              onChange={(e) => setPositionValue((prev) => ({ ...prev, [dir]: e.target.value }))}
                              className="rounded-lg text-xs font-mono h-8" placeholder="auto"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {editType === 'css' && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.customProperty}</label>
                        <Input value={customProperty} onChange={(e) => setCustomProperty(e.target.value)} className="rounded-xl text-sm font-mono" placeholder="border-radius" />
                        <p className="text-[11px] text-slate-400">{tr.customPropertyHint}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.customValue}</label>
                        <Input value={value} onChange={(e) => setValue(e.target.value)} className="rounded-xl text-sm font-mono" placeholder="8px" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="gap-1.5 rounded-xl flex-1" onClick={handlePreview} disabled={!selector}>
                    <Play className="h-3.5 w-3.5" />{tr.preview}
                  </Button>
                  <Button size="sm" className="gap-1.5 rounded-xl flex-1" onClick={handleSave} disabled={saving || !canSave}>
                    <Save className="h-3.5 w-3.5" />{saving ? tr.saving : tr.save}
                  </Button>
                </div>
              </>
            )}

            {/* Saved changes — inside right panel */}
            {selectedExperimentId && (
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{tr.savedChanges}</p>
                {changes.length === 0 ? (
                  <p className="text-xs text-slate-400">{tr.noChanges}</p>
                ) : (
                  <div className="space-y-1.5">
                    {changes.map((c) => (
                      <div key={c.id} className="flex items-start gap-2 rounded-xl border border-slate-100 dark:border-slate-800 px-2.5 py-2 text-[11px]">
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-1.5 py-0.5 font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300 shrink-0">
                          {c.variation_key}
                        </span>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <code className="block font-mono text-slate-500 dark:text-slate-400 truncate">{c.selector}</code>
                          <span className="text-slate-600 dark:text-slate-300">{c.type}</span>
                        </div>
                        <Button
                          variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-rose-600 shrink-0"
                          onClick={() => handleDelete(c.id)} aria-label={tr.delete}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
