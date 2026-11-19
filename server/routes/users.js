import { Router } from 'express';
import { hashPin, isValidPin, publicUser, requireAdmin } from '../auth.js';
import { HttpError, handle, optionalString, requireOneOf, requireString } from '../errors.js';
import { buildUser, staffKey } from '../store.js';
import { isDuplicate } from './auth.js';

const STATUSES = ['active', 'on_leave', 'suspended'];

/** Administrator-only user management: create, read, update and delete. */
export function userRoutes(store) {
  const router = Router();
  router.use(requireAdmin);

  /** True if changing this user would leave no administrator who can sign in. */
  const isLastActiveAdmin = async (userId) => {
    const others = await store.users.countDocuments({ isAdmin: true, status: { $ne: 'suspended' }, _id: { $ne: userId } }, { limit: 1 });
    return others === 0;
  };

  router.get('/', handle(async (_req, res) => {
    const users = await store.users.find({}).sort({ name: 1 }).toArray();
    res.json(users.map(publicUser));
  }));

  router.post('/', handle(async (req, res) => {
    const body = req.body ?? {};
    const name = requireString(body.name, 'Name', { max: 80 });
    const staffNumber = requireString(body.staffNumber, 'Badge ID', { min: 4, max: 40 });
    if (!isValidPin(body.pin)) throw new HttpError(400, 'The PIN must be 4 to 6 digits.');
    const user = await buildUser({
      name, staffNumber, pin: body.pin,
      role: optionalString(body.role, 'Role', 80),
      department: optionalString(body.department, 'Department', 80),
      qualification: optionalString(body.qualification, 'Certifications', 120),
      isAdmin: body.isAdmin === true,
      status: body.status === undefined ? 'active' : requireOneOf(body.status, STATUSES, 'Status'),
    });
    try {
      await store.users.insertOne(user);
    } catch (error) {
      if (isDuplicate(error)) throw new HttpError(409, 'Another user already has this badge ID.');
      throw error;
    }
    res.status(201).json(publicUser(user));
  }));

  router.patch('/:id', handle(async (req, res) => {
    const target = await store.users.findOne({ _id: req.params.id });
    if (!target) throw new HttpError(404, 'This user no longer exists.');
    const body = req.body ?? {};
    const set = {};

    if (body.name !== undefined) set.name = requireString(body.name, 'Name', { max: 80 });
    if (body.staffNumber !== undefined) {
      const staffNumber = requireString(body.staffNumber, 'Badge ID', { min: 4, max: 40 });
      set.staffNumber = staffNumber.toUpperCase();
      set.staffKey = staffKey(staffNumber);
    }
    if (body.role !== undefined) set.role = optionalString(body.role, 'Role', 80);
    if (body.department !== undefined) set.department = optionalString(body.department, 'Department', 80);
    if (body.qualification !== undefined) set.qualification = optionalString(body.qualification, 'Certifications', 120);
    if (body.isAdmin !== undefined) {
      if (typeof body.isAdmin !== 'boolean') throw new HttpError(400, 'Administrator must be true or false.');
      set.isAdmin = body.isAdmin;
    }
    if (body.status !== undefined) set.status = requireOneOf(body.status, STATUSES, 'Status');
    if (body.pin) {
      if (!isValidPin(body.pin)) throw new HttpError(400, 'The PIN must be 4 to 6 digits.');
      set.pinHash = await hashPin(body.pin);
    }
    if (set.name) set.avatarSeed = set.name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?';

    const staysActiveAdmin = (set.isAdmin ?? target.isAdmin) && (set.status ?? target.status ?? 'active') !== 'suspended';
    if (target.isAdmin && (target.status ?? 'active') !== 'suspended' && !staysActiveAdmin && (await isLastActiveAdmin(target._id))) {
      throw new HttpError(409, 'This is the only active administrator. Make another user an administrator first.');
    }

    try {
      await store.users.updateOne({ _id: target._id }, { $set: set });
    } catch (error) {
      if (isDuplicate(error)) throw new HttpError(409, 'Another user already has this badge ID.');
      throw error;
    }
    res.json(publicUser(await store.users.findOne({ _id: target._id })));
  }));

  router.delete('/:id', handle(async (req, res) => {
    if (req.params.id === req.user.id) throw new HttpError(409, 'You cannot delete the account you are signed in with.');
    const target = await store.users.findOne({ _id: req.params.id });
    if (!target) throw new HttpError(404, 'This user no longer exists.');
    if (target.isAdmin && (target.status ?? 'active') !== 'suspended' && (await isLastActiveAdmin(target._id))) {
      throw new HttpError(409, 'This is the only active administrator. Make another user an administrator first.');
    }
    await store.users.deleteOne({ _id: target._id });
    res.json({ ok: true });
  }));

  return router;
}
