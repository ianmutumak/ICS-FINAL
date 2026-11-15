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

export const SEED_DEPARTMENTS: DepartmentUnit[] = [
  {
    id: 'dept-imp',
    code: 'KQ-IMP',
    name: 'KQ Import Bonded Freight Warehouse',
    building: 'JKIA Cargo Village Terminal 1',
    floor: 'Bays 01-16 & Customs Bond Zone',
    capacity: 2500,
    activeUnits: 0,
    headOfDepartment: 'Mary Wanjiku',
    currentShift: 'morning',
    shiftStatus: 'scheduled',
    roster: {
      morning: [SEED_STAFF[0]],
      evening: [],
      night: [],
    },
  },
];

export const SEED_TASKS: ShiftActionItem[] = [];

export const SEED_INCIDENTS: IncidentRecord[] = [];

export const SEED_OVERRIDE_LOGS: AdminOverrideLog[] = [];

export const INITIAL_ACTIVE_HANDOVER: HandoverRecord = {
  id: 'hnd-current',
  handoverCode: 'KQ-2026-IMP-MORN-01',
  wardOrDepartment: 'KQ Import Bonded Freight Warehouse',
  departmentId: 'dept-imp',
  sector: 'kq_bonded_freight',
  shiftType: 'morning',
  shiftDate: '2026-11-02',
  shiftWindow: '07:00 - 15:30 EAT',
  status: 'in_progress',
  leadOutgoing: SEED_STAFF[0],
  leadIncoming: SEED_STAFF[1],
  attendanceCount: 1,
  transitionDurationMinutes: 0,
  summaryNotes: '',
  cases: [],
  equipment: [],
  actions: [],
  signoff: {
    outgoingStaffId: SEED_STAFF[0].id,
    outgoingStaffName: SEED_STAFF[0].name,
    outgoingRole: SEED_STAFF[0].role,
    outgoingConfirmed: false,
    incomingStaffId: SEED_STAFF[1].id,
    incomingStaffName: SEED_STAFF[1].name,
    incomingRole: SEED_STAFF[1].role,
    incomingConfirmed: false,
  },
  createdAt: '2026-11-02T07:00:00Z',
};

export const PAST_HANDOVER_ARCHIVE: HandoverRecord[] = [];

export const SEED_ATTENDANCE_LOGS: AttendanceAuditLog[] = [];

export const SEED_COMPLIANCE_RECORDS: SignoffComplianceRecord[] = [];

export const SEED_CATEGORIES: string[] = [
  'Inbound Staging & Receiving',
  'MHE & Equipment Custody',
  'Cold Storage & Temperature Vault',
  'Customs & Bonded Freight',
  'Hazardous & Dangerous Goods',
  'Outbound Marshalling & Dispatch',
  'Facility Safety & Environmental',
];

export const SEED_SUS_EVALUATIONS: SusEvaluationRecord[] = [];
