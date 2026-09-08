'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { evaluateExperiment, parseRuns, type MetricDirection } from '../lib/experiment-stats';

type ExperimentStatus = 'running' | 'won' | 'lost' | 'inconclusive';

type SearchExperiment = {
  id: string;
  question: string;
  hypothesis: string;
  control: string;
  variant: string;
  metric: string;
  metricDirection: MetricDirection;
  controlValue: number;
  variantValue: number;
  controlRuns: number[];
  variantRuns: number[];
  status: ExperimentStatus;
  source: string;
  observation: string;
  createdAt: string;
};

const STORAGE_KEY = 'search-observatory.experiments.v1';

const initialExperiments: SearchExperiment[] = [
  {
    id: 'demo-json-ld',
    question: 'FAQ JSON-LD가 신규 페이지의 검색 노출 속도를 개선하는가?',
    hypothesis: '구조화된 데이터가 검색엔진의 문서 이해를 돕고 첫 노출까지 걸리는 시간을 줄일 것이다.',
    control: '기본 metadata만 적용',
    variant: 'metadata + FAQ JSON-LD 적용',
    metric: '첫 노출까지 걸린 시간 (h)',
    metricDirection: 'lower',
    controlValue: 31,
    variantValue: 17,
    controlRuns: [31],
    variantRuns: [17],
    status: 'inconclusive',
    source: 'Synthetic UI example — replace with Search Console / URL inspection observations',
    observation: '단일 관측은 예시일 뿐 승리 근거가 아닙니다. 각 arm에 최소 3회 반복 관측을 입력해야 자동 판정됩니다.',
    createdAt: new Date().toISOString(),
  },
];

const statusLabel: Record<ExperimentStatus, string> = {
  running: 'RUNNING',
  won: 'VARIANT WON',
  lost: 'CONTROL WON',
  inconclusive: 'INCONCLUSIVE',
};

const normalizeExperiment = (experiment: Partial<SearchExperiment>): SearchExperiment => ({
  id: experiment.id ?? crypto.randomUUID(),
  question: experiment.question ?? '',
  hypothesis: experiment.hypothesis ?? '',
  control: experiment.control ?? '',
  variant: experiment.variant ?? '',
  metric: experiment.metric ?? 'CTR (%)',
  metricDirection: experiment.metricDirection ?? 'higher',
  controlValue: experiment.controlValue ?? 0,
  variantValue: experiment.variantValue ?? 0,
  controlRuns: experiment.controlRuns?.length ? experiment.controlRuns : [experiment.controlValue ?? 0],
  variantRuns: experiment.variantRuns?.length ? experiment.variantRuns : [experiment.variantValue ?? 0],
  status: experiment.status ?? 'running',
  source: experiment.source ?? '',
  observation: experiment.observation ?? '',
  createdAt: experiment.createdAt ?? new Date().toISOString(),
});

