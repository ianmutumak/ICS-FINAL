import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = Number(process.env.PORT || 3004);
const here = path.dirname(fileURLToPath(import.meta.url));
const aiProvider = (process.env.AI_PROVIDER || 'ollama').toLowerCase();
const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const ollamaBaseUrl = (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434').replace(/\/$/, '');
const ollamaModel = process.env.OLLAMA_MODEL || 'qwen2.5:3b';
// How long Ollama keeps the model in memory after a request, so follow-up questions start instantly.
const ollamaKeepAlive = process.env.OLLAMA_KEEP_ALIVE || '30m';
const requestWindowMs = 5 * 60 * 1000;
const requestLimit = 30;
const requestsByAddress = new Map();

app.disable('x-powered-by');
app.use(express.json({ limit: '12kb' }));

function isAllowedOrigin(origin, requestHost) {
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    let configuredOrigin = null;
    try {
      configuredOrigin = process.env.APP_URL ? new URL(process.env.APP_URL).origin : null;
    } catch {
      // Ignore an unset or malformed optional deployment URL.
    }
    // A page served from this computer (the Vite dev server, on whichever port it got) is allowed.
    const isLocalPage = ['localhost', '127.0.0.1', '[::1]'].includes(originUrl.hostname);
    return originUrl.host === requestHost || originUrl.origin === configuredOrigin || isLocalPage;
  } catch {
    return false;
  }
}

function checkRateLimit(address) {
  const now = Date.now();
  const recent = (requestsByAddress.get(address) || []).filter((time) => now - time < requestWindowMs);
  if (recent.length >= requestLimit) return false;
  recent.push(now);
  requestsByAddress.set(address, recent);
  return true;
}

// ---- Statistics: validate what the browser sends, then turn it into plain facts ----

function safeCountMap(value, pattern = /^[a-zA-Z0-9_-]{1,32}$/) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, count]) => pattern.test(key) && Number.isSafeInteger(count) && count >= 0)
      .slice(0, 120)
  );
}

function sanitizeStatistics(input) {
  const numberOrNull = (value) => Number.isSafeInteger(value) && value >= 0 ? value : null;
  const dateOrNull = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
  const sbar = input?.sbar && typeof input.sbar === 'object' ? input.sbar : {};
  const attendance = input?.attendance && typeof input.attendance === 'object' ? input.attendance : {};
  const signoffs = input?.signoffs && typeof input.signoffs === 'object' ? input.signoffs : {};
  const transition = input?.transition && typeof input.transition === 'object' ? input.transition : {};
  return {
    datasetKind: input?.datasetKind === 'synthetic' ? 'synthetic' : 'application',
    handoverCount: numberOrNull(input?.handoverCount),
    dateRange: { from: dateOrNull(input?.dateRange?.from), to: dateOrNull(input?.dateRange?.to) },
    handoversByStatus: safeCountMap(input?.handoversByStatus),
    handoversByShift: safeCountMap(input?.handoversByShift),
    handoversByMonth: safeCountMap(input?.handoversByMonth, /^\d{4}-\d{2}$/),
    transition: {
      measured: numberOrNull(transition.measured),
      averageMinutes: numberOrNull(transition.averageMinutes),
      withinTarget: numberOrNull(transition.withinTarget),
      targetMinutes: numberOrNull(transition.targetMinutes),
      averageByShift: safeCountMap(transition.averageByShift),
    },
    sbar: { total: numberOrNull(sbar.total), complete: numberOrNull(sbar.complete) },
    tasksByStatus: safeCountMap(input?.tasksByStatus),
    attendance: { total: numberOrNull(attendance.total), punctual: numberOrNull(attendance.punctual) },
    signoffs: { total: numberOrNull(signoffs.total) },
  };
}

const LABELS = {
  completed: 'completed',
  pending_signoff: 'awaiting administrator approval',
  in_progress: 'in progress',
  scheduled: 'scheduled',
  archived: 'archived',
  pending: 'pending',
  carried_over: 'carried over to the next shift',
  morning: 'morning',
  evening: 'evening',
  night: 'night',
};
const label = (key) => LABELS[key] || key.replace(/_/g, ' ');
const percent = (part, total) => (total > 0 ? `${Math.round((part / total) * 100)}%` : 'n/a');

