import {
  DepartmentUnit,
  HandoverRecord,
  UserStaff,
  AttendanceAuditLog,
  SignoffComplianceRecord,
  ShiftActionItem,
  IncidentRecord,
  AdminOverrideLog,
  SusEvaluationRecord,
} from '../types';

export const SEED_STAFF: UserStaff[] = [
  {
    id: 'usr-001',
    staffNumber: 'KQ-SUP-8841',
    name: 'Mary Wanjiku',
    role: 'Shift Operations Supervisor & Cargo Duty Lead',
    department: 'KQ Import Bonded Freight Warehouse',
    qualification: 'IATA Cargo Operations / OSHA Warehouse Certified',
    avatarSeed: 'MW',
    pin: '1234',
    email: 'm.wanjiku@kq.aero',
    isAdmin: true,
    status: 'active',
  },
  {
    id: 'usr-002',
    staffNumber: 'KQ-OPS-9204',
    name: 'David Kiprop',
    role: 'Lead Ramp & Cargo Marshall',
    department: 'KQ Import Bonded Freight Warehouse',
    qualification: 'MHE Master Operator / ULD Build-up Specialist',
    avatarSeed: 'DK',
    pin: '1234',
    email: 'd.kiprop@kq.aero',
    isAdmin: false,
    status: 'active',
  },
];

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

export const SEED_DEPARTMENTS: DepartmentUnit[] = [];

export const SEED_TASKS: ShiftActionItem[] = [];

export const SEED_INCIDENTS: IncidentRecord[] = [];

export const SEED_OVERRIDE_LOGS: AdminOverrideLog[] = [];

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

export const PAST_HANDOVER_ARCHIVE: HandoverRecord[] = [];

export const SEED_ATTENDANCE_LOGS: AttendanceAuditLog[] = [];

export const SEED_COMPLIANCE_RECORDS: SignoffComplianceRecord[] = [];

export const SEED_CATEGORIES: string[] = [];

export const SEED_SUS_EVALUATIONS: SusEvaluationRecord[] = [];
