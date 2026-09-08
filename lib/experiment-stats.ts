export type MetricDirection = 'higher' | 'lower';
export type ExperimentDecision = 'won' | 'lost' | 'inconclusive';

export type ExperimentStatistics = {
  controlMean: number;
  variantMean: number;
  effect: number;
  ci95: [number, number];
  controlRuns: number;
  variantRuns: number;
  decision: ExperimentDecision;
  reason: string;
};

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function rng(seed: number) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x100000000;
  };
}

function percentile(values: number[], q: number) {
  const ordered = [...values].sort((a, b) => a - b);
  const position = (ordered.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return ordered[lower];
  return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower);
}

function sampleWithReplacement(values: number[], random: () => number) {
  return Array.from({ length: values.length }, () => values[Math.floor(random() * values.length)]);
}

export function parseRuns(value: string): number[] {
  return value
    .split(/[\s,]+/)
    .map((part) => Number(part.trim()))
    .filter((item) => Number.isFinite(item));
}

export function evaluateExperiment(
  control: number[],
  variant: number[],
  direction: MetricDirection,
  { seed = 20260908, bootstrapSamples = 2000, minimumRuns = 3 } = {},
): ExperimentStatistics {
  if (!control.length || !variant.length) {
    throw new Error('control and variant require at least one observation');
  }
  const controlMean = mean(control);
  const variantMean = mean(variant);
  const directionSign = direction === 'higher' ? 1 : -1;
  const effect = (variantMean - controlMean) * directionSign;

  if (control.length < minimumRuns || variant.length < minimumRuns) {
    return {
      controlMean,
      variantMean,
      effect,
      ci95: [Number.NaN, Number.NaN],
      controlRuns: control.length,
      variantRuns: variant.length,
      decision: 'inconclusive',
      reason: `minimum ${minimumRuns} repeated observations per arm required`,
    };
  }

  const random = rng(seed);
  const effects = Array.from({ length: bootstrapSamples }, () => {
    const controlSample = sampleWithReplacement(control, random);
    const variantSample = sampleWithReplacement(variant, random);
    return (mean(variantSample) - mean(controlSample)) * directionSign;
  });
  const ci95: [number, number] = [percentile(effects, 0.025), percentile(effects, 0.975)];
  const decision: ExperimentDecision = ci95[0] > 0 ? 'won' : ci95[1] < 0 ? 'lost' : 'inconclusive';
  const reason = decision === 'won'
    ? '95% bootstrap interval supports the variant in the declared metric direction'
    : decision === 'lost'
      ? '95% bootstrap interval supports the control in the declared metric direction'
      : '95% bootstrap interval crosses zero';

  return {
    controlMean,
    variantMean,
    effect,
    ci95,
    controlRuns: control.length,
    variantRuns: variant.length,
    decision,
    reason,
  };
}