function describeCounts(counts) {
  const entries = Object.entries(counts);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  if (total === 0) return null;
  return {
    total,
    text: entries
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => `${label(key)} ${count} (${percent(count, total)})`)
      .join('; '),
  };
}

/**
 * Small local models are unreliable at arithmetic and at reading nested JSON. Every figure the
 * assistant may quote is therefore calculated here and handed over as a plain sentence.
 */
function buildFactSheet(stats) {
  const facts = [];
  facts.push(stats.datasetKind === 'synthetic'
    ? 'Data source: GENERATED SAMPLE DATA for demonstration. It is not real operational data.'
    : 'Data source: handover records stored in the application.');

  const total = stats.handoverCount ?? 0;
  facts.push(total === 0
    ? 'Handovers: none recorded.'
    : `Handovers: ${total} in total${stats.dateRange.from ? `, dated ${stats.dateRange.from} to ${stats.dateRange.to}` : ''}.`);

  // Zero is an answer too: the main stages are always stated, even when nothing is in them.
  const statusCounts = { completed: 0, pending_signoff: 0, in_progress: 0, ...stats.handoversByStatus };
  const byStatus = describeCounts(statusCounts);
  if (byStatus) facts.push(`Handovers by status: ${byStatus.text}.`);
  facts.push(`Handovers awaiting administrator approval: ${statusCounts.pending_signoff}.`);
  const byShift = describeCounts(stats.handoversByShift);
  if (byShift) facts.push(`Handovers by shift: ${byShift.text}.`);

  const months = Object.entries(stats.handoversByMonth).sort((a, b) => a[0].localeCompare(b[0]));
  if (months.length > 0) {
    facts.push(`Handovers per month: ${months.map(([month, count]) => `${month}: ${count}`).join('; ')}.`);
    if (months.length > 1) {
      const ranked = [...months].sort((a, b) => b[1] - a[1]);
      facts.push(`Busiest month: ${ranked[0][0]} with ${ranked[0][1]} handovers. Quietest month: ${ranked.at(-1)[0]} with ${ranked.at(-1)[1]}.`);
    }
  }

  const { transition } = stats;
  if (transition.measured && transition.averageMinutes !== null) {
    const target = transition.targetMinutes ?? 20;
    facts.push(`Handover time (minutes between the outgoing and incoming signatures): average ${transition.averageMinutes} minutes across ${transition.measured} measured handovers. Target is ${target} minutes or less.`);
    if (transition.withinTarget !== null) {
      facts.push(`Handovers within the ${target}-minute target: ${transition.withinTarget} of ${transition.measured} (${percent(transition.withinTarget, transition.measured)}).`);
    }
    const perShift = Object.entries(transition.averageByShift);
    if (perShift.length > 0) {
      facts.push(`Average handover time by shift: ${perShift.map(([shift, minutes]) => `${label(shift)} ${minutes} minutes`).join('; ')}.`);
    }
  } else {
    facts.push('Handover time: not measured yet.');
  }

  if (stats.sbar.total) {
    const complete = stats.sbar.complete ?? 0;
    facts.push(`SBAR updates: ${stats.sbar.total} in total; ${complete} complete (${percent(complete, stats.sbar.total)}); ${stats.sbar.total - complete} incomplete (${percent(stats.sbar.total - complete, stats.sbar.total)}).`);
  } else {
    facts.push('SBAR updates: none recorded.');
  }

  const tasks = describeCounts({ completed: 0, pending: 0, in_progress: 0, carried_over: 0, ...stats.tasksByStatus });
  if (tasks) {
    const carried = stats.tasksByStatus.carried_over ?? 0;
    facts.push(`Tasks: ${tasks.total} in total. By status: ${tasks.text}.`);
    facts.push(`Task carry-over rate: ${percent(carried, tasks.total)} (${carried} of ${tasks.total}).`);
  } else {
    facts.push('Tasks: none recorded.');
  }

  if (stats.attendance.total) {
    const punctual = stats.attendance.punctual ?? 0;
    const late = stats.attendance.total - punctual;
    facts.push(`Attendance: ${stats.attendance.total} check-ins; ${punctual} on time (${percent(punctual, stats.attendance.total)}); ${late} late (${percent(late, stats.attendance.total)}).`);
  } else {
    facts.push('Attendance: not recorded.');
  }

  if (stats.signoffs.total !== null) {
    facts.push(`Handovers signed by both the outgoing and incoming staff: ${stats.signoffs.total}.`);
  }
  facts.push('Not included in these statistics: names of staff, individual people, and the text of handover updates.');
  return facts.join('\n');
}

