// apps/api/src/services/__tests__/collisionHelpers.test.ts

import { describe, it, expect } from 'vitest';
import { timeToMinutes, doTimesOverlap, doWeeksOverlap } from '../entryService';

describe('timeToMinutes', () => {
  it('converts 00:00 to 0', () => {
    expect(timeToMinutes('00:00')).toBe(0);
  });

  it('converts 08:00 to 480', () => {
    expect(timeToMinutes('08:00')).toBe(480);
  });

  it('converts 23:59 to 1439', () => {
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('converts 09:30 to 570', () => {
    expect(timeToMinutes('09:30')).toBe(570);
  });
});

describe('doTimesOverlap', () => {
  it('returns true for overlapping slots (partial overlap)', () => {
    // Slot 1: 08:00-09:30, Slot 2: 09:00-10:30
    expect(doTimesOverlap('08:00', '09:30', '09:00', '10:30')).toBe(true);
  });

  it('returns true for one slot containing another', () => {
    // Slot 1: 08:00-12:00 contains Slot 2: 09:00-10:00
    expect(doTimesOverlap('08:00', '12:00', '09:00', '10:00')).toBe(true);
  });

  it('returns true for identical slots', () => {
    expect(doTimesOverlap('08:00', '09:30', '08:00', '09:30')).toBe(true);
  });

  it('returns false when slots are adjacent (end == start)', () => {
    // Slot 1 ends exactly when Slot 2 starts — NOT a collision
    expect(doTimesOverlap('08:00', '09:30', '09:30', '11:00')).toBe(false);
  });

  it('returns false for completely separate slots', () => {
    expect(doTimesOverlap('08:00', '09:30', '10:00', '11:30')).toBe(false);
  });

  it('returns false for slots in reverse order (s2 before s1)', () => {
    expect(doTimesOverlap('10:00', '11:30', '08:00', '09:30')).toBe(false);
  });
});

describe('doWeeksOverlap', () => {
  it('returns true when both are AB', () => {
    expect(doWeeksOverlap('AB', 'AB')).toBe(true);
  });

  it('returns true when one is AB and the other is A', () => {
    expect(doWeeksOverlap('AB', 'A')).toBe(true);
    expect(doWeeksOverlap('A', 'AB')).toBe(true);
  });

  it('returns true when one is AB and the other is B', () => {
    expect(doWeeksOverlap('AB', 'B')).toBe(true);
    expect(doWeeksOverlap('B', 'AB')).toBe(true);
  });

  it('returns true when both are A', () => {
    expect(doWeeksOverlap('A', 'A')).toBe(true);
  });

  it('returns true when both are B', () => {
    expect(doWeeksOverlap('B', 'B')).toBe(true);
  });

  it('returns false when A vs B', () => {
    expect(doWeeksOverlap('A', 'B')).toBe(false);
    expect(doWeeksOverlap('B', 'A')).toBe(false);
  });
});
