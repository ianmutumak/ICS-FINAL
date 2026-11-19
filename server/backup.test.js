import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { BACKUP_FORMAT, exportDatabase, importDatabase } from './backup.js';
import { sealHandover } from './rules.js';

let mongod;
let client;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  client = await MongoClient.connect(mongod.getUri());
});

afterAll(async () => {
  await client?.close();
  await mongod?.stop();
});

const signedShift = () => {
  const shift = {
    _id: 'hnd-1', rev: 3, open: false, handoverCode: 'ZAMU-2026-EVE-100', shiftDate: '2026-11-19', shiftType: 'evening',
    wardOrDepartment: 'Import warehouse', status: 'completed',
    cases: [{ id: 'c1', subjectRef: 'Dock door 4', situation: 'S', background: 'B', assessment: 'A', recommendation: 'R', isolationOrHazardAlert: 'Wet floor', acknowledgedById: 'u2', acknowledgedAt: '2026-11-19T20:00:00.000Z' }],
    equipment: [{ id: 'e1', name: 'Reach truck', assetTag: 'RT-1', status: 'functional', custodyChecked: true }],
    signoff: { outgoingStaffId: 'u1', outgoingSignedAt: '2026-11-19T19:59:00.000Z', incomingStaffId: 'u2', incomingSignedAt: '2026-11-19T20:01:00.000Z' },
  };
  shift.signoff.verificationHash = sealHandover(shift);
  return shift;
};

describe('backup and restore', () => {
  it('restores every record exactly, so a signed handover still matches its seal', async () => {
    const source = client.db('backup_source');
    await source.collection('shifts').insertOne(signedShift());
    await source.collection('users').insertMany([
      { _id: 'u1', staffNumber: 'A-0001', staffKey: 'a-0001', pinHash: { salt: 'aa', hash: 'bb', n: 16384 } },
      { _id: 'u2', staffNumber: 'A-0002', staffKey: 'a-0002', pinHash: { salt: 'cc', hash: 'dd', n: 16384 } },
    ]);
    await source.collection('timingRuns').insertOne({ _id: 'run-1', method: 'app', seconds: 330, at: '2026-11-19T10:00:00.000Z' });

    const backup = await exportDatabase(source);
    expect(backup.format).toBe(BACKUP_FORMAT);
    // The file survives being written out and read back, as it would on disk.
    const fromDisk = JSON.parse(JSON.stringify(backup));

    const target = client.db('backup_target');
    const restored = await importDatabase(target, fromDisk);
    expect(restored).toEqual({ shifts: 1, users: 2, timingRuns: 1 });

    const original = await source.collection('shifts').findOne({ _id: 'hnd-1' });
    const copy = await target.collection('shifts').findOne({ _id: 'hnd-1' });
    expect(copy).toEqual(original);
    expect(sealHandover(copy)).toBe(copy.signoff.verificationHash);
    expect(await target.collection('users').countDocuments({})).toBe(2);
  });

  it('refuses to restore over existing records unless told to replace them', async () => {
    const source = client.db('backup_source');
    const backup = JSON.parse(JSON.stringify(await exportDatabase(source)));
    const target = client.db('backup_target');
    await expect(importDatabase(target, backup)).rejects.toThrow(/already has records/);

    await target.collection('timingRuns').insertOne({ _id: 'extra', method: 'paper', seconds: 1 });
    await importDatabase(target, backup, { replace: true });
    expect(await target.collection('timingRuns').countDocuments({})).toBe(1);
    expect(await target.collection('timingRuns').findOne({ _id: 'extra' })).toBeNull();
  });

  it('rejects a file that is not a backup', async () => {
    await expect(importDatabase(client.db('backup_other'), { hello: 'world' })).rejects.toThrow(/not a Zamu-Check backup/);
    await expect(importDatabase(client.db('backup_other'), null)).rejects.toThrow(/not a Zamu-Check backup/);
  });
});
