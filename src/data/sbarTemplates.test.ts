import { describe, expect, it } from 'vitest';
import {
  OWN_WORDS, SCENARIOS, TEMPLATES, WARNING_TEMPLATES, composePart, type SbarPart,
} from './sbarTemplates';

const PARTS: SbarPart[] = ['situation', 'background', 'assessment', 'recommendation'];

describe('SBAR templates', () => {
  it('offers templates for every part, with unique ids and wording that fits the update fields', () => {
    for (const part of PARTS) {
      const list = TEMPLATES[part];
      expect(list.length).toBeGreaterThanOrEqual(9);
      expect(new Set(list.map((entry) => entry.id)).size).toBe(list.length);
      for (const entry of list) {
        expect(entry.label.trim().length).toBeGreaterThan(0);
        expect(entry.text.trim().length).toBeGreaterThan(10);
        // The server accepts up to 2,000 characters per part; a template must leave room for what a person adds.
        expect(entry.text.length).toBeLessThan(200);
      }
    }
    expect(new Set(WARNING_TEMPLATES.map((entry) => entry.id)).size).toBe(WARNING_TEMPLATES.length);
    // The server accepts a warning of up to 300 characters; the form allows 200 more after a template.
    for (const entry of WARNING_TEMPLATES) expect(entry.text.length + 200 + 1).toBeLessThanOrEqual(300);
  });

  it('keeps every scenario pointing at templates that exist', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(8);
    for (const scenario of SCENARIOS) {
      for (const part of PARTS) {
        expect(TEMPLATES[part].some((entry) => entry.id === scenario[part]), `${scenario.id} ${part}`).toBe(true);
      }
      if (scenario.warning) {
        expect(WARNING_TEMPLATES.some((entry) => entry.id === scenario.warning), `${scenario.id} warning`).toBe(true);
      }
    }
  });

  it('puts the template first and then what the person added', () => {
    const routine = TEMPLATES.situation[0];
    expect(composePart('situation', routine.id, '')).toBe(routine.text);
    expect(composePart('situation', routine.id, '  AWB 000-1234 is on bay 4.  ')).toBe(`${routine.text} AWB 000-1234 is on bay 4.`);
  });

  it("uses only the person's own words when they choose to write it, and nothing when nothing is chosen", () => {
    expect(composePart('assessment', OWN_WORDS, '  Pallet leaning left.  ')).toBe('Pallet leaning left.');
    expect(composePart('assessment', OWN_WORDS, '   ')).toBe('');
    expect(composePart('recommendation', '', '')).toBe('');
    expect(composePart('warning', 'w-dry-ice', 'Bay 2.')).toBe('Dry ice present. Ventilate the area before entering. Bay 2.');
  });

  it('names no customer, person or flight', () => {
    const all = [...PARTS.flatMap((part) => TEMPLATES[part]), ...WARNING_TEMPLATES].map((entry) => entry.text).join(' ');
    expect(all).not.toMatch(/Kenya Airways|\bKQ\s?\d/i);
  });
});
