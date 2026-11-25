import { describe, expect, it } from 'vitest';
import { DEFAULT_WORK_AREAS, OTHER_AREA, preselectArea } from './workAreas';

describe('work areas', () => {
  it('offers a usable list of unique, plainly named areas', () => {
    expect(DEFAULT_WORK_AREAS.length).toBeGreaterThanOrEqual(8);
    expect(new Set(DEFAULT_WORK_AREAS).size).toBe(DEFAULT_WORK_AREAS.length);
    for (const name of DEFAULT_WORK_AREAS) {
      expect(name.trim()).toBe(name);
      expect(name.length).toBeLessThanOrEqual(80);
      expect(name).not.toBe(OTHER_AREA);
    }
  });

  it("preselects the person's own department when it is on the list, ignoring case and spaces", () => {
    expect(preselectArea(DEFAULT_WORK_AREAS, 'cold chain')).toBe('Cold Chain');
    expect(preselectArea(DEFAULT_WORK_AREAS, '  Ramp ')).toBe('Ramp');
  });

  it('falls back to the first area otherwise', () => {
    expect(preselectArea(DEFAULT_WORK_AREAS, '')).toBe(DEFAULT_WORK_AREAS[0]);
    expect(preselectArea(DEFAULT_WORK_AREAS, 'Finance')).toBe(DEFAULT_WORK_AREAS[0]);
    expect(preselectArea(['Zone A', 'Zone B'], 'Import Warehouse')).toBe('Zone A');
  });
});
