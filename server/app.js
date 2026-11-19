import express, { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { authenticate, requireAuth } from './auth.js';
import { HttpError } from './errors.js';
import { authRoutes } from './routes/auth.js';
import { recordRoutes } from './routes/records.js';
import { shiftRoutes } from './routes/shifts.js';
import { userRoutes } from './routes/users.js';

const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Refuses state-changing requests that a browser sent from a different website. */
const sameOriginOnly = (config) => (req, _res, next) => {
  const origin = req.get('origin');
  if (STATE_CHANGING.has(req.method) && origin) {
    let allowed = config.allowedOrigins.includes(origin);
    try {
      const url = new URL(origin);
      allowed ||= url.host === req.get('host');
      // In development the Vite server forwards requests from its own port, so any local address is accepted.
      // Production never does this: only the site's own address and ALLOWED_ORIGINS are.
      allowed ||= !config.production && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    } catch {
      allowed = false;
    }
    if (!allowed) return next(new HttpError(403, 'This request came from an origin that is not allowed.'));
  }
  next();
};

const securityHeaders = (config) => (_req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
  });
  if (config.production) res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
};

// The built client loads only its own scripts. Styles allow inline attributes (used for chart sizes) and Google Fonts.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function createApp(store, config, { distDir } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(securityHeaders(config));
  app.use(express.json({ limit: '100kb' }));

  // Reports whether the server can reach the database. It returns no data.
  app.get('/healthz', async (_req, res) => {
    try {
      await store.db.command({ ping: 1 });
      res.json({ status: 'ok', database: 'connected', uptimeSeconds: Math.round(process.uptime()) });
    } catch {
      res.status(503).json({ status: 'unavailable', database: 'unreachable' });
    }
  });

  const api = Router();
  api.use(sameOriginOnly(config));
  api.use(authenticate(store, config));
  // Every tab says which account it believes it is signed in as. If another account has since signed in on the same
  // browser, the cookie belongs to that account, and this tab must not act as it under the old name.
  const IDENTITY_EXEMPT = new Set(['/auth/login', '/auth/register', '/auth/config', '/auth/me']);
  api.use((req, _res, next) => {
    const expected = req.get('x-expected-user');
    if (expected === undefined || IDENTITY_EXEMPT.has(req.path)) return next();
    if (expected !== (req.user?.id ?? '')) {
      return next(new HttpError(401, 'You were signed out because another account signed in on this browser. Please sign in again.'));
    }
    next();
  });
  api.use('/auth', authRoutes(store, config));
  api.use('/users', userRoutes(store));
  api.use('/shifts', requireAuth, shiftRoutes(store, config));
  api.use('/', recordRoutes(store, config));
  api.use((_req, _res, next) => next(new HttpError(404, 'Not found.')));
  app.use('/api', api);

  if (distDir && fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use((_req, res, next) => {
      res.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
      next();
    });
    app.use(express.static(distDir, {
      index: false,
      maxAge: '1h',
      // Built files have hashed names and never change; the page itself must always be fetched fresh.
      setHeaders: (res, file) => {
        if (file.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable');
      },
    }));
    app.get('*', (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  // Express recognises an error handler by its four parameters.
  app.use((error, _req, res, _next) => {
    if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
    if (error?.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request could not be read.' });
    if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'The request is too large.' });
    console.error('Unhandled server error:', error?.message || error);
    res.status(500).json({ error: 'Something went wrong on the server.' });
  });

  return app;
}
