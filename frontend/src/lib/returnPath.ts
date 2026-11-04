import { createPath } from 'react-router-dom';

/** Preserve a local screen's query/hash without accepting external or login-loop targets. */
export function safeReturnPath(value: unknown): string | null {
  let path = typeof value === 'string' ? value : null;
  if (value && typeof value === 'object' && 'pathname' in value && typeof value.pathname === 'string') {
    path = createPath({
      pathname: value.pathname,
      search: 'search' in value && typeof value.search === 'string' ? value.search : '',
      hash: 'hash' in value && typeof value.hash === 'string' ? value.hash : '',
    });
  }
  return path && /^\/(?!\/)[^\\\x00-\x20\x7f]*$/.test(path)
    && !/%(?:0[0-9a-f]|1[0-9a-f]|20|25|2f|5c|7f)/i.test(path)
    && !/^\/login(?:[/?#]|$)/.test(path) ? path : null;
}
