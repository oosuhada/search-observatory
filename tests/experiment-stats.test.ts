import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateExperiment, parseRuns } from '../lib/experiment-stats.ts';

test('requires repeated measurements before declaring a winner', () => {
  const result = evaluateExperiment([31], [17], 'lower');
  assert.equal(result.decision, 'inconclusive');
  assert.match(result.reason, /minimum 3/);
});

test('declares a lower-is-better variant only when bootstrap interval clears zero', () => {
  const result = evaluateExperiment([31, 29, 33, 30, 32], [17, 18, 16, 19, 17], 'lower');
  assert.equal(result.decision, 'won');
  assert.ok(result.ci95[0] > 0);
});

test('keeps overlapping observations inconclusive', () => {
  const result = evaluateExperiment([10, 12, 14, 16], [11, 13, 15, 17], 'higher');
  assert.equal(result.decision, 'inconclusive');
});

test('parses comma and whitespace separated repeated observations', () => {
  assert.deepEqual(parseRuns('10, 11.5  12\n13'), [10, 11.5, 12, 13]);
});
