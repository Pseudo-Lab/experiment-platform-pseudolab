import { afterEach, describe, expect, it } from 'vitest';
import { cssSelector } from '@/features/example/lib/visualEditor';

describe('cssSelector', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('prefers id when present', () => {
    document.body.innerHTML = '<div><button id="cta">Go</button></div>';
    const el = document.getElementById('cta')!;
    expect(cssSelector(el)).toBe('#cta');
  });

  it('builds a descendant path with nth-of-type for siblings', () => {
    document.body.innerHTML = `
      <section>
        <p>first</p>
        <p>second</p>
        <p>third</p>
      </section>`;
    const target = document.querySelectorAll('p')[1];
    const selector = cssSelector(target);
    expect(selector).toContain('p:nth-of-type(2)');
    // selector should resolve back to the same element
    expect(document.querySelector(selector)).toBe(target);
  });

  it('omits nth-of-type for unique tags', () => {
    document.body.innerHTML = '<section><h1>title</h1><p>body</p></section>';
    const h1 = document.querySelector('h1')!;
    const selector = cssSelector(h1);
    expect(selector).not.toContain('nth-of-type');
    expect(document.querySelector(selector)).toBe(h1);
  });
});
