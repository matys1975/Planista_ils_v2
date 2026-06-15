import { describe, it, expect } from 'vitest';
import { doTimesOverlap, doWeeksOverlap, timeToMinutes } from './entryService';

describe('entryService', () => {
  describe('timeToMinutes', () => {
    it('converts HH:mm to minutes correctly', () => {
      expect(timeToMinutes('08:00')).toBe(480);
      expect(timeToMinutes('09:30')).toBe(570);
      expect(timeToMinutes('00:00')).toBe(0);
      expect(timeToMinutes('23:59')).toBe(1439);
    });
  });

  describe('doTimesOverlap', () => {
    it('detects overlapping times correctly', () => {
      // Complete overlap
      expect(doTimesOverlap('08:00', '09:30', '08:00', '09:30')).toBe(true);
      // Partial overlap
      expect(doTimesOverlap('08:00', '09:30', '09:00', '10:30')).toBe(true);
      expect(doTimesOverlap('09:00', '10:30', '08:00', '09:30')).toBe(true);
      // One inside another
      expect(doTimesOverlap('08:00', '10:00', '08:30', '09:30')).toBe(true);
    });

    it('returns false for non-overlapping times', () => {
      // Exactly adjacent
      expect(doTimesOverlap('08:00', '09:30', '09:30', '11:00')).toBe(false);
      expect(doTimesOverlap('09:30', '11:00', '08:00', '09:30')).toBe(false);
      // Far apart
      expect(doTimesOverlap('08:00', '09:30', '10:00', '11:30')).toBe(false);
    });
  });

  describe('doWeeksOverlap', () => {
    it('returns true when weeks overlap', () => {
      expect(doWeeksOverlap('AB', 'A')).toBe(true);
      expect(doWeeksOverlap('AB', 'B')).toBe(true);
      expect(doWeeksOverlap('A', 'AB')).toBe(true);
      expect(doWeeksOverlap('B', 'AB')).toBe(true);
      expect(doWeeksOverlap('AB', 'AB')).toBe(true);
      expect(doWeeksOverlap('A', 'A')).toBe(true);
      expect(doWeeksOverlap('B', 'B')).toBe(true);
    });

    it('returns false when weeks do not overlap', () => {
      expect(doWeeksOverlap('A', 'B')).toBe(false);
      expect(doWeeksOverlap('B', 'A')).toBe(false);
    });
  });
});
