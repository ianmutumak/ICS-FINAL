import { Router } from 'express';
import { requireAdmin, requireAuth } from '../auth.js';
import { HttpError, handle, optionalString, requireOneOf, requireString } from '../errors.js';
import {
  EQUIPMENT_STATUSES, SHIFT_TYPES, checkIn, clockTime, embedStaff, finalizeShift, isClosed, minutesBetween, newId, newShift,
  sealHandover, unacknowledgedWarnings,
} from '../rules.js';
import { isDuplicate } from './auth.js';

/** What the browser receives: the record without the server's own bookkeeping. */
export const toApi = (doc) => {
  if (!doc) return doc;
  const { _id, rev, open, ...rest } = doc;
  return { id: _id, ...rest };
};

const LOCKED = 'This handover is locked because the outgoing staff member has signed.';

export function shiftRoutes(store, config) {
  const router = Router();
  router.use(requireAuth);
  const now = () => new Date();

  /**
   * Loads a shift, applies a change that has already been checked against the rules, and saves it only if nobody
   * else changed it in between. If someone did, the change is checked again against the newer record.
   */
  async function mutate(shiftId, change) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const doc = await store.shifts.findOne({ _id: shiftId });
      if (!doc) throw new HttpError(404, 'This handover no longer exists.');
      const next = await change(structuredClone(doc));
      next.rev = (doc.rev ?? 0) + 1;
      const saved = await store.shifts.replaceOne({ _id: shiftId, rev: doc.rev ?? 0 }, next);
      if (saved.matchedCount === 1) return next;
    }
    throw new HttpError(409, 'The handover was changed by someone else. Please try again.');
  }

  const requireOpen = (shift) => {
    if (isClosed(shift)) throw new HttpError(409, 'This shift is already closed.');
  };
  const requireUnlocked = (shift) => {
    requireOpen(shift);
    if (shift.signoff.outgoingConfirmed) throw new HttpError(409, LOCKED);
  };
  const requireStaff = (req) => {
    if (req.user.isAdmin) throw new HttpError(403, 'Administrators approve handovers; they do not sign them.');
  };

  router.get('/active', handle(async (_req, res) => {
    const shift = await store.shifts.find({ open: true }).sort({ createdAt: -1 }).limit(1).next();
    res.json(toApi(shift));
  }));

  router.get('/archive', requireAdmin, handle(async (_req, res) => {
    const shifts = await store.shifts.find({ open: { $ne: true } }).sort({ completedAt: -1, createdAt: -1 }).limit(500).toArray();
    res.json(shifts.map(toApi));
  }));

  router.post('/', handle(async (req, res) => {
    const shiftType = requireOneOf(req.body?.shiftType, SHIFT_TYPES, 'Shift');
    const workArea = requireString(req.body?.workArea, 'Work area', { max: 80 });
    const department = await store.departments.findOne({ name: workArea });
    const shift = newShift({
      shiftType, workArea, departmentId: department?._id, lead: embedStaff(req.user), now: now(), timeZone: config.timeZone,
      startedBy: req.user, // pressing Start shift is the check-in, so the start time and any lateness are recorded now
    });
    shift.open = true;
    try {
      await store.shifts.insertOne(shift);
    } catch (error) {
      if (isDuplicate(error)) throw new HttpError(409, 'A shift is already open. Finish or cancel it first.');
      throw error;
    }
    res.status(201).json(toApi(shift));
  }));

  /** Checks in on a shift that opened by itself after the last approval. Starting twice changes nothing. */
  router.post('/:id/start', handle(async (req, res) => {
    requireStaff(req);
    const saved = await mutate(req.params.id, (shift) => {
      requireOpen(shift);
      return checkIn(shift, req.user, now());
    });
    res.json(toApi(saved));
  }));

  router.post('/:id/cases', handle(async (req, res) => {
    const body = req.body ?? {};
    const update = {
      id: newId('case'),
      subjectRef: requireString(body.subjectRef, 'What the update is about', { max: 120 }),
      category: 'General update',
      acuity: 'stable',
      situation: requireString(body.situation, 'Situation', { max: 2000 }),
      background: requireString(body.background, 'Background', { max: 2000 }),
      assessment: requireString(body.assessment, 'Assessment', { max: 2000 }),
      recommendation: requireString(body.recommendation, 'Recommendation', { max: 2000 }),
      lastUpdated: clockTime(now(), config.timeZone),
      updatedBy: req.user.name,
      authorId: req.user.id,
    };
    const warning = optionalString(body.isolationOrHazardAlert, 'Safety warning', 300);
    if (warning) update.isolationOrHazardAlert = warning;

    const saved = await mutate(req.params.id, (shift) => {
      requireUnlocked(shift);
      shift.cases.unshift(update);
      checkIn(shift, req.user, now()); // the first update counts as starting the shift
      return shift;
    });
    res.status(201).json(toApi(saved));
  }));

  router.delete('/:id/cases/:caseId', handle(async (req, res) => {
    const saved = await mutate(req.params.id, (shift) => {
      requireUnlocked(shift);
      const target = shift.cases.find((update) => update.id === req.params.caseId);
      if (!target) throw new HttpError(404, 'This update no longer exists.');
      if (!req.user.isAdmin && target.authorId !== req.user.id) {
        throw new HttpError(403, 'Only the person who wrote an update can remove it.');
      }
      shift.cases = shift.cases.filter((update) => update.id !== req.params.caseId);
      return shift;
    });
    res.json(toApi(saved));
  }));

  router.post('/:id/equipment', handle(async (req, res) => {
    const body = req.body ?? {};
    const item = {
      id: newId('eq'),
      name: requireString(body.name, 'Equipment name', { max: 80 }),
      assetTag: optionalString(body.assetTag, 'Asset tag', 40),
      location: '',
      status: body.status === undefined ? 'functional' : requireOneOf(body.status, EQUIPMENT_STATUSES, 'Condition'),
      // Custody is ticked during the joint walk-through, so it starts unchecked.
      custodyChecked: false,
    };
    const saved = await mutate(req.params.id, (shift) => {
      requireUnlocked(shift);
      item.location = shift.wardOrDepartment;
      shift.equipment.push(item);
      checkIn(shift, req.user, now());
      return shift;
    });
    res.status(201).json(toApi(saved));
  }));

  router.patch('/:id/equipment/:itemId', handle(async (req, res) => {
    if (typeof req.body?.custodyChecked !== 'boolean') throw new HttpError(400, 'custodyChecked must be true or false.');
    const saved = await mutate(req.params.id, (shift) => {
      requireUnlocked(shift);
      const item = shift.equipment.find((entry) => entry.id === req.params.itemId);
      if (!item) throw new HttpError(404, 'This equipment no longer exists.');
      item.custodyChecked = req.body.custodyChecked;
      return shift;
    });
    res.json(toApi(saved));
  }));

  router.post('/:id/sign/outgoing', handle(async (req, res) => {
    requireStaff(req);
    const saved = await mutate(req.params.id, (shift) => {
      requireOpen(shift);
      if (shift.signoff.outgoingConfirmed) throw new HttpError(409, 'The outgoing staff member has already signed.');
      if (shift.cases.length === 0) throw new HttpError(409, 'Record at least one update before signing.');
      const signer = embedStaff(req.user);
      shift.leadOutgoing = signer;
      Object.assign(shift.signoff, {
        outgoingStaffId: signer.id,
        outgoingStaffName: signer.name,
        outgoingRole: signer.role,
        outgoingConfirmed: true,
        outgoingSignedAt: now().toISOString(),
        outgoingSignatureText: signer.name,
      });
      return shift;
    });
    res.json(toApi(saved));
  }));

  /** The incoming staff member is anyone other than the person who signed out. */
  const requireIncomingStage = (shift, req) => {
    requireOpen(shift);
    const { signoff } = shift;
    if (!signoff.outgoingConfirmed) throw new HttpError(409, 'The outgoing staff member signs first.');
    if (signoff.incomingConfirmed) throw new HttpError(409, 'The incoming staff member has already signed.');
    if (signoff.outgoingStaffId === req.user.id) {
      throw new HttpError(403, 'You signed as the outgoing staff member. The staff member taking over must sign with their own account.');
    }
  };

  router.post('/:id/cases/:caseId/acknowledge', handle(async (req, res) => {
    requireStaff(req);
    const saved = await mutate(req.params.id, (shift) => {
      requireIncomingStage(shift, req);
      const update = shift.cases.find((entry) => entry.id === req.params.caseId);
      if (!update) throw new HttpError(404, 'This update no longer exists.');
      if (!update.isolationOrHazardAlert) throw new HttpError(400, 'This update has no safety warning.');
      if (!update.acknowledgedAt) {
        Object.assign(update, { acknowledgedBy: req.user.name, acknowledgedById: req.user.id, acknowledgedAt: now().toISOString() });
      }
      return shift;
    });
    res.json(toApi(saved));
  }));

  router.post('/:id/sign/incoming', handle(async (req, res) => {
    requireStaff(req);
    const saved = await mutate(req.params.id, (shift) => {
      requireIncomingStage(shift, req);
      const waiting = unacknowledgedWarnings(shift).length;
      if (waiting > 0) {
        throw new HttpError(409, `Acknowledge ${waiting === 1 ? 'the safety warning' : `all ${waiting} safety warnings`} before signing.`);
      }
      const signer = embedStaff(req.user);
      const at = now().toISOString();
      shift.status = 'pending_signoff';
      shift.leadIncoming = signer;
      shift.transitionDurationMinutes = minutesBetween(shift.signoff.outgoingSignedAt, at);
      Object.assign(shift.signoff, {
        incomingStaffId: signer.id,
        incomingStaffName: signer.name,
        incomingRole: signer.role,
        incomingConfirmed: true,
        incomingSignedAt: at,
        incomingSignatureText: signer.name,
      });
      shift.signoff.verificationHash = sealHandover(shift);
      return shift;
    });
    res.json(toApi(saved));
  }));

  /** Closes a fully signed handover and opens the next one. Used for both approval and an override. */
  async function approve(req, res, { override }) {
    let next;
    const closed = await mutate(req.params.id, (shift) => {
      if (shift.status !== 'pending_signoff' || !shift.signoff.outgoingConfirmed || !shift.signoff.incomingConfirmed) {
        throw new HttpError(409, 'Both staff members must sign before an administrator can approve.');
      }
      const result = finalizeShift(shift, { approver: req.user, override, now: now(), timeZone: config.timeZone });
      next = result.next;
      return { ...result.closed, open: false };
    });
    next.open = true;
    await store.shifts.insertOne(next);

    if (override) {
      await store.overrides.insertOne({
        _id: newId('ovr'), shiftId: closed._id, shiftCode: closed.handoverCode, departmentName: closed.wardOrDepartment,
        adminName: req.user.name, adminId: req.user.id, actionType: 'emergency_signoff', reason: override, timestamp: now().toISOString(),
      });
    }
    res.json({ closed: toApi(closed), next: toApi(next) });
  }

  router.post('/:id/approve', requireAdmin, handle((req, res) => approve(req, res, { override: '' })));

  router.post('/:id/override', requireAdmin, handle((req, res) => {
    const reason = requireString(req.body?.reason, 'Reason', { max: 500 });
    return approve(req, res, { override: reason });
  }));

  /** Ends a shift that cannot be signed, for example one that was started by mistake. */
  router.post('/:id/cancel', requireAdmin, handle(async (req, res) => {
    const reason = requireString(req.body?.reason, 'Reason', { max: 500 });
    const closed = await mutate(req.params.id, (shift) => {
      requireOpen(shift);
      Object.assign(shift, {
        status: 'archived', open: false, completedAt: now().toISOString(), approvedBy: req.user.name, approvedById: req.user.id,
        isOverridden: true, overrideReason: `Cancelled: ${reason}`,
      });
      return shift;
    });
    await store.overrides.insertOne({
      _id: newId('ovr'), shiftId: closed._id, shiftCode: closed.handoverCode, departmentName: closed.wardOrDepartment,
      adminName: req.user.name, adminId: req.user.id, actionType: 'cancel_shift', reason, timestamp: now().toISOString(),
    });
    res.json(toApi(closed));
  }));

  return router;
}
