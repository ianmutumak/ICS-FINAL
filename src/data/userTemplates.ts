import { DEFAULT_WORK_AREAS } from './workAreas';

/**
 * Ready-made choices for the administrator's Add user form, so that creating an account takes a few taps:
 * pick a role template and the role, department and certifications fill in, then change whatever differs.
 * All wording is general; it names no person or customer.
 */

export interface RoleTemplate {
  id: string;
  /** The job title that is saved as the user's role. */
  role: string;
  /** A usual department for the role, used only if it is one of the offered departments. */
  department: string;
  certifications: string[];
  isAdmin?: boolean;
}

export const CERTIFICATIONS: string[] = [
  'Dangerous Goods Awareness',
  'Dangerous Goods Certified',
  'Load Control',
  'Forklift Licence',
  'Perishables Handling',
  'Customs Documentation',
  'Cargo Security',
  'Ramp Safety',
  'First Aid',
  'Fire Marshal',
];

export const ROLE_TEMPLATES: RoleTemplate[] = [
  { id: 'handler', role: 'Cargo Handler', department: 'Import Warehouse', certifications: ['Dangerous Goods Awareness'] },
  { id: 'supervisor', role: 'Shift Supervisor', department: '', certifications: ['Load Control', 'First Aid'] },
  { id: 'operator', role: 'Equipment Operator', department: 'Ramp', certifications: ['Forklift Licence', 'Ramp Safety'] },
  { id: 'cold', role: 'Cold Chain Technician', department: 'Cold Chain', certifications: ['Perishables Handling'] },
  { id: 'dg', role: 'Dangerous Goods Officer', department: 'Dangerous Goods Store', certifications: ['Dangerous Goods Certified', 'Fire Marshal'] },
  { id: 'clerk', role: 'Warehouse Clerk', department: 'Export Warehouse', certifications: ['Customs Documentation'] },
  { id: 'load', role: 'Load Controller', department: 'Build-up Area', certifications: ['Load Control'] },
  { id: 'security', role: 'Security and Seal Checker', department: 'Customs Bonded Store', certifications: ['Cargo Security'] },
  { id: 'admin', role: 'Operations Administrator', department: '', certifications: [], isAdmin: true },
];

export const ROLES: string[] = ROLE_TEMPLATES.map((template) => template.role);

/** The departments offered: the administrator's zones if there are any, otherwise the standard warehouse areas. */
export const departmentOptions = (zoneNames: string[]): string[] => (zoneNames.length > 0 ? zoneNames : DEFAULT_WORK_AREAS);

/** The server keeps certifications as one text of up to 120 characters. */
export const MAX_CERTIFICATIONS_LENGTH = 120;

export const splitCertifications = (text: string): string[] =>
  text.split(',').map((item) => item.trim()).filter(Boolean);

export const joinCertifications = (items: string[]): string => items.join(', ');

/** The words the person has chosen, with a note of whether they fit in the field. */
export const certificationsFit = (items: string[]): boolean => joinCertifications(items).length <= MAX_CERTIFICATIONS_LENGTH;

/** A random 4-digit PIN for the administrator to read to the worker, who can change it in Edit profile. */
export function randomPin(): string {
  const numbers = new Uint32Array(1);
  // Rejection sampling keeps every PIN equally likely.
  const limit = Math.floor(0x1_0000_0000 / 10_000) * 10_000;
  do {
    crypto.getRandomValues(numbers);
  } while (numbers[0] >= limit);
  return String(numbers[0] % 10_000).padStart(4, '0');
}

/** The next free badge ID of the form ZC-1001, so that the administrator does not have to invent one. */
export function nextBadgeId(existing: string[]): string {
  const taken = new Set(existing.map((badge) => badge.toUpperCase()));
  const numbers = existing.map((badge) => /^ZC-(\d+)$/i.exec(badge)?.[1]).filter(Boolean).map(Number);
  let next = numbers.length ? Math.max(...numbers) + 1 : 1001;
  while (taken.has(`ZC-${next}`)) next += 1;
  return `ZC-${next}`;
}