const buildPrompt = (facts, question) => `FACTS\n${facts}\n\nQUESTION\n${question}`;

const systemInstruction = [
  'You answer an administrator\'s questions about shift handover statistics.',
  'Use only the FACTS given. Copy numbers exactly as written; never calculate, estimate or invent a number.',
  'If the facts do not answer the question, say that this is not recorded and mention the closest fact.',
  'If the data source is generated sample data, say "in the sample data" in your answer.',
  'Reply in plain English, in one to three short sentences, with no lists, headings or markdown.',
].join(' ');

// ---- Ollama ----

// A short answer from a short prompt: a small context and output cap keep it quick.
const ollamaOptions = { temperature: 0.1, num_predict: 160, num_ctx: 2048 };

/** 'cold' until the model has been loaded into memory once. */
let ollamaWarmState = 'cold';

/** Loads the model into memory ahead of the first question, so that question is not the slow one. */
async function warmOllama() {
  if (aiProvider !== 'ollama' || ollamaWarmState === 'loading' || ollamaWarmState === 'ready') return;
  ollamaWarmState = 'loading';
  try {
    const response = await fetch(`${ollamaBaseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Same options as the real request: Ollama reloads the model if the context size differs.
      body: JSON.stringify({ model: ollamaModel, keep_alive: ollamaKeepAlive, options: ollamaOptions }),
      signal: AbortSignal.timeout(120_000),
    });
    await response.arrayBuffer();
    ollamaWarmState = response.ok ? 'ready' : 'cold';
  } catch {
    ollamaWarmState = 'cold';
  }
}

let primedFacts = null;
let priming = null;

/**
 * Has the model read the fact sheet before anyone asks a question. Ollama keeps what it has
 * already read, so a question that follows only costs the few words of the question itself.
 */
function primeOllama(facts) {
  if (facts === primedFacts) return priming ?? Promise.resolve(true);
  primedFacts = facts;
  priming = (async () => {
    try {
      const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: ollamaModel,
          stream: false,
          keep_alive: ollamaKeepAlive,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: buildPrompt(facts, 'Ready?') },
          ],
          options: { ...ollamaOptions, num_predict: 1 },
        }),
        signal: AbortSignal.timeout(120_000),
      });
      await response.arrayBuffer();
      if (response.ok) ollamaWarmState = 'ready';
      else primedFacts = null;
      return response.ok;
    } catch {
      primedFacts = null;
      return false;
    }
  })();
  return priming;
}

async function ollamaStatus() {
  try {
    const response = await fetch(`${ollamaBaseUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return 'offline';
    const { models = [] } = await response.json();
    const wanted = ollamaModel.includes(':') ? ollamaModel : `${ollamaModel}:latest`;
    if (!models.some((model) => model.name === wanted || model.model === wanted)) return 'model_missing';
    return ollamaWarmState === 'ready' ? 'ready' : 'loading';
  } catch {
    return 'offline';
  }
}

/** Streams the answer to the browser as plain text, token by token. */
async function answerWithOllama(req, res, prompt) {
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  let response;
  try {
    response = await fetch(`${ollamaBaseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: ollamaModel,
        stream: true,
        keep_alive: ollamaKeepAlive,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt },
        ],
        options: ollamaOptions,
      }),
      signal: AbortSignal.any([abort.signal, AbortSignal.timeout(90_000)]),
    });
  } catch (error) {
    if (abort.signal.aborted) return;
    if (error?.name === 'TimeoutError') {
      return res.status(504).json({ error: 'Ollama took too long to respond. Try again.' });
    }
    return res.status(503).json({ error: `Cannot reach Ollama at ${ollamaBaseUrl}. Start Ollama and try again.` });
  }

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    const detail = typeof result.error === 'string' ? result.error : '';
    const modelMissing = response.status === 404 || /model.*(not found|does not exist)/i.test(detail);
    return res.status(modelMissing ? 503 : 502).json({
      error: modelMissing
        ? `Ollama model "${ollamaModel}" is not available. Pull it with "ollama pull ${ollamaModel}" or set OLLAMA_MODEL to an installed model.`
        : `Ollama returned an error${detail ? `: ${detail}` : '.'}`,
    });
  }

  ollamaWarmState = 'ready';
  const decoder = new TextDecoder();
  let buffered = '';
  let started = false;
  const forward = (line) => {
    if (!line.trim()) return;
    let piece = '';
    try {
      piece = JSON.parse(line)?.message?.content || '';
    } catch {
      return;
    }
    if (!piece) return;
    if (!started) {
      started = true;
      res.status(200).set({
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        'X-Assistant-Model': ollamaModel,
      });
      res.flushHeaders();
    }
    res.write(piece);
  };

  try {
    for await (const chunk of response.body) {
      buffered += decoder.decode(chunk, { stream: true });
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';
      lines.forEach(forward);
    }
    forward(buffered);
  } catch (error) {
    if (abort.signal.aborted) return;
    if (!started) {
      return res.status(error?.name === 'TimeoutError' ? 504 : 502).json({ error: 'Ollama stopped responding. Try again.' });
    }
  }

  if (!started) return res.status(502).json({ error: 'Ollama returned an empty answer. Please try again.' });
  return res.end();
}

// ---- Routes ----

app.post('/api/admin/statistics', async (req, res) => {
  if (!isAllowedOrigin(req.get('origin'), req.get('host'))) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }
  if (!checkRateLimit(req.ip || 'unknown')) {
    return res.status(429).json({ error: 'Too many questions. Please try again in a few minutes.' });
  }

  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (question.length < 3 || question.length > 500) {
    return res.status(400).json({ error: 'Enter a question between 3 and 500 characters.' });
  }
  if (aiProvider !== 'ollama' && aiProvider !== 'gemini') {
    return res.status(503).json({ error: 'AI_PROVIDER must be set to either "ollama" or "gemini".' });
  }
  if (aiProvider === 'gemini' && !process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'The Gemini assistant is not configured. Set GEMINI_API_KEY on the server.' });
  }

  const prompt = buildPrompt(buildFactSheet(sanitizeStatistics(req.body?.statistics)), question);

  try {
    if (aiProvider === 'ollama') return await answerWithOllama(req, res, prompt);

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: { systemInstruction, temperature: 0.1, maxOutputTokens: 220 },
    });
    const answer = response.text?.trim();
    if (!answer) return res.status(502).json({ error: 'The assistant returned an empty answer. Please try again.' });
    return res.json({ answer, model: modelName, provider: 'gemini' });
  } catch (error) {
    console.error('Statistics assistant request failed:', error?.message || 'Unknown error');
    if (res.headersSent) return res.end();
    return res.status(502).json({ error: 'The assistant could not answer right now. Please try again.' });
  }
});

// Called when the statistics page opens or its figures change, ahead of the first question.
app.post('/api/admin/statistics/prepare', async (req, res) => {
  if (!isAllowedOrigin(req.get('origin'), req.get('host'))) {
    return res.status(403).json({ error: 'Request origin is not allowed.' });
  }
  if (aiProvider !== 'ollama') return res.json({ prepared: true });
  const prepared = await primeOllama(buildFactSheet(sanitizeStatistics(req.body?.statistics)));
  return res.json({ prepared });
});

// status: ready | loading | offline | model_missing | not_configured
app.get('/api/health', async (_req, res) => {
  let status = 'not_configured';
  if (aiProvider === 'ollama') {
    status = await ollamaStatus();
    if (status === 'loading') void warmOllama();
  } else if (aiProvider === 'gemini' && process.env.GEMINI_API_KEY) {
    status = 'ready';
  }
  res.json({
    status,
    assistantConfigured: status === 'ready' || status === 'loading',
    provider: aiProvider,
    model: aiProvider === 'ollama' ? ollamaModel : modelName,
  });
});

app.use(express.static(path.join(here, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(here, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Zamu-Check server listening on port ${port}`);
  void warmOllama();
});
