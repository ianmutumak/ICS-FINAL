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
const requestWindowMs = 5 * 60 * 1000;
const requestLimit = 15;
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
    const localDevOrigin = ['http://localhost:3000', 'http://127.0.0.1:3000'];
    return originUrl.host === requestHost || originUrl.origin === configuredOrigin || localDevOrigin.includes(originUrl.origin);
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
  return {
    datasetKind: input?.datasetKind === 'synthetic' ? 'synthetic' : 'application',
    handoverCount: numberOrNull(input?.handoverCount),
    dateRange: { from: dateOrNull(input?.dateRange?.from), to: dateOrNull(input?.dateRange?.to) },
    handoversByStatus: safeCountMap(input?.handoversByStatus),
    handoversByShift: safeCountMap(input?.handoversByShift),
    handoversByMonth: safeCountMap(input?.handoversByMonth, /^\d{4}-\d{2}$/),
    averageTransitionMinutes: numberOrNull(input?.averageTransitionMinutes),
    sbar: {
      total: numberOrNull(sbar.total),
      complete: numberOrNull(sbar.complete),
      incomplete: numberOrNull(sbar.incomplete),
      completePercent: numberOrNull(sbar.completePercent),
    },
    tasksByStatus: safeCountMap(input?.tasksByStatus),
    attendance: {
      total: numberOrNull(attendance.total),
      punctual: numberOrNull(attendance.punctual),
      punctualPercent: numberOrNull(attendance.punctualPercent),
    },
    signoffs: {
      total: numberOrNull(signoffs.total),
      averageCompliancePercent: numberOrNull(signoffs.averageCompliancePercent),
    },
  };
}

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

  const statistics = sanitizeStatistics(req.body?.statistics);
  const systemInstruction = [
    'You answer questions about shift handover statistics for an administrator.',
    'Use only the supplied computed statistics. Do not invent, estimate, or recalculate values that are absent.',
    'If the data cannot answer the question, say so plainly and name the closest available metric.',
    'Mention the date range or record count when it helps interpret the answer.',
    'The project may use synthetic data. Never describe synthetic results as real-world findings.',
    'When datasetKind is synthetic, explicitly describe the figures as generated sample data.',
    'Do not request or reveal names, credentials, case text, or other personal data.',
    'Answer in plain language in no more than four short sentences.',
  ].join(' ');
  const prompt = `Administrator question:\n${question}\n\nAvailable computed statistics (JSON):\n${JSON.stringify(statistics)}`;

  try {
    if (aiProvider === 'ollama') {
      let response;
      try {
        response = await fetch(`${ollamaBaseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: ollamaModel,
            stream: false,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: prompt },
            ],
            options: { temperature: 0.2 },
          }),
          signal: AbortSignal.timeout(90_000),
        });
      } catch (error) {
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
          return res.status(504).json({ error: 'Ollama took too long to respond. Try again or use a smaller local model.' });
        }
        return res.status(503).json({ error: `Cannot reach Ollama at ${ollamaBaseUrl}. Start Ollama and try again.` });
      }

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = typeof result.error === 'string' ? result.error : '';
        const modelMissing = response.status === 404 || /model.*(not found|does not exist)/i.test(detail);
        return res.status(modelMissing ? 503 : 502).json({
          error: modelMissing
            ? `Ollama model "${ollamaModel}" is not available. Pull it with "ollama pull ${ollamaModel}" or set OLLAMA_MODEL to an installed model.`
            : `Ollama returned an error${detail ? `: ${detail}` : '.'}`,
        });
      }

      const answer = result?.message?.content?.trim();
      if (!answer) return res.status(502).json({ error: 'Ollama returned an empty answer. Please try again.' });
      return res.json({ answer, model: ollamaModel, provider: 'ollama' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        maxOutputTokens: 220,
      },
    });

    const answer = response.text?.trim();
    if (!answer) return res.status(502).json({ error: 'The assistant returned an empty answer. Please try again.' });
    return res.json({ answer, model: modelName, provider: 'gemini' });
  } catch (error) {
    console.error('Statistics assistant request failed:', error?.message || 'Unknown error');
    return res.status(502).json({ error: 'The assistant could not answer right now. Please try again.' });
  }
});

app.get('/api/health', (_req, res) => {
  const configured = aiProvider === 'ollama'
    ? Boolean(ollamaBaseUrl && ollamaModel)
    : aiProvider === 'gemini' && Boolean(process.env.GEMINI_API_KEY);
  res.json({ assistantConfigured: configured, provider: aiProvider, model: aiProvider === 'ollama' ? ollamaModel : modelName });
});

app.use(express.static(path.join(here, 'dist')));
app.get('*', (_req, res) => {
  res.sendFile(path.join(here, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Zamu-Check server listening on port ${port}`);
});