export default function HomePage() {
  const [experiments, setExperiments] = useState<SearchExperiment[]>(initialExperiments);
  const [question, setQuestion] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [control, setControl] = useState('');
  const [variant, setVariant] = useState('');
  const [metric, setMetric] = useState('CTR (%)');
  const [metricDirection, setMetricDirection] = useState<MetricDirection>('higher');
  const [source, setSource] = useState('');
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved) as Array<Partial<SearchExperiment>>;
      setExperiments(parsed.map(normalizeExperiment));
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const summary = useMemo(() => {
    const completed = experiments.filter((experiment) => experiment.status !== 'running');
    const wins = completed.filter((experiment) => experiment.status === 'won').length;
    return {
      total: experiments.length,
      running: experiments.filter((experiment) => experiment.status === 'running').length,
      variantWinRate: completed.length === 0 ? 0 : Math.round((wins / completed.length) * 100),
    };
  }, [experiments]);

  const persist = (next: SearchExperiment[]) => {
    setExperiments(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const createExperiment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!question.trim() || !control.trim() || !variant.trim()) return;

    const experiment: SearchExperiment = {
      id: crypto.randomUUID(),
      question: question.trim(),
      hypothesis: hypothesis.trim(),
      control: control.trim(),
      variant: variant.trim(),
      metric: metric.trim() || 'Metric',
      metricDirection,
      controlValue: 0,
      variantValue: 0,
      controlRuns: [],
      variantRuns: [],
      status: 'running',
      source: source.trim(),
      observation: '',
      createdAt: new Date().toISOString(),
    };

    persist([experiment, ...experiments]);
    setQuestion('');
    setHypothesis('');
    setControl('');
    setVariant('');
    setSource('');
  };

  const updateResult = (
    id: string,
    patch: Partial<Pick<SearchExperiment, 'controlValue' | 'variantValue' | 'controlRuns' | 'variantRuns' | 'status' | 'observation'>>,
  ) => {
    persist(
      experiments.map((experiment) =>
        experiment.id === id ? { ...experiment, ...patch } : experiment,
      ),
    );
  };

  const removeExperiment = (id: string) => {
    persist(experiments.filter((experiment) => experiment.id !== id));
  };

  const judgeExperiment = (experiment: SearchExperiment) => {
    const result = evaluateExperiment(experiment.controlRuns, experiment.variantRuns, experiment.metricDirection);
    updateResult(experiment.id, { status: result.decision });
  };

  const exportExperiments = () => {
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), experiments }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `search-observatory-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importExperiments = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text()) as
        | { experiments?: Array<Partial<SearchExperiment>> }
        | Array<Partial<SearchExperiment>>;
      const imported = Array.isArray(payload) ? payload : payload.experiments;
      if (!Array.isArray(imported)) return;
      persist(imported.map(normalizeExperiment));
    } finally {
      event.target.value = '';
    }
  };

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">SEARCH OBSERVATORY / PERSONAL R&D</p>
          <h1>검색 최적화를 감이 아니라 실험으로 기록합니다.</h1>
          <p className="hero-copy">
            metadata, structured data, 내부 링크, 콘텐츠 구조 같은 변경을 가설과 결과로 남겨 실제로 무엇이 작동했는지 축적합니다.
          </p>
        </div>
        <div className="summary-column">
          <div className="summary-grid">
          <article>
            <span>TOTAL</span>
            <strong>{summary.total}</strong>
          </article>
          <article>
            <span>RUNNING</span>
            <strong>{summary.running}</strong>
          </article>
          <article>
            <span>VARIANT WIN</span>
            <strong>{summary.variantWinRate}%</strong>
          </article>
          </div>
          <div className="data-actions">
            <button type="button" onClick={exportExperiments}>JSON 내보내기</button>
            <button type="button" onClick={() => importInputRef.current?.click()}>JSON 가져오기</button>
            <input ref={importInputRef} type="file" accept="application/json" onChange={importExperiments} hidden />
          </div>
        </div>
      </header>

      <section className="panel composer">
        <div className="section-title">
          <span>NEW EXPERIMENT</span>
          <h2>새 검색 실험 설계</h2>
        </div>

        <form onSubmit={createExperiment}>
          <label>
            <span>Question</span>
            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="예: FAQ schema가 검색 노출 속도를 개선하는가?"
            />
          </label>
          <label>
            <span>Hypothesis</span>
            <textarea
              value={hypothesis}
              onChange={(event) => setHypothesis(event.target.value)}
              placeholder="왜 이런 결과가 나올 것으로 예상하는지 적습니다."
            />
          </label>
          <div className="two-column">
            <label>
              <span>Control A</span>
              <input value={control} onChange={(event) => setControl(event.target.value)} placeholder="기존 상태" />
            </label>
            <label>
              <span>Variant B</span>
              <input value={variant} onChange={(event) => setVariant(event.target.value)} placeholder="변경 상태" />
            </label>
          </div>
          <div className="two-column">
            <label>
              <span>Primary metric</span>
              <input value={metric} onChange={(event) => setMetric(event.target.value)} />
            </label>
            <label>
              <span>Winning direction</span>
              <select value={metricDirection} onChange={(event) => setMetricDirection(event.target.value as MetricDirection)}>
                <option value="higher">높을수록 좋음</option>
                <option value="lower">낮을수록 좋음</option>
              </select>
            </label>
          </div>
          <label>
            <span>Evidence source</span>
            <input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Search Console, analytics query, crawl log, experiment URL…" />
          </label>
          <button className="primary-button" type="submit">
            실험 시작
          </button>
        </form>
      </section>

      <section className="experiment-list">
        {experiments.map((experiment) => {
          const stats = experiment.controlRuns.length && experiment.variantRuns.length
            ? evaluateExperiment(experiment.controlRuns, experiment.variantRuns, experiment.metricDirection)
            : null;
          const delta = stats ? stats.variantMean - stats.controlMean : 0;
          const deltaLabel = delta === 0 ? '—' : `${delta > 0 ? '+' : ''}${delta.toFixed(1)}`;

          return (
            <article className="panel experiment-card" key={experiment.id}>
              <div className="experiment-heading">
                <div>
                  <span className={`status ${experiment.status}`}>{statusLabel[experiment.status]}</span>
                  <h2>{experiment.question}</h2>
                </div>
                <button className="ghost-button" type="button" onClick={() => removeExperiment(experiment.id)}>
                  삭제
                </button>
              </div>

              {experiment.hypothesis && <p className="hypothesis">{experiment.hypothesis}</p>}
              {experiment.source && <p className="source-line">SOURCE · {experiment.source}</p>}

              <div className="variant-grid">
                <div className="variant-box">
                  <span>CONTROL A</span>
                  <strong>{experiment.control}</strong>
                  <input
                    type="text"
                    value={experiment.controlRuns.join(', ')}
                    placeholder="31, 29, 33"
                    onChange={(event) =>
                      updateResult(experiment.id, { controlRuns: parseRuns(event.target.value) })
                    }
                  />
                  <small>{stats ? `mean ${stats.controlMean.toFixed(2)} · n=${stats.controlRuns}` : '반복 관측 입력'}</small>
                </div>
                <div className="variant-box emphasis">
                  <span>VARIANT B</span>
                  <strong>{experiment.variant}</strong>
                  <input
                    type="text"
                    value={experiment.variantRuns.join(', ')}
                    placeholder="17, 18, 16"
                    onChange={(event) =>
                      updateResult(experiment.id, { variantRuns: parseRuns(event.target.value) })
                    }
                  />
                  <small>{stats ? `mean ${stats.variantMean.toFixed(2)} · n=${stats.variantRuns}` : '반복 관측 입력'}</small>
                </div>
              </div>

              <div className="result-row">
                <div>
                  <span>{experiment.metric}</span>
                  <strong>{deltaLabel} delta</strong>
                  {stats && Number.isFinite(stats.ci95[0]) ? <small>95% bootstrap CI · {stats.ci95[0].toFixed(2)} to {stats.ci95[1].toFixed(2)}</small> : <small>minimum 3 runs / arm</small>}
                </div>
                <select
                  value={experiment.status}
                  onChange={(event) =>
                    updateResult(experiment.id, { status: event.target.value as ExperimentStatus })
                  }
                >
                  <option value="running">진행 중</option>
                  <option value="won">Variant 승리</option>
                  <option value="lost">Control 승리</option>
                  <option value="inconclusive">결론 없음</option>
                </select>
              </div>
              <div className="observation-row">
                <textarea
                  value={experiment.observation}
                  onChange={(event) => updateResult(experiment.id, { observation: event.target.value })}
                  placeholder="실험 중 관찰한 조건, 교란 요인, 다음 실험에서 확인할 점을 남기세요."
                />
                <button type="button" onClick={() => judgeExperiment(experiment)}>지표 기준 자동 판정</button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
