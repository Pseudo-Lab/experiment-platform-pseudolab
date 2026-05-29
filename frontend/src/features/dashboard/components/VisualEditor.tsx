import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent } from '../../../components/ui/card';
import {
  ArrowLeft, Play, Save, Trash2, MousePointerClick, ChevronDown, ChevronUp, Pencil, Check, X,
} from 'lucide-react';
import { visualChangeApi, projectApi, type VisualChange } from '../../../services/api';

interface Props { lang: 'en' | 'ko'; }

const MSG_APPLY = 'exp:apply-change';
const MSG_SELECTED = 'exp:element-selected';
const MSG_READY = 'exp:editor-ready';

type EditType = 'text' | 'color' | 'background-color' | 'font-size' | 'display' | 'custom';

interface ElementInfo {
  tagName: string;
  textContent: string;
}

const TAG_KOREAN: Record<string, string> = {
  button: '버튼', h1: '제목', h2: '제목', h3: '제목', h4: '제목', h5: '제목', h6: '제목',
  p: '문단', img: '이미지', a: '링크', div: '영역', span: '텍스트',
  input: '입력', label: '라벨', li: '목록 항목', ul: '목록', section: '섹션', nav: '내비게이션',
};

const EDIT_TYPES: { type: EditType; emoji: string; label: string }[] = [
  { type: 'text', emoji: '📝', label: '텍스트 변경' },
  { type: 'color', emoji: '🎨', label: '글자 색상' },
  { type: 'background-color', emoji: '🖼', label: '배경 색상' },
  { type: 'font-size', emoji: '📏', label: '글자 크기' },
  { type: 'display', emoji: '👁', label: '보이기/숨기기' },
  { type: 'custom', emoji: '⚙️', label: '직접 입력' },
];

