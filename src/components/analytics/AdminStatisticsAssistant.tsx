import React, { useEffect, useRef, useState } from 'react';
import { LoaderCircle, Send, Sparkles, Square } from 'lucide-react';
import type { StatisticsSnapshot } from '../../lib/statisticsSnapshot';

interface AdminStatisticsAssistantProps {
  /** The same figures the page is showing, so answers always match the charts. */
  statistics: StatisticsSnapshot;
}

type AssistantStatus = 'checking' | 'ready' | 'loading' | 'offline' | 'model_missing' | 'not_configured' | 'unreachable';

const SUGGESTED_QUESTIONS = [
  'How many handovers are waiting for approval?',
  'Which shift takes longest to hand over?',
  'How complete are the SBAR updates?',
  'What is the task carry-over rate?',
];

const API_UNREACHABLE = 'The assistant service is not running. Start the app with "npm run dev".';

export const AdminStatisticsAssistant: React.FC<AdminStatisticsAssistantProps> = ({ statistics }) => {
  const [question, setQuestion] = useState('');
  const [asked, setAsked] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<AssistantStatus>('checking');
  const [model, setModel] = useState('');
  const request = useRef<AbortController | null>(null);

  // Check the assistant on arrival. This also asks the server to load the model into memory,
  // so the first question is answered as quickly as the rest.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const check = async () => {
      try {
        const response = await fetch('/api/health');
        const health = (await response.json()) as { status?: AssistantStatus; model?: string };
        if (cancelled) return;
        setStatus(health.status ?? 'unreachable');
        setModel(health.model ?? '');
        attempts += 1;
        if (health.status === 'loading' && attempts < 60) timer = setTimeout(check, 1500);
      } catch {
        if (!cancelled) setStatus('unreachable');
      }
    };
    void check();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Have the model read the current figures before the first question, so that question is fast too.
  // It runs again whenever the figures change (new records, or switching to demo data).
  const figures = JSON.stringify(statistics);
  const canPrepare = status === 'ready' || status === 'loading';
  const [preparedFigures, setPreparedFigures] = useState('');
  useEffect(() => {
    if (!canPrepare) return;
    let cancelled = false;
    fetch('/api/admin/statistics/prepare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statistics: JSON.parse(figures) }),
    })
      .then((response) => response.json())
      .then((result: { prepared?: boolean }) => {
        if (cancelled) return;
        // Whether or not preparation worked, questions can be asked; they are just slower without it.
        setPreparedFigures(figures);
        if (result.prepared) setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setPreparedFigures(figures);
      });
    return () => {
      cancelled = true;
    };
  }, [figures, canPrepare]);
  const isPreparing = canPrepare && preparedFigures !== figures;

  // A different data source makes the previous answer stale.
  useEffect(() => {
    request.current?.abort();
    setAnswer('');
    setAsked('');
    setError('');
    setIsLoading(false);
  }, [statistics.datasetKind]);

  useEffect(() => () => request.current?.abort(), []);

  const stop = () => {
    request.current?.abort();
    setIsLoading(false);
  };

  const ask = async (value = question) => {
    const cleanQuestion = value.trim();
    if (cleanQuestion.length < 3) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;

    setQuestion('');
    setAsked(cleanQuestion);
    setError('');
    setAnswer('');
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/statistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: cleanQuestion, statistics }),
        signal: controller.signal,
      });

      const isJson = (response.headers.get('content-type') || '').includes('application/json');
      if (isJson) {
        // Errors, and providers that answer in one piece, arrive as JSON.
        const result = (await response.json()) as { answer?: string; error?: string };
        if (!response.ok || !result.answer) throw new Error(result.error || 'The assistant could not answer right now.');
        setAnswer(result.answer);
      } else if (!response.ok || !response.body) {
        throw new Error(response.status >= 500 ? API_UNREACHABLE : 'The assistant could not answer right now.');
      } else {
        // The local model streams its answer; show each piece as it arrives.
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = '';
        for (;;) {
          const { done, value: chunk } = await reader.read();
          if (done) break;
          text += decoder.decode(chunk, { stream: true });
          setAnswer(text);
        }
        if (!text.trim()) throw new Error('The assistant returned no answer. Please try again.');
        setStatus('ready');
      }
    } catch (requestError) {
      if (controller.signal.aborted) return;
      const message = requestError instanceof Error ? requestError.message : '';
      setError(/failed to fetch|networkerror|load failed/i.test(message) ? API_UNREACHABLE : message || 'The assistant could not answer right now.');
    } finally {
      if (request.current === controller) setIsLoading(false);
    }
  };

  const statusText: Record<AssistantStatus, string> = {
    checking: 'Checking the assistant…',
    ready: `${model || 'Assistant'} is ready`,
    loading: `Loading ${model || 'the model'}…`,
    offline: 'Ollama is not running. Start Ollama, then reload this page.',
    model_missing: `The model is not installed. Run: ollama pull ${model}`,
    not_configured: 'The assistant is not configured on the server.',
    unreachable: API_UNREACHABLE,
  };
  const isReady = status === 'ready' && !isPreparing;
  const statusLine = isPreparing ? `Preparing ${model || 'the model'}…` : statusText[status];
  const statusTone = isReady
    ? 'bg-teal-600'
    : isPreparing || status === 'checking' || status === 'loading' ? 'bg-amber-500 animate-pulse' : 'bg-rose-600';

  return (
    <section aria-labelledby="statistics-assistant-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-teal-50 p-2.5 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 id="statistics-assistant-title" className="text-lg font-bold text-slate-900 dark:text-white">Ask about these figures</h3>
          <p role="status" className="mt-0.5 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${statusTone}`} />
            {statusLine}
          </p>
        </div>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void ask(); }} className="mt-4 flex gap-2">
        <input
          aria-label="Ask a question about the statistics"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={500}
          placeholder="Ask a question"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
        {isLoading ? (
          <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            <Square className="h-4 w-4" /> Stop
          </button>
        ) : (
          <button type="submit" disabled={question.trim().length < 3} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
            <Send className="h-4 w-4" /> Ask
          </button>
        )}
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTED_QUESTIONS.map((suggestion) => (
          <button key={suggestion} type="button" onClick={() => void ask(suggestion)} className="rounded-full border border-slate-200 px-3 py-1.5 text-left text-sm text-slate-700 hover:border-teal-400 hover:text-teal-800 dark:border-slate-700 dark:text-slate-300 dark:hover:text-teal-300">
            {suggestion}
          </button>
        ))}
      </div>

      {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}

      {asked && !error && (
        <div aria-live="polite" className="mt-4 rounded-xl bg-slate-50 px-4 py-3.5 dark:bg-slate-800/60">
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
            {asked}
            {statistics.datasetKind === 'synthetic' && (
              <span className="ml-2 rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-bold text-amber-900">Demo data</span>
            )}
          </p>
          {answer ? (
            <p className="mt-1.5 whitespace-pre-wrap text-base leading-relaxed text-slate-900 dark:text-slate-100">{answer}</p>
          ) : (
            <p className="mt-1.5 flex items-center gap-2 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Reading the figures…</p>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        The assistant sees only the totals on this page, never names or handover text. Check important figures against the charts.
      </p>
    </section>
  );
};
