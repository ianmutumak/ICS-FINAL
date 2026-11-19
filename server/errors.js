/** An error that is safe to show to the person who made the request. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Express 4 does not catch errors thrown in async handlers, so each one is wrapped. */
export const handle = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Requires a plain string, which also stops query objects such as {"$ne": null} reaching the database. */
export function requireString(value, label, { min = 1, max = 200 } = {}) {
  if (typeof value !== 'string') throw new HttpError(400, `${label} is required.`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw new HttpError(400, `${label} is required.`);
  if (trimmed.length > max) throw new HttpError(400, `${label} must be at most ${max} characters.`);
  return trimmed;
}

export function optionalString(value, label, max = 300) {
  if (value === undefined || value === null || value === '') return '';
  return requireString(value, label, { min: 0, max });
}

export function requireOneOf(value, allowed, label) {
  if (typeof value !== 'string' || !allowed.includes(value)) throw new HttpError(400, `${label} is not valid.`);
  return value;
}
