import { describe, it, expect } from 'vitest';
import { parseCourseCode } from './courseUtils';

describe('parseCourseCode', () => {
  it('parses valid course code correctly', () => {
    const result = parseCourseCode('09-S1LSA01-P00560');
    expect(result).toEqual({
      major: 'S1-LSA',
      majorLabel: 'Lingwistyka stosowana (ang. z niem.) – I st.',
      studySemester: 1,
      studyYear: 1
    });
  });

  it('parses another level correctly', () => {
    const result = parseCourseCode('09-S2LSN03-P00561');
    expect(result).toEqual({
      major: 'S2-LSN',
      majorLabel: 'Lingwistyka stosowana (niem. z ang.) – II st.',
      studySemester: 3,
      studyYear: 2
    });
  });

  it('handles malformed code correctly', () => {
    const result = parseCourseCode('UNKNOWN_CODE');
    expect(result).toEqual({
      major: null,
      majorLabel: null,
      studySemester: null,
      studyYear: null
    });
  });

  it('handles empty code correctly', () => {
    const result = parseCourseCode('');
    expect(result).toEqual({
      major: null,
      majorLabel: null,
      studySemester: null,
      studyYear: null
    });
  });
});
