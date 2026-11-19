import type { HandoverRecord, SbarCase, UserStaff } from '../types';

export const staff = (id: string, name: string): UserStaff => ({
  id, staffNumber: id.toUpperCase(), name, role: 'Staff member', department: '', qualification: '', avatarSeed: name[0],
});

export const makeCase = (overrides: Partial<SbarCase> = {}): SbarCase => ({
  id: 'c1', subjectRef: 'Dock door 4', category: 'General update', acuity: 'stable',
  situation: 'S', background: 'B', assessment: 'A', recommendation: 'R',
  lastUpdated: '10:00', updatedBy: 'David', ...overrides,
});

/** A started shift with one complete update, for tests. */
export const makeShift = (overrides: Partial<HandoverRecord> = {}): HandoverRecord => ({
  id: 'hnd-1', handoverCode: 'ZAMU-2026-EVE-100', wardOrDepartment: 'Import warehouse', departmentId: '',
  sector: 'kq_bonded_freight', shiftType: 'evening', shiftDate: '2026-11-17', shiftWindow: '15:00 - 23:30',
  status: 'in_progress', leadOutgoing: staff('usr-1', 'David'), leadIncoming: staff('', 'Not yet assigned'),
  attendanceCount: 0, transitionDurationMinutes: 0, summaryNotes: '', cases: [makeCase()], equipment: [], actions: [],
  signoff: {
    outgoingStaffId: 'usr-1', outgoingStaffName: 'David', outgoingRole: '', outgoingConfirmed: false,
    incomingStaffId: '', incomingStaffName: '', incomingRole: '', incomingConfirmed: false,
  },
  createdAt: '2026-11-17T12:00:00.000Z',
  ...overrides,
});

/** A shift signed by both staff members. */
export const makeSignedShift = (signedAtIso = '2026-11-17T20:00:00.000Z'): HandoverRecord => {
  const shift = makeShift({ status: 'pending_signoff' });
  return {
    ...shift,
    signoff: {
      ...shift.signoff,
      outgoingConfirmed: true, outgoingSignedAt: '2026-11-17T19:59:00.000Z', outgoingSignatureText: 'David',
      incomingStaffId: 'usr-2', incomingStaffName: 'Mary', incomingRole: '', incomingConfirmed: true,
      incomingSignedAt: signedAtIso, incomingSignatureText: 'Mary',
    },
  };
};
