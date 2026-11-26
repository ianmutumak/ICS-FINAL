import { describe, expect, it } from 'vitest';
import {
  CERTIFICATIONS, MAX_CERTIFICATIONS_LENGTH, ROLES, ROLE_TEMPLATES, certificationsFit, departmentOptions, joinCertifications,
  nextBadgeId, randomPin, splitCertifications,
} from './userTemplates';
import { DEFAULT_WORK_AREAS } from './workAreas';

describe('user templates', () => {
  it('offers unique roles and certifications that fit what the server accepts', () => {
    expect(new Set(ROLES).size).toBe(ROLES.length);
    expect(new Set(CERTIFICATIONS).size).toBe(CERTIFICATIONS.length);
    for (const template of ROLE_TEMPLATES) {
      expect(template.role.length).toBeLessThanOrEqual(80);
      expect(certificationsFit(template.certifications), template.id).toBe(true);
      for (const name of template.certifications) expect(CERTIFICATIONS).toContain(name);
    }
  });

  it('uses only the standard warehouse areas as departments, so a template can fill them in', () => {
    for (const template of ROLE_TEMPLATES) {
      if (template.department) expect(DEFAULT_WORK_AREAS, template.id).toContain(template.department);
    }
  });

  it('has exactly one administrator template, and no staff template makes an administrator', () => {
    expect(ROLE_TEMPLATES.filter((template) => template.isAdmin).map((template) => template.id)).toEqual(['admin']);
  });

  it("offers the administrator's own zones when there are any, otherwise the standard areas", () => {
    expect(departmentOptions(['Zone A', 'Zone B'])).toEqual(['Zone A', 'Zone B']);
    expect(departmentOptions([])).toEqual(DEFAULT_WORK_AREAS);
  });

  it('joins and splits certifications without losing or inventing any', () => {
    const items = ['Load Control', 'First Aid'];
    expect(joinCertifications(items)).toBe('Load Control, First Aid');
    expect(splitCertifications('Load Control, First Aid')).toEqual(items);
    expect(splitCertifications('  A ,, B  ,')).toEqual(['A', 'B']);
    expect(splitCertifications('')).toEqual([]);
  });

  it('knows when certifications are too long for the 120 character field', () => {
    expect(certificationsFit(CERTIFICATIONS.slice(0, 3))).toBe(true);
    expect(certificationsFit(CERTIFICATIONS)).toBe(joinCertifications(CERTIFICATIONS).length <= MAX_CERTIFICATIONS_LENGTH);
    expect(certificationsFit(['x'.repeat(121)])).toBe(false);
  });

  it('generates 4-digit PINs that are digits only and not all the same', () => {
    const pins = Array.from({ length: 300 }, () => randomPin());
    for (const pin of pins) expect(pin).toMatch(/^\d{4}$/);
    expect(new Set(pins).size).toBeGreaterThan(100);
  });

  it('suggests the next free badge ID', () => {
    expect(nextBadgeId([])).toBe('ZC-1001');
    expect(nextBadgeId(['ADMIN-0001', 'KQ-1001'])).toBe('ZC-1001');
    expect(nextBadgeId(['ZC-1001', 'zc-1002', 'ADMIN1'])).toBe('ZC-1003');
    expect(nextBadgeId(['ZC-1005', 'ZC-1001'])).toBe('ZC-1006');
  });
});
