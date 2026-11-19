import assert from 'node:assert/strict';
import { diffCI } from './stats.js';
const { diff, low, high } = diffCI(8, 100, 11, 100);
assert.ok(Math.abs(diff - 3) < 1e-9);
assert.ok(low < 0 && high > 0, 'interval must cross 0 for the "hold" story');
assert.equal(low.toFixed(1), '-5.1');
assert.equal(high.toFixed(1), '11.1');
console.log('ok', low.toFixed(1), high.toFixed(1));
