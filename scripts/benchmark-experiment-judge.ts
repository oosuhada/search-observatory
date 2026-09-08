import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

import { evaluateExperiment } from '../lib/experiment-stats.ts';

const fixtures = [
  { id: 'clear-win-lower', control: [31, 29, 33, 30, 32], variant: [17, 18, 16, 19, 17], direction: 'lower' as const },
  { id: 'overlap-higher', control: [10, 12, 14, 16, 18], variant: [11, 13, 15, 17, 19], direction: 'higher' as const },
  { id: 'underpowered', control: [40, 42], variant: [30, 31], direction: 'lower' as const },
];

const results = fixtures.map((fixture) => ({
  id: fixture.id,
  ...evaluateExperiment(fixture.control, fixture.variant, fixture.direction),
}));
const payload = {
  experiment: 'search-observatory-repeated-measurement-judge-v1',
  git_sha: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
  generated_at: new Date().toISOString(),
  seed: 20260908,
  bootstrap_samples: 2000,
  protocol: 'unpaired non-parametric bootstrap of direction-normalized mean difference',
  results,
  limitations: [
    'Synthetic fixtures validate decision logic; they are not SEO performance claims.',
    'Bootstrap intervals do not correct for seasonality, indexing delays, or non-independent pages.',
  ],
};
mkdirSync('benchmarks', { recursive: true });
writeFileSync('benchmarks/experiment-judge.json', `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify(payload, null, 2));
