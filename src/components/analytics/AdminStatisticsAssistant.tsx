import React, { useMemo, useState } from 'react';
import { LoaderCircle, Send, Sparkles } from 'lucide-react';
import { createSyntheticStatisticsSnapshot } from '../../lib/statisticsSnapshot';
import type { StatisticsSnapshot } from '../../lib/statisticsSnapshot';

interface AdminStatisticsAssistantProps {
  statistics: StatisticsSnapshot;
}

const suggestedQuestions = [
  'How many handovers are waiting for approval?',
  'How complete are the SBAR updates?',
  'What is the task carry-over rate?',
];

export const AdminStatisticsAssistant: React.FC<AdminStatisticsAssistantProps> = ({ statistics }) => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useSyntheticData, setUseSyntheticData] = useState(false);
  const activeStatistics = useMemo(
    () => useSyntheticData ? createSyntheticStatisticsSnapshot(5000, 144861) : statistics,
    [useSyntheticData, statistics]
  );

  const ask = async (value = question) => {
    const cleanQuestion = value.trim();
    if (!cleanQuestion || isLoading) return;
    setQuestion(cleanQuestion);
    setError('');
    setAnswer('');
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/statistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: cleanQuestion, statistics: activeStatistics }),
      });
      const responseText = await response.text();
      if (!responseText.trim()) {
        throw new Error('The assistant API returned an empty response. Start the app with npm run dev, or deploy it with npm start.');
      }
      let result: { answer?: string; error?: string };
      try {
        result = JSON.parse(responseText) as { answer?: string; error?: string };
      } catch {
        throw new Error(`The assistant API returned an unexpected response (HTTP ${response.status}). Check that the API server is running.`);
      }
      if (!response.ok) throw new Error(result.error || 'The assistant could not answer right now.');
      if (!result.answer) throw new Error('The assistant returned no answer. Please try again.');
      setAnswer(result.answer);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : '';
      setError(message === 'Failed to fetch' || message === 'NetworkError when attempting to fetch resource.'
        ? 'The assistant API is unreachable. Start the app with npm run dev, or deploy it with npm start.'
        : message || 'The assistant could not answer right now.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section aria-labelledby="statistics-assistant-title" className="rounded-xl border border-teal-200 bg-white p-5 shadow-xs dark:border-teal-900 dark:bg-slate-900 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-teal-50 p-2 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="statistics-assistant-title" className="text-base font-semibold text-slate-900 dark:text-white">Ask about the statistics</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Answers use calculated summary counts, not individual handover notes.</p>
          </div>
        </div>
        <button type="button" aria-pressed={useSyntheticData} onClick={() => { setUseSyntheticData((enabled) => !enabled); setAnswer(''); setError(''); }} className={`self-start rounded-lg border px-3 py-2 text-xs font-medium ${useSyntheticData ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : 'border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
          {useSyntheticData ? 'Using 5,000 sample shifts · switch to app data' : 'Try 5,000 synthetic shifts'}
        </button>
      </div>
      <p className={`mt-3 text-xs ${useSyntheticData ? 'text-amber-800 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'}`}>
        {useSyntheticData
          ? 'Synthetic test sample: 5,000 fictional shifts over the past year. Not saved to the database.'
          : `${statistics.handoverCount.toLocaleString()} handovers in the loaded app data${statistics.dateRange.from ? ` · ${statistics.dateRange.from} to ${statistics.dateRange.to}` : ''}.`}
      </p>

      <form onSubmit={(event) => { event.preventDefault(); void ask(); }} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          aria-label="Ask a question about statistics"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          maxLength={500}
          placeholder="For example, how many handovers are waiting for approval?"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        />
        <button type="submit" disabled={isLoading || !question.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
          {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Ask
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {suggestedQuestions.map((suggestion) => (
          <button key={suggestion} type="button" disabled={isLoading} onClick={() => void ask(suggestion)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:border-teal-300 hover:text-teal-800 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:text-teal-300">
            {suggestion}
          </button>
        ))}
      </div>

      {isLoading && <p role="status" className="mt-4 text-sm text-slate-500">Checking the available statistics…</p>}
      {error && <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{error}</p>}
      {answer && <div aria-live="polite" className="mt-4 rounded-lg bg-teal-50 px-4 py-3 text-sm leading-6 text-slate-800 dark:bg-teal-950/40 dark:text-slate-100"><p className="font-medium">Answer</p><p className="mt-1 whitespace-pre-wrap">{answer}</p></div>}
    </section>
  );
};