const t = {
  ko: {
    back: 'Projects로',
    title: 'Visual Editor',
    urlPlaceholder: '앱 URL (예: https://sub.pseudolab-devfactory.com/example)',
    load: '로드',
    ctaTitle: '왼쪽 앱에서 수정할 요소를 클릭하세요',
    ctaSubtitle: '버튼, 텍스트, 이미지 등 어떤 요소든 클릭하면 여기서 편집할 수 있어요',
    selectorLabel: 'CSS 선택자',
    selectorExpand: '선택자 보기',
    selectorCollapse: '접기',
    editType: '편집 유형',
    value: '값',
    colorPlaceholder: '#000000 또는 색상명',
    fontSizeUnit: 'px',
    displayShow: '보이기',
    displayHide: '숨기기',
    customProperty: 'CSS 속성명 또는 text',
    customPropertyHint: '예: color, background-color, font-size, text',
    customValue: '값',
    variant: 'Variant',
    flagKey: 'Flag key (선택)',
    preview: '미리보기',
    save: '저장',
    saving: '저장 중...',
    savedChanges: '저장된 변경사항',
    noChanges: '저장된 변경사항이 없습니다.',
    delete: '삭제',
    loadFirst: '앱 URL을 입력하고 로드하세요.',
    baseUrlLabel: '기본 앱 URL',
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
    ctaTitle: 'Click an element in the app on the left to edit it',
    ctaSubtitle: 'Buttons, text, images — click anything and edit it here',
    selectorLabel: 'CSS selector',
    selectorExpand: 'Show selector',
    selectorCollapse: 'Collapse',
    editType: 'Edit type',
    value: 'Value',
    colorPlaceholder: '#000000 or color name',
    fontSizeUnit: 'px',
    displayShow: 'Show',
    displayHide: 'Hide',
    customProperty: 'CSS property or text',
    customPropertyHint: 'e.g. color, background-color, font-size, text',
    customValue: 'Value',
    variant: 'Variant',
    flagKey: 'Flag key (optional)',
    preview: 'Preview',
    save: 'Save',
    saving: 'Saving...',
    savedChanges: 'Saved changes',
    noChanges: 'No saved changes yet.',
    delete: 'Delete',
    loadFirst: 'Enter an app URL and load it.',
    baseUrlLabel: 'Default app URL',
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

  const [url, setUrl] = useState('');
  const [loadedSrc, setLoadedSrc] = useState('');
  const [selector, setSelector] = useState('');
  const [elementInfo, setElementInfo] = useState<ElementInfo | null>(null);
  const [selectorExpanded, setSelectorExpanded] = useState(false);
  const [editType, setEditType] = useState<EditType>('text');
  const [customProperty, setCustomProperty] = useState('');
  const [variant, setVariant] = useState('treatment');
  const [flagKey, setFlagKey] = useState('');
  const [value, setValue] = useState('');
  const [changes, setChanges] = useState<VisualChange[]>([]);
  const [saving, setSaving] = useState(false);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [editingBaseUrl, setEditingBaseUrl] = useState(false);
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const editPanelRef = useRef<HTMLDivElement>(null);

  const loadChanges = useCallback(() => {
    if (!projectId) return;
    visualChangeApi.list(projectId).then(setChanges).catch(() => setChanges([]));
  }, [projectId]);

  useEffect(() => { loadChanges(); }, [loadChanges]);

  useEffect(() => {
    if (!projectId) return;
    projectApi.get(projectId).then((p) => {
      if (p.base_url) {
        setBaseUrl(p.base_url);
        setUrl(p.base_url);
      }
    }).catch(() => {});
  }, [projectId]);

  const effectiveProperty = editType === 'custom' ? customProperty : editType;

  const postToIframe = useCallback((sel: string, prop: string, val: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: MSG_APPLY, selector: sel, property: prop, value: val },
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
        setValue('');
        setSelectorExpanded(false);
        // on mobile, scroll edit panel into view
        if (window.innerWidth < 1024) {
          setTimeout(() => editPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
        }
      } else if (d.type === MSG_READY) {
        changes.filter((c) => c.variant === variant).forEach((c) => postToIframe(c.selector, c.property, c.value));
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [changes, variant, postToIframe]);

  const handleLoad = () => {
    if (!url.trim()) return;
    const trimmed = url.trim();
    const sep = trimmed.includes('?') ? '&' : '?';
    setLoadedSrc(`${trimmed}${sep}__exp_editor=true`);
  };

  const handlePreview = () => {
    if (!selector || !effectiveProperty) return;
    postToIframe(selector, effectiveProperty, value);
  };

  const handleSave = async () => {
    if (!projectId || !selector || !effectiveProperty) return;
    setSaving(true);
    try {
      await visualChangeApi.create(projectId, {
        selector, property: effectiveProperty, value, variant, flag_key: flagKey || undefined,
      });
      postToIframe(selector, effectiveProperty, value);
      await loadChanges();
      setValue('');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (changeId: string) => {
    if (!projectId) return;
    await visualChangeApi.delete(projectId, changeId);
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

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" className="gap-2 rounded-xl text-slate-500" onClick={() => navigate('/projects')}>
          <ArrowLeft className="h-4 w-4" />
          {tr.back}
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
        {/* Base URL inline editor */}
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
              {baseUrl ? (
                <span><span className="text-slate-500 font-mono">{baseUrl}</span></span>
              ) : (
                <span>{tr.baseUrlEdit}</span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* iframe — shown below edit panel on mobile (order-2), left on desktop */}
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

        {/* Right panel — shown above iframe on mobile (order-1), right on desktop */}
        <Card ref={editPanelRef} className="rounded-2xl border border-slate-200 dark:border-slate-800 order-1 lg:order-2">
          <CardContent className="pt-5 space-y-4">
            {/* Element selection state */}
            {!selector ? (
              <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                  <MousePointerClick className="h-8 w-8 text-indigo-500" />
                </div>
                <div>
                  <p className="font-semibold text-base text-slate-700 dark:text-slate-200 leading-snug">
                    {tr.ctaTitle}
                  </p>
                  <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-xs mx-auto">
                    {tr.ctaSubtitle}
                  </p>
                </div>
                <div className="lg:hidden flex items-center gap-1.5 text-xs text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1.5 rounded-full">
                  <span>↓</span>
                  <span>아래 앱을 스크롤해서 클릭하세요</span>
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
                  <div className="grid grid-cols-2 gap-1.5">
                    {EDIT_TYPES.map(({ type, emoji, label }) => (
                      <button
                        key={type}
                        onClick={() => { setEditType(type); setValue(''); }}
                        className={[
                          'flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-medium transition-colors text-left',
                          editType === type
                            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
                        ].join(' ')}
                      >
                        <span>{emoji}</span>
                        <span className="leading-tight">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Value input — changes by editType */}
                <div className="space-y-1.5">
                  {editType === 'text' && (
                    <>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.value}</label>
                      <Input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="rounded-xl text-sm"
                        placeholder={previewText || '변경할 텍스트'}
                      />
                    </>
                  )}

                  {(editType === 'color' || editType === 'background-color') && (
                    <>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.value}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={isValidHex(value) ? value : '#000000'}
                          onChange={(e) => setValue(e.target.value)}
                          className="w-10 h-9 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                        <Input
                          value={value}
                          onChange={(e) => setValue(e.target.value)}
                          className="rounded-xl text-sm font-mono"
                          placeholder={tr.colorPlaceholder}
                        />
                      </div>
                    </>
                  )}

                  {editType === 'font-size' && (
                    <>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.value}</label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={value.replace(/[^0-9.]/g, '')}
                          onChange={(e) => setValue(e.target.value ? `${e.target.value}px` : '')}
                          className="rounded-xl text-sm w-24"
                          placeholder="16"
                        />
                        <span className="text-sm text-slate-500 shrink-0">{tr.fontSizeUnit}</span>
                      </div>
                    </>
                  )}

                  {editType === 'display' && (
                    <>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.value}</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setValue('block')}
                          className={[
                            'flex-1 rounded-xl border py-2 text-sm font-medium transition-colors',
                            value === 'block'
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          👁 {tr.displayShow}
                        </button>
                        <button
                          onClick={() => setValue('none')}
                          className={[
                            'flex-1 rounded-xl border py-2 text-sm font-medium transition-colors',
                            value === 'none'
                              ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50',
                          ].join(' ')}
                        >
                          🚫 {tr.displayHide}
                        </button>
                      </div>
                    </>
                  )}

                  {editType === 'custom' && (
                    <>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.customProperty}</label>
                      <Input
                        value={customProperty}
                        onChange={(e) => setCustomProperty(e.target.value)}
                        className="rounded-xl text-sm font-mono"
                        placeholder="color, background-color, text …"
                      />
                      <p className="text-[11px] text-slate-400">{tr.customPropertyHint}</p>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.customValue}</label>
                      <Input
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        className="rounded-xl text-sm font-mono"
                      />
                    </>
                  )}
                </div>

                {/* Variant + Flag key */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.variant}</label>
                  <Input value={variant} onChange={(e) => setVariant(e.target.value)} className="rounded-xl text-sm" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.flagKey}</label>
                  <Input value={flagKey} onChange={(e) => setFlagKey(e.target.value)} className="rounded-xl text-sm font-mono" />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline" size="sm" className="gap-1.5 rounded-xl flex-1"
                    onClick={handlePreview}
                    disabled={!selector || !effectiveProperty}
                  >
                    <Play className="h-3.5 w-3.5" /> {tr.preview}
                  </Button>
                  <Button
                    size="sm" className="gap-1.5 rounded-xl flex-1"
                    onClick={handleSave}
                    disabled={saving || !selector || !effectiveProperty}
                  >
                    <Save className="h-3.5 w-3.5" /> {saving ? tr.saving : tr.save}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Saved changes */}
      <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
        <CardContent className="pt-5">
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">{tr.savedChanges}</p>
          {changes.length === 0 ? (
            <p className="text-sm text-slate-400">{tr.noChanges}</p>
          ) : (
            <div className="space-y-2">
              {changes.map((c) => (
                <div key={c.id} className="flex items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 px-3 py-2 text-xs">
                  <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300 shrink-0">
                    {c.variant}
                  </span>
                  <code className="font-mono text-slate-500 dark:text-slate-400 truncate flex-1">{c.selector}</code>
                  <span className="font-mono text-slate-700 dark:text-slate-200 shrink-0">{c.property}: {c.value}</span>
                  <Button
                    variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-rose-600 shrink-0"
                    onClick={() => handleDelete(c.id)} aria-label={tr.delete}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
