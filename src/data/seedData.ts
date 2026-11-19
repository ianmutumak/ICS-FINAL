import type { HandoverRecord, UserStaff } from '../types';

// Placeholder for a handover role nobody has taken yet.
export const UNASSIGNED_STAFF: UserStaff = {
  id: '',
  staffNumber: '',
  name: 'Not yet assigned',
  role: '',
  department: '',
  qualification: '',
  avatarSeed: '',
};

/** Shown before the first shift is started. It is never saved. */
export const INITIAL_ACTIVE_HANDOVER: HandoverRecord = {
  id: 'draft-current',
  handoverCode: '',
  wardOrDepartment: '',
  departmentId: '',
  sector: 'kq_bonded_freight',
  shiftType: 'morning',
  shiftDate: '',
  shiftWindow: '',
  status: 'in_progress',
  leadOutgoing: UNASSIGNED_STAFF,
  leadIncoming: UNASSIGNED_STAFF,
  attendanceCount: 0,
  transitionDurationMinutes: 0,
  summaryNotes: '',
  cases: [],
  equipment: [],
  actions: [],
  signoff: {
    outgoingStaffId: '',
    outgoingStaffName: '',
    outgoingRole: '',
    outgoingConfirmed: false,
    incomingStaffId: '',
    incomingStaffName: '',
    incomingRole: '',
    incomingConfirmed: false,
  },
  createdAt: '',
};
