// Visual Editor SDK hooks for the example app.
//
// Two responsibilities:
//   1. Always: listen for `exp:apply-change` messages and mutate the DOM
//      (used by the dashboard editor preview, and could be reused in prod).
//   2. Editor mode only (?__exp_editor=true): highlight elements on hover,
//      and on click report the element's CSS selector to the parent window.

const MSG_APPLY = 'exp:apply-change';
const MSG_SELECTED = 'exp:element-selected';
const MSG_READY = 'exp:editor-ready';

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

function applyChange(selector: string, property: string, value: string): void {
  let el: Element | null = null;
  try {
    el = document.querySelector(selector);
  } catch {
    return;
  }
  if (!el) return;

  if (property === 'text' || property === 'textContent') {
    (el as HTMLElement).textContent = value;
  } else {
    (el as HTMLElement).style.setProperty(property, value);
  }
}

let initialized = false;

export function initVisualEditor(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // Always apply changes pushed by the parent (dashboard preview).
  window.addEventListener('message', (e: MessageEvent) => {
    const d = e.data;
    if (!d || typeof d !== 'object') return;
    if (d.type === MSG_APPLY && typeof d.selector === 'string') {
      applyChange(d.selector, d.property, d.value);
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

  // Intercept clicks: select the element instead of activating it.
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

  // Tell the parent we're ready so it can push existing changes.
  if (window !== window.parent) {
    window.parent.postMessage({ type: MSG_READY }, '*');
  }
}
