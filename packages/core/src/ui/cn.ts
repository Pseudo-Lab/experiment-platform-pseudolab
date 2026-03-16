/**
 * Core UI utility candidate extracted for OSS split PoC.
 * Dependency-free class combiner with minimal Tailwind conflict resolution
 * for common utility groups used in our UI components.
 */
export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

function flatten(input: ClassValue, out: string[]) {
  if (!input) return;
  if (typeof input === 'string' || typeof input === 'number') {
    out.push(String(input));
    return;
  }
  if (Array.isArray(input)) {
    for (const v of input) flatten(v, out);
    return;
  }
  if (typeof input === 'object') {
    for (const [k, v] of Object.entries(input)) {
      if (v) out.push(k);
    }
  }
}

function groupKey(base: string): string | null {
  if (/^text-(xs|sm|base|lg|xl|[2-9]xl)$/.test(base)) return 'text-size';
  if (/^h-/.test(base)) return 'height';
  if (/^w-/.test(base)) return 'width';
  if (/^p[trblxy]?-[^\s]+$/.test(base)) return base.split('-')[0];
  if (/^m[trblxy]?-[^\s]+$/.test(base)) return base.split('-')[0];
  if (/^rounded(?:-[trbl]{1,2})?-[^\s]+$/.test(base) || base === 'rounded') return 'rounded';
  return null;
}

export function cn(...inputs: ClassValue[]) {
  const flat: string[] = [];
  for (const i of inputs) flatten(i, flat);

  const tokens = flat.join(' ').trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  const seenIndex = new Map<string, number>();

  for (const token of tokens) {
    const parts = token.split(':');
    const base = parts[parts.length - 1] ?? token;
    const variants = parts.length > 1 ? `${parts.slice(0, -1).join(':')}:` : '';
    const g = groupKey(base);
    const key = g ? `${variants}${g}` : `${variants}${base}`;

    if (seenIndex.has(key)) {
      out[seenIndex.get(key)!] = token;
    } else {
      seenIndex.set(key, out.length);
      out.push(token);
    }
  }

  return out.join(' ');
}
