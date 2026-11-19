import test from 'node:test';
import assert from 'node:assert/strict';
import { assignVisitor, compareRates, isClickAt } from './assignmentSimulation.js';

test('participation and A:B endpoints have separate meanings', () => {
  for (const [participation, aShare, expected] of [[0, 0, 'outside'], [0, 100, 'outside'], [100, 0, 'B'], [100, 100, 'A']]) {
    const assignments = new Map();
    for (let i = 0; i < 1000; i++) assert.equal(assignVisitor(assignments, `U-${i}`, participation, aShare), expected);
  }
});

test('the first path for an ID stays fixed within a run, including non-participation', () => {
  for (const first of [[0, 0], [100, 0], [100, 100], [60, 50]]) {
    const assignments = new Map();
    const original = assignVisitor(assignments, 'same-id', ...first);
    for (const changed of [[0, 0], [100, 0], [100, 100], [80, 20]]) {
      assert.equal(assignVisitor(assignments, 'same-id', ...changed), original);
      assert.equal(assignments.size, 1);
    }
  }
});

test('clearing assignments permits re-evaluation; the same ID and configuration are deterministic', () => {
  const assignments = new Map();
  assert.equal(assignVisitor(assignments, 'visitor', 100, 0), 'B');
  assignments.clear();
  assert.equal(assignVisitor(assignments, 'visitor', 100, 100), 'A');
  for (let i = 0; i < 100; i++) {
    assert.equal(assignVisitor(new Map(), `id-${i}`, 73, 41), assignVisitor(new Map(), `id-${i}`, 73, 41));
  }
});

test('participation and conditional A:B approach their targets without forcing sample totals', () => {
  const assignments = new Map();
  const counts = { outside: 0, A: 0, B: 0 };
  for (let i = 0; i < 20000; i++) counts[assignVisitor(assignments, `sample-${i}`, 70, 80)]++;
  assert.equal(Object.values(counts).reduce((a, b) => a + b, 0), 20000);
  for (const [outcome, expected] of Object.entries({ outside: 30, A: 56, B: 14 })) {
    assert(Math.abs(counts[outcome] / 200 - expected) < 1, `${outcome}: ${counts[outcome]}`);
  }
  assert.notEqual(counts.A, 11200);
});

test('invalid settings do not create an assignment', () => {
  const assignments = new Map();
  for (const values of [[-1, 50], [101, 50], [50, -1], [50, 101], [NaN, 50], [50, Infinity]]) {
    assert.throws(() => assignVisitor(assignments, 'invalid', ...values), RangeError);
  }
  assert.throws(() => assignVisitor(assignments, '', 50, 50), TypeError);
  assert.equal(assignments.size, 0);
});

test('compareRates: 8/100 vs 11/100 leans B but is not decisive; 10x the sample is', () => {
  const small = compareRates(8, 100, 11, 100);
  assert.ok(Math.abs(small.diff - 0.03) < 1e-9);
  assert.equal(small.decisive, false);
  assert.equal(compareRates(80, 1000, 110, 1000).decisive, true);
  assert.equal(compareRates(0, 0, 0, 0).decisive, false);
});

test('isClickAt yields exactly floor(n * rate) clicks', () => {
  for (const [n, rate] of [[97, 8], [103, 11], [100, 8], [1, 50]]) {
    let clicks = 0;
    for (let k = 1; k <= n; k++) clicks += isClickAt(k, rate) ? 1 : 0;
    assert.equal(clicks, Math.floor(n * rate / 100));
  }
});
