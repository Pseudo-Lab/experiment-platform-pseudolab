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

let initialized = false;

export function initVisualEditor(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('message', (e: MessageEvent) => {
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === MSG_APPLY && typeof d.selector === 'string') {
      const changeType: string = d.changeType ?? d.property ?? '';
      applyChange(d.selector, changeType, d.value ?? '');
    }
  });

  if (!isEditorMode()) return;

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

  if (window !== window.parent) {
    window.parent.postMessage({ type: MSG_READY }, '*');
  }
}
