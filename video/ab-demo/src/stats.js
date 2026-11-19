// 95% Wald interval for the difference of two proportions (B − A), in percentage points.
export function diffCI(clicksA, nA, clicksB, nB) {
  const a = clicksA / nA, b = clicksB / nB;
  const se = Math.sqrt(a * (1 - a) / nA + b * (1 - b) / nB);
  return { diff: (b - a) * 100, low: (b - a - 1.96 * se) * 100, high: (b - a + 1.96 * se) * 100 };
}
