'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type ExperimentStatus = 'running' | 'won' | 'lost' | 'inconclusive';

type SearchExperiment = {
  id: string;
  question: string;
  hypothesis: string;
  control: string;
  variant: string;
  metric: string;
  controlValue: number;
  variantValue: number;
  status: ExperimentStatus;
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
    controlValue: 31,
    variantValue: 17,
    status: 'won',
    createdAt: new Date().toISOString(),
  },
];

const statusLabel: Record<ExperimentStatus, string> = {
  running: 'RUNNING',
  won: 'VARIANT WON',
  lost: 'CONTROL WON',
  inconclusive: 'INCONCLUSIVE',
};

export default function HomePage() {
  const [experiments, setExperiments] = useState<SearchExperiment[]>(initialExperiments);
  const [question, setQuestion] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [control, setControl] = useState('');
  const [variant, setVariant] = useState('');
  const [metric, setMetric] = useState('CTR (%)');

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      setExperiments(JSON.parse(saved) as SearchExperiment[]);
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
      controlValue: 0,
      variantValue: 0,
      status: 'running',
      createdAt: new Date().toISOString(),
    };

    persist([experiment, ...experiments]);
    setQuestion('');
    setHypothesis('');
    setControl('');
    setVariant('');
  };

  const updateResult = (
    id: string,
    patch: Partial<Pick<SearchExperiment, 'controlValue' | 'variantValue' | 'status'>>,
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
          <label>
            <span>Primary metric</span>
            <input value={metric} onChange={(event) => setMetric(event.target.value)} />
          </label>
          <button className="primary-button" type="submit">
            실험 시작
          </button>
        </form>
      </section>

      <section className="experiment-list">
        {experiments.map((experiment) => {
          const delta = experiment.variantValue - experiment.controlValue;
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

              <div className="variant-grid">
                <div className="variant-box">
                  <span>CONTROL A</span>
                  <strong>{experiment.control}</strong>
                  <input
                    type="number"
                    step="0.1"
                    value={experiment.controlValue}
                    onChange={(event) =>
                      updateResult(experiment.id, { controlValue: Number(event.target.value) })
                    }
                  />
                </div>
                <div className="variant-box emphasis">
                  <span>VARIANT B</span>
                  <strong>{experiment.variant}</strong>
                  <input
                    type="number"
                    step="0.1"
                    value={experiment.variantValue}
                    onChange={(event) =>
                      updateResult(experiment.id, { variantValue: Number(event.target.value) })
                    }
                  />
                </div>
              </div>

              <div className="result-row">
                <div>
                  <span>{experiment.metric}</span>
                  <strong>{deltaLabel} delta</strong>
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
            </article>
          );
        })}
      </section>
    </main>
  );
}
