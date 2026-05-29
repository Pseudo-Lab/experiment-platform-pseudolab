import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Card, CardContent } from '../../../components/ui/card';
import { ArrowLeft, Play, Save, Trash2, MousePointerClick } from 'lucide-react';
import { visualChangeApi, type VisualChange } from '../../../services/api';

interface Props { lang: 'en' | 'ko'; }

// postMessage contract shared with the example-app SDK (see features/example/lib/visualEditor.ts)
const MSG_APPLY = 'exp:apply-change';
const MSG_SELECTED = 'exp:element-selected';
const MSG_READY = 'exp:editor-ready';

const t = {
  ko: {
    back: 'Projects로',
    title: 'Visual Editor',
    urlPlaceholder: '앱 URL (예: https://sub.pseudolab-devfactory.com/example)',
    load: '로드',
    selectHint: '왼쪽 앱에서 편집할 요소를 클릭하세요.',
    selectedElement: '선택된 요소',
    none: '선택 안 됨',
    variant: 'Variant',
    flagKey: 'Flag key (선택)',
    property: 'Property',
    propertyHint: 'CSS 속성명 또는 text (예: color, background-color, font-size, text)',
    value: 'Value',
    preview: '미리보기',
    save: '저장',
    saving: '저장 중...',
    savedChanges: '저장된 변경사항',
    noChanges: '저장된 변경사항이 없습니다.',
    delete: '삭제',
    loadFirst: '앱 URL을 입력하고 로드하세요.',
  },
  en: {
    back: 'To Projects',
    title: 'Visual Editor',
    urlPlaceholder: 'App URL (e.g. https://sub.pseudolab-devfactory.com/example)',
    load: 'Load',
    selectHint: 'Click an element in the app on the left to edit it.',
    selectedElement: 'Selected element',
    none: 'Nothing selected',
    variant: 'Variant',
    flagKey: 'Flag key (optional)',
    property: 'Property',
    propertyHint: 'CSS property name or text (e.g. color, background-color, font-size, text)',
    value: 'Value',
    preview: 'Preview',
    save: 'Save',
    saving: 'Saving...',
    savedChanges: 'Saved changes',
    noChanges: 'No saved changes yet.',
    delete: 'Delete',
    loadFirst: 'Enter an app URL and load it.',
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
  const [variant, setVariant] = useState('treatment');
  const [flagKey, setFlagKey] = useState('');
  const [property, setProperty] = useState('');
  const [value, setValue] = useState('');
  const [changes, setChanges] = useState<VisualChange[]>([]);
  const [saving, setSaving] = useState(false);

  const loadChanges = useCallback(() => {
    if (!projectId) return;
    visualChangeApi.list(projectId).then(setChanges).catch(() => setChanges([]));
  }, [projectId]);

  useEffect(() => { loadChanges(); }, [loadChanges]);

  const postToIframe = useCallback((sel: string, prop: string, val: string) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: MSG_APPLY, selector: sel, property: prop, value: val },
      '*',
    );
  }, []);

  // Receive selection + ready signals from the embedded app.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === MSG_SELECTED && typeof d.selector === 'string') {
        setSelector(d.selector);
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
    if (!selector || !property) return;
    postToIframe(selector, property, value);
  };

  const handleSave = async () => {
    if (!projectId || !selector || !property) return;
    setSaving(true);
    try {
      await visualChangeApi.create(projectId, {
        selector, property, value, variant, flag_key: flagKey || undefined,
      });
      postToIframe(selector, property, value);
      await loadChanges();
      setProperty('');
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* iframe */}
        <Card className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <CardContent className="p-0">
            {loadedSrc ? (
              <iframe
                ref={iframeRef}
                src={loadedSrc}
                title="visual-editor-preview"
                className="w-full h-[600px] border-0 bg-white"
              />
            ) : (
              <div className="h-[600px] flex items-center justify-center text-sm text-slate-400">
                {tr.loadFirst}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right panel */}
        <Card className="rounded-2xl border border-slate-200 dark:border-slate-800">
          <CardContent className="pt-5 space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{tr.selectedElement}</p>
              {selector ? (
                <code className="block text-xs font-mono break-all rounded-lg bg-slate-50 dark:bg-slate-800 px-2 py-1.5 text-indigo-600 dark:text-indigo-300">
                  {selector}
                </code>
              ) : (
                <p className="flex items-center gap-1.5 text-sm text-slate-400">
                  <MousePointerClick className="h-4 w-4" /> {tr.none}
                </p>
              )}
              <p className="text-[11px] text-slate-400">{tr.selectHint}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.variant}</label>
              <Input value={variant} onChange={(e) => setVariant(e.target.value)} className="rounded-xl text-sm" aria-label={tr.variant} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.flagKey}</label>
              <Input value={flagKey} onChange={(e) => setFlagKey(e.target.value)} className="rounded-xl text-sm font-mono" aria-label={tr.flagKey} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.property}</label>
              <Input value={property} onChange={(e) => setProperty(e.target.value)} className="rounded-xl text-sm font-mono" aria-label={tr.property} />
              <p className="text-[11px] text-slate-400">{tr.propertyHint}</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-400">{tr.value}</label>
              <Input value={value} onChange={(e) => setValue(e.target.value)} className="rounded-xl text-sm font-mono" aria-label={tr.value} />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" className="gap-1.5 rounded-xl flex-1" onClick={handlePreview} disabled={!selector || !property}>
                <Play className="h-3.5 w-3.5" /> {tr.preview}
              </Button>
              <Button size="sm" className="gap-1.5 rounded-xl flex-1" onClick={handleSave} disabled={saving || !selector || !property}>
                <Save className="h-3.5 w-3.5" /> {saving ? tr.saving : tr.save}
              </Button>
            </div>
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
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-slate-400 hover:text-rose-600 shrink-0" onClick={() => handleDelete(c.id)} aria-label={tr.delete}>
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
