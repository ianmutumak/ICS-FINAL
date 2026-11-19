import { randomBytes } from 'node:crypto';

/**
 * Reads the server settings from environment variables.
 * Secrets (the database address, the session secret, the first administrator's PIN) are only ever
 * read from the environment, never written in code.
 */
export function loadConfig(env = process.env) {
  const production = env.NODE_ENV === 'production';
  const secret = env.SESSION_SECRET || '';
  if (production && secret.length < 32) {
    throw new Error('SESSION_SECRET must be set to at least 32 characters when NODE_ENV=production.');
  }

  return {
    production,
    port: Number(env.PORT || 3004),
    mongoUri: env.MONGODB_URI || '',
    dbName: env.MONGODB_DB || 'zamucheck',
    // Without a configured secret (development only) a random one is used, so sessions end when the server restarts.
    sessionSecret: secret || randomBytes(32).toString('hex'),
    sessionHours: 12,
    // Accounts are created by an administrator unless this is switched on.
    allowSelfRegistration: env.ALLOW_SELF_REGISTRATION === 'true',
    timeZone: env.APP_TIMEZONE || 'Africa/Nairobi',
    allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
    initialAdmin: {
      staffNumber: env.INITIAL_ADMIN_BADGE || '',
      name: env.INITIAL_ADMIN_NAME || 'Administrator',
      pin: env.INITIAL_ADMIN_PIN || '',
    },
  };
}
