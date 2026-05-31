// Visual Editor SDK hooks for the example app.
//
// Responsibilities:
//   1. Always: listen for `exp:apply-change` postMessages and mutate the DOM.
//   2. Export applyVisualChanges() to apply changes from the decide API response.
//   3. Editor mode only (?__exp_editor=true): highlight elements on hover,
//      and on click report the element's CSS selector to the parent window.

const MSG_APPLY = 'exp:apply-change';
const MSG_SELECTED = 'exp:element-selected';
const MSG_READY = 'exp:editor-ready';
const MSG_APPLY_CHANGES = 'exp:apply-changes';
const MSG_CLEAR_CHANGES = 'exp:clear-changes';
const MSG_HIGHLIGHT = 'exp:highlight-element';
const MSG_INIT_EDITOR = 'exp:init-editor-mode';

export interface VisualChangePayload {
  selector: string;
  type: string;
  value: string;
}

export function isEditorMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('__exp_editor') === 'true';
  } catch {
    return false;
  }
}

/** Build a reasonably-stable CSS selector for an element. */
export function cssSelector(el: Element): string {
  if (el.id) return `#${CSS.escape(el.id)}`;

  const parts: string[] = [];
  let node: Element | null = el;

  while (node && node.nodeType === 1 && node !== document.body && node !== document.documentElement) {
    let part = node.tagName.toLowerCase();
    const parent: Element | null = node.parentElement;

    if (parent) {
      const tag = node.tagName;
      const sameTag = Array.from(parent.children).filter((c) => c.tagName === tag);
      if (sameTag.length > 1) {
        part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }
    }

    parts.unshift(part);
    node = node.parentElement;
  }

  return parts.join(' > ');
}

function applyChange(selector: string, changeType: string, value: string): void {
  let el: Element | null = null;
  try {
    el = document.querySelector(selector);
  } catch {
    return;
  }
  if (!el) return;

  const html = el as HTMLElement;
  switch (changeType) {
    case 'text':
      html.textContent = value;
      break;
    case 'color':
      html.style.color = value;
      break;
    case 'backgroundColor':
      html.style.backgroundColor = value;
      break;
    case 'fontSize':
      html.style.fontSize = value;
      break;
    case 'visibility':
      html.style.display = value;
      break;
    case 'size': {
      try {
        const { width, height } = JSON.parse(value) as Record<string, string>;
        if (width) html.style.width = width;
        if (height) html.style.height = height;
      } catch { /* ignore */ }
      break;
    }
    case 'spacing': {
      try {
        const s = JSON.parse(value) as Record<string, string>;
        Object.entries(s).forEach(([k, v]) => {
          (html.style as unknown as Record<string, string>)[k] = v;
        });
      } catch { /* ignore */ }
      break;
    }
    case 'position': {
      try {
        const { position, top, left, right, bottom } = JSON.parse(value) as Record<string, string>;
        if (position) html.style.position = position;
        if (top !== undefined) html.style.top = top;
        if (left !== undefined) html.style.left = left;
        if (right !== undefined) html.style.right = right;
        if (bottom !== undefined) html.style.bottom = bottom;
      } catch { /* ignore */ }
      break;
    }
    case 'css': {
      try {
        const { property: prop, value: val } = JSON.parse(value) as { property: string; value: string };
        if (prop) html.style.setProperty(prop, val);
      } catch { /* ignore */ }
      break;
    }
    default:
      // Legacy: treat changeType as a CSS property name
      if (changeType === 'display') {
        html.style.display = value;
      } else if (changeType === 'background-color') {
        html.style.backgroundColor = value;
      } else if (changeType === 'font-size') {
        html.style.fontSize = value;
      } else {
        html.style.setProperty(changeType, value);
      }
  }
}

export function applyVisualChanges(changes: VisualChangePayload[]): void {
  for (const change of changes) {
    applyChange(change.selector, change.type, change.value);
  }
}

interface AppliedRecord {
  el: HTMLElement;
  origOutline: string;
  origOutlineOffset: string;
  origText?: string;
  origStyles: Record<string, string>;
}

let appliedStore: AppliedRecord[] = [];
let hlEl: HTMLElement | null = null;
let hlPrevOutline = '';
let hlPrevOffset = '';
let hlTimer: ReturnType<typeof setTimeout> | null = null;

