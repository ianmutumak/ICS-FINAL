/**
 * ZAMU-CHECK Core Type Definitions
 * Enterprise Shift Handover, Kenya Airways Cargo & Multi-Zone Warehouse Operations
 */

export type SectorType = 'kq_bonded_freight' | 'warehouse_logistics' | 'industrial_onsite';

export type AcuityLevel = 'critical' | 'unstable' | 'observation' | 'stable';

export type ShiftType = 'morning' | 'evening' | 'night';

export type ShiftStatus = 'scheduled' | 'in_progress' | 'pending_signoff' | 'completed' | 'archived';


export interface UserStaff {
  id: string;
  staffNumber: string;
  name: string;
  role: string;
  department: string;
  qualification: string;
  avatarSeed: string;
  isAdmin?: boolean;
  status?: 'active' | 'on_leave' | 'suspended';
}

export interface DepartmentUnit {
  id: string;
  code: string;
  name: string;
  building: string;
  floor: string;
  capacity: number;
  activeUnits?: number; // Active pallets, ULD containers, or staged shipments
  headOfDepartment: string;
  currentShift: ShiftType;
  shiftStatus: ShiftStatus;
  roster: {
    morning: UserStaff[];
    evening: UserStaff[];
    night: UserStaff[];
  };
}

export interface SbarCase {
  id: string;
  subjectRef: string;
  category: string;
  acuity: AcuityLevel;
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
  isolationOrHazardAlert?: string;
  vitalsOrMetrics?: {
    label: string;
    value: string;
    isAbnormal?: boolean;
  }[];
  lastUpdated: string;
  updatedBy: string;
  /** The account that wrote the update. Only that account, or an administrator, can remove it. */
  authorId?: string;
  /** Set when the incoming staff member has acknowledged this update's safety warning. */
  acknowledgedBy?: string;
  acknowledgedById?: string;
  acknowledgedAt?: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  assetTag: string;
  location: string;
  status: 'functional' | 'inspection_due' | 'faulty' | 'in_use';
  batteryPercent?: number;
  custodyChecked: boolean;
  notes?: string;
}

export interface ShiftActionItem {
  id: string;
  title: string;
  priority: 'urgent' | 'high' | 'normal';
  departmentId: string;
  departmentName: string;
  assignedTo: string;
  dueTime: string;
  status: 'pending' | 'in_progress' | 'completed' | 'carried_over';
  carriedOverFromPrevious?: boolean;
  originatingShiftCode?: string;
}

export interface DualSignoff {
  outgoingStaffId: string;
  outgoingStaffName: string;
  outgoingRole: string;
  outgoingSignedAt?: string;
  outgoingSignatureText?: string;
  outgoingConfirmed: boolean;

  incomingStaffId: string;
  incomingStaffName: string;
  incomingRole: string;
  incomingSignedAt?: string;
  incomingSignatureText?: string;
  incomingConfirmed: boolean;

  verificationHash?: string;
}

export interface HandoverRecord {
  id: string;
  handoverCode: string;
  wardOrDepartment: string;
  departmentId: string;
  sector: SectorType;
  shiftType: ShiftType;
  shiftDate: string;
  shiftWindow: string;
  status: ShiftStatus;
  leadOutgoing: UserStaff;
  leadIncoming: UserStaff;
  attendanceCount: number;
  transitionDurationMinutes: number;
  summaryNotes: string;
  cases: SbarCase[];
  equipment: EquipmentItem[];
  actions: ShiftActionItem[];
  signoff: DualSignoff;
  createdAt: string;
  completedAt?: string;
  /** The administrator who approved the handover. */
  approvedBy?: string;
  approvedById?: string;
  isOverridden?: boolean;
  overrideReason?: string;
}

export interface IncidentRecord {
  id: string;
  departmentId: string;
  departmentName: string;
  title: string;
  severity: 'critical' | 'major' | 'moderate' | 'minor';
  status: 'open' | 'investigating' | 'resolved';
  reportedBy: string;
  reportedAt: string;
  resolvedBy?: string;
  resolvedAt?: string;
  mitigationNotes?: string;
  rootCause?: string;
}

export interface AdminOverrideLog {
  id: string;
  shiftId: string;
  shiftCode: string;
  departmentName: string;
  adminName: string;
  adminId: string;
  actionType: 'emergency_signoff' | 'cancel_shift' | 'reopen_shift' | 'dispute_resolution' | 'reassign_leads';
  reason: string;
  timestamp: string;
}

export interface AttendanceAuditLog {
  id: string;
  shiftCode: string;
  departmentName: string;
  date: string;
  shiftType: ShiftType;
  staffName: string;
  staffNumber: string;
  role: string;
  arrivedAt: string;
  punctual: boolean;
  huddleAttended: boolean;
}

export interface SignoffComplianceRecord {
  id: string;
  handoverCode: string;
  departmentName: string;
  date: string;
  shiftType: ShiftType;
  outgoingSigner: string;
  outgoingSignedAt: string;
  incomingSigner: string;
  incomingSignedAt: string;
  verificationHash?: string;
  complianceScore: number;
  timeDeltaMinutes: number;
}

export interface SusEvaluationRecord {
  id: string;
  shiftId?: string;
  shiftCode?: string;
  departmentName?: string;
  supervisorName: string;
  supervisorRole: string;
  timestamp: string;
  scores: number[]; // 10 items (1-5)
  totalScore: number; // 0-100 according to Brooke (1996)
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  adjectiveRating: 'Best Imaginable' | 'Excellent' | 'Good' | 'OK' | 'Poor';
  percentileBenchmark: number;
  debriefNotes?: string;
  operationalBottlenecks?: string;
  signoffVerificationFeedback?: string;
}

export interface HandoverEffectivenessIndex {
  score: number; // 0 - 100
  rating: 'Optimal' | 'Satisfactory' | 'At-Risk' | 'Deficient';
  breakdown: {
    sbarCompleteness: number; // max 40
    safetyAck: number; // max 35
    equipmentCustody: number; // max 25
    penalties: number; // deductions
  };
  details: {
    totalCases: number;
    completedSbarCases: number;
    criticalAlertsTotal: number;
    criticalAlertsAcknowledged: number;
    equipmentTotal: number;
    equipmentChecked: number;
    dualSignoffReady: boolean;
  };
}

export interface AppThemeConfig {
  fontDisplay: 'Plus Jakarta Sans' | 'Outfit' | 'Manrope' | 'Syne';
  colorTheme: 'clinical-teal' | 'circadian-night' | 'industrial-slate' | 'emergency-coral';
  sector: SectorType;
  isDark: boolean;
}

