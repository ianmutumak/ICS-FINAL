import { Router } from 'express';
import { requireAdmin, requireAuth } from '../auth.js';
import { HttpError, handle, optionalString, requireOneOf, requireString } from '../errors.js';
import { clockTime, newId } from '../rules.js';
import { toApi } from './shifts.js';

const SEVERITIES = ['critical', 'major', 'moderate', 'minor'];
const DECISIONS = ['plan', 'dismiss'];
const METRICS = ['handovers', 'carriedOver'];
const METHODS = ['paper', 'app'];

const number = (value, label, { min, max }) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new HttpError(400, `${label} must be a number from ${min} to ${max}.`);
  }
  return value;
};

/** Zones, work categories, incidents, the override ledger, forecast decisions and the timing study. */
export function recordRoutes(store, config) {
  const router = Router();

  // ---- Facility zones: everyone reads them, administrators change them
  router.get('/departments', requireAuth, handle(async (_req, res) => {
    res.json((await store.departments.find({}).sort({ name: 1 }).toArray()).map(toApi));
  }));

  router.post('/departments', requireAdmin, handle(async (req, res) => {
    const body = req.body ?? {};
    const capacity = body.capacity === undefined ? 50 : number(Number(body.capacity), 'Capacity', { min: 1, max: 1000000 });
    const doc = {
      _id: newId('dept'),
      code: requireString(body.code, 'Zone code', { max: 20 }).toUpperCase(),
      name: requireString(body.name, 'Zone name', { max: 80 }),
      building: optionalString(body.building, 'Building', 80),
      floor: optionalString(body.floor, 'Floor', 80),
      capacity,
      activeUnits: Math.round(capacity * 0.7),
      headOfDepartment: optionalString(body.headOfDepartment, 'Zone supervisor', 80),
      currentShift: 'morning',
      shiftStatus: 'scheduled',
      roster: { morning: [], evening: [], night: [] },
    };
    await store.departments.insertOne(doc);
    res.status(201).json(toApi(doc));
  }));

  router.delete('/departments/:id', requireAdmin, handle(async (req, res) => {
    await store.departments.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  }));

  // ---- Work categories
  router.get('/categories', requireAdmin, handle(async (_req, res) => {
    res.json((await store.categories.find({}).sort({ _id: 1 }).toArray()).map((doc) => doc._id));
  }));

  router.post('/categories', requireAdmin, handle(async (req, res) => {
    const name = requireString(req.body?.name, 'Category', { max: 80 });
    await store.categories.updateOne({ _id: name }, { $setOnInsert: { _id: name } }, { upsert: true });
    res.status(201).json({ name });
  }));

  router.delete('/categories/:name', requireAdmin, handle(async (req, res) => {
    await store.categories.deleteOne({ _id: req.params.name });
    res.json({ ok: true });
  }));

  // ---- Incidents
  router.get('/incidents', requireAdmin, handle(async (_req, res) => {
    res.json((await store.incidents.find({}).sort({ createdAt: -1 }).toArray()).map(toApi));
  }));

  router.post('/incidents', requireAdmin, handle(async (req, res) => {
    const body = req.body ?? {};
    const department = typeof body.departmentId === 'string' ? await store.departments.findOne({ _id: body.departmentId }) : null;
    const doc = {
      _id: newId('inc'),
      departmentId: department?._id ?? '',
      departmentName: department?.name ?? 'Operational Zone',
      title: requireString(body.title, 'Incident description', { max: 200 }),
      severity: requireOneOf(body.severity, SEVERITIES, 'Severity'),
      status: 'open',
      reportedBy: req.user.name,
      reportedAt: clockTime(new Date(), config.timeZone),
      mitigationNotes: optionalString(body.mitigationNotes, 'Notes', 1000),
      createdAt: new Date().toISOString(),
    };
    await store.incidents.insertOne(doc);
    res.status(201).json(toApi(doc));
  }));

  router.post('/incidents/:id/resolve', requireAdmin, handle(async (req, res) => {
    const notes = requireString(req.body?.notes, 'Corrective notes', { max: 1000 });
    const rootCause = requireString(req.body?.rootCause, 'Root cause', { max: 300 });
    const result = await store.incidents.findOneAndUpdate(
      { _id: req.params.id, status: { $ne: 'resolved' } },
      { $set: { status: 'resolved', resolvedBy: req.user.name, resolvedAt: clockTime(new Date(), config.timeZone), mitigationNotes: notes, rootCause } },
      { returnDocument: 'after' }
    );
    if (!result) throw new HttpError(404, 'This incident is already resolved or no longer exists.');
    res.json(toApi(result));
  }));

  // ---- Override ledger (written by the shift routes; read-only here)
  router.get('/overrides', requireAdmin, handle(async (_req, res) => {
    res.json((await store.overrides.find({}).sort({ timestamp: -1 }).limit(500).toArray()).map(toApi));
  }));

  // ---- Administrator decisions about forecast warnings
  router.get('/forecast-decisions', requireAdmin, handle(async (_req, res) => {
    res.json((await store.forecastDecisions.find({}).sort({ at: -1 }).limit(500).toArray()).map(toApi));
  }));

  router.post('/forecast-decisions', requireAdmin, handle(async (req, res) => {
    const body = req.body ?? {};
    const doc = {
      _id: newId('fc'),
      metric: requireOneOf(body.metric, METRICS, 'Metric'),
      date: requireString(body.date, 'Date', { max: 10 }),
      shift: requireString(body.shift, 'Shift', { max: 20 }),
      expected: number(body.expected, 'Expected value', { min: 0, max: 100000 }),
      decision: requireOneOf(body.decision, DECISIONS, 'Decision'),
      note: optionalString(body.note, 'Note', 140),
      by: req.user.name,
      byId: req.user.id,
      at: new Date().toISOString(),
    };
    await store.forecastDecisions.insertOne(doc);
    res.status(201).json(toApi(doc));
  }));

  // ---- Timing study: how long a handover takes on paper and in the app
  router.get('/timing-runs', requireAdmin, handle(async (_req, res) => {
    res.json((await store.timingRuns.find({}).sort({ at: -1 }).limit(1000).toArray()).map(toApi));
  }));

  router.post('/timing-runs', requireAdmin, handle(async (req, res) => {
    const body = req.body ?? {};
    const doc = {
      _id: newId('run'),
      method: requireOneOf(body.method, METHODS, 'Method'),
      task: requireString(body.task, 'Task', { max: 60 }),
      // A label such as P1, never a name.
      participant: requireString(body.participant, 'Participant', { max: 20 }),
      seconds: number(body.seconds, 'Time in seconds', { min: 1, max: 7200 }),
      note: optionalString(body.note, 'Note', 200),
      recordedBy: req.user.name,
      at: new Date().toISOString(),
    };
    await store.timingRuns.insertOne(doc);
    res.status(201).json(toApi(doc));
  }));

  router.delete('/timing-runs/:id', requireAdmin, handle(async (req, res) => {
    await store.timingRuns.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  }));

  return router;
}