function styleKeysForType(changeType: string, value: string): string[] {
  switch (changeType) {
    case 'color': return ['color'];
    case 'backgroundColor': return ['backgroundColor'];
    case 'fontSize': return ['fontSize'];
    case 'visibility': return ['display'];
    case 'size': return ['width', 'height'];
    case 'spacing': return ['marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
    case 'position': return ['position', 'top', 'left', 'right', 'bottom'];
    case 'css': {
      try {
        const { property: prop } = JSON.parse(value) as { property: string; value: string };
        return prop ? [prop] : [];
      } catch { return []; }
    }
    default: return [];
  }
}

function applyChangesWithHighlight(changes: VisualChangePayload[]): void {
  clearAppliedChanges();
  for (const change of changes) {
    let el: Element | null = null;
    try { el = document.querySelector(change.selector); } catch { continue; }
    if (!el) continue;
    const html = el as HTMLElement;

    const keys = styleKeysForType(change.type, change.value);
    const origStyles: Record<string, string> = {};
    for (const k of keys) {
      origStyles[k] = (html.style as unknown as Record<string, string>)[k] || '';
    }

    const record: AppliedRecord = {
      el: html,
      origOutline: html.style.outline,
      origOutlineOffset: html.style.outlineOffset,
      origStyles,
    };
    if (change.type === 'text') record.origText = html.textContent ?? '';

    applyChange(change.selector, change.type, change.value);
    html.style.outline = '2px solid #6366f1';
    html.style.outlineOffset = '2px';
    appliedStore.push(record);
  }
}

function clearAppliedChanges(): void {
  for (const r of appliedStore) {
    r.el.style.outline = r.origOutline;
    r.el.style.outlineOffset = r.origOutlineOffset;
    if (r.origText !== undefined) r.el.textContent = r.origText;
    for (const [k, v] of Object.entries(r.origStyles)) {
      (r.el.style as unknown as Record<string, string>)[k] = v;
    }
  }
  appliedStore = [];
}

function highlightElement(selector: string): void {
  if (hlTimer) { clearTimeout(hlTimer); hlTimer = null; }
  if (hlEl) {
    hlEl.style.outline = hlPrevOutline;
    hlEl.style.outlineOffset = hlPrevOffset;
    hlEl = null;
  }
  if (!selector) return;
  let el: Element | null = null;
  try { el = document.querySelector(selector); } catch { return; }
  if (!el) return;
  const html = el as HTMLElement;
  hlPrevOutline = html.style.outline;
  hlPrevOffset = html.style.outlineOffset;
  hlEl = html;
  html.style.outline = '3px solid #4f46e5';
  html.style.outlineOffset = '3px';
  hlTimer = setTimeout(() => {
    if (hlEl === html) {
      html.style.outline = hlPrevOutline;
      html.style.outlineOffset = hlPrevOffset;
      hlEl = null;
    }
    hlTimer = null;
  }, 1500);
}

let messageListenerReady = false;
let editorModeReady = false;

function setupEditorListeners(): void {
  if (editorModeReady) return;
  editorModeReady = true;

  const style = document.createElement('style');
  style.textContent =
    '.exp-editor-hover{outline:2px solid #6366f1!important;outline-offset:1px;cursor:pointer!important;}';
  document.head.appendChild(style);

  let hovered: Element | null = null;
  document.addEventListener(
    'mouseover',
    (e) => {
      const target = e.target as Element | null;
      if (!target || target === document.body) return;
      if (hovered) hovered.classList.remove('exp-editor-hover');
      hovered = target;
      target.classList.add('exp-editor-hover');
    },
    true,
  );
  document.addEventListener(
    'mouseout',
    (e) => {
      (e.target as Element | null)?.classList.remove('exp-editor-hover');
    },
    true,
  );

  document.addEventListener(
    'click',
    (e) => {
      if (window === window.parent) return;
      const target = e.target as Element | null;
      if (!target) return;
      e.preventDefault();
      e.stopPropagation();
      window.parent.postMessage({
        type: MSG_SELECTED,
        selector: cssSelector(target),
        tagName: target.tagName.toLowerCase(),
        textContent: (target as HTMLElement).textContent?.trim().slice(0, 100) || '',
      }, '*');
    },
    true,
  );
}

export function initVisualEditor(): void {
  if (typeof window === 'undefined') return;

  if (!messageListenerReady) {
    messageListenerReady = true;
    window.addEventListener('message', (e: MessageEvent) => {
      const d = e.data;
      if (!d || typeof d !== 'object') return;
      if (d.type === MSG_INIT_EDITOR) {
        // Parent explicitly requests editor mode (e.g. URL param was stripped by redirect)
        setupEditorListeners();
        return;
      }
      if (d.type === MSG_APPLY && typeof d.selector === 'string') {
        const changeType: string = d.changeType ?? d.property ?? '';
        applyChange(d.selector, changeType, d.value ?? '');
      } else if (d.type === MSG_APPLY_CHANGES && Array.isArray(d.changes)) {
        applyChangesWithHighlight(d.changes as VisualChangePayload[]);
      } else if (d.type === MSG_CLEAR_CHANGES) {
        clearAppliedChanges();
      } else if (d.type === MSG_HIGHLIGHT) {
        highlightElement(typeof d.selector === 'string' ? d.selector : '');
      }
    });

    // Always notify parent that the message listener is active.
    // The parent will respond with MSG_INIT_EDITOR to activate editor mode.
    if (window !== window.parent) {
      window.parent.postMessage({ type: MSG_READY }, '*');
    }
  }

  // Also activate immediately if URL param is present (no round-trip needed)
  if (isEditorMode()) setupEditorListeners();
}
