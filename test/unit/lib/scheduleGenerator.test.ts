import { describe, it, expect } from 'vitest';
import { generateSchedules, timeToMins, minsToTime } from '../../../src/lib/scheduleGenerator';

describe('scheduleGenerator', () => {
  it('should generate 10 hour shifts perfectly rounded to 30 mins', () => {
    const schedules = generateSchedules({
      positionCount: 1,
      branchStartTime: '05:00',
      branchEndTime: '23:00',
      maxHours: 10,
      minSegmentHours: 2,
      maxBreaks: 2
    });

    expect(schedules.length).toBe(1);
    const shifts = schedules[0].shifts;
    
    // We expect 3 shifts adding up to exactly 10 hours (600 mins)
    expect(shifts.length).toBe(3);
    
    let totalMins = 0;
    shifts.forEach(shift => {
      const start = timeToMins(shift.start);
      const end = timeToMins(shift.end);
      totalMins += (end - start);
      
      // Boundaries should be aligned to 30 mins (modulo 30 is 0)
      expect(start % 30).toBe(0);
      expect(end % 30).toBe(0);
    });
    
    expect(totalMins).toBe(600); // exactly 10 hours
  });

  it('should clamp start times to prevent truncation', () => {
    // If a position tries to start very late, it should be clamped so the shift fits within branchEndTime
    const schedules = generateSchedules({
      positionCount: 10, // A high position count pushes the start time later
      branchStartTime: '05:00',
      branchEndTime: '23:00', // 11 PM
      maxHours: 10,
      minSegmentHours: 2,
      maxBreaks: 2
    });
    
    const lastSchedule = schedules[schedules.length - 1];
    const shifts = lastSchedule.shifts;
    
    // The last shift should end exactly at 23:00 to avoid truncation
    const lastShiftEnd = shifts[shifts.length - 1].end;
    expect(lastShiftEnd).toBe('23:00');
    
    // Should still total exactly 10 hours (600 mins)
    let totalMins = 0;
    shifts.forEach(shift => {
      totalMins += (timeToMins(shift.end) - timeToMins(shift.start));
    });
    expect(totalMins).toBe(600);
  });

  // ── time conversion helpers ──────────────────────────────────────────────

  describe('timeToMins / minsToTime', () => {
    it('converts HH:MM to minutes', () => {
      expect(timeToMins('00:00')).toBe(0);
      expect(timeToMins('05:30')).toBe(330);
      expect(timeToMins('23:59')).toBe(1439);
    });

    it('treats malformed parts as zero', () => {
      expect(timeToMins('abc')).toBe(0);
      expect(timeToMins('10')).toBe(600);   // missing minutes
    });

    it('formats minutes back to HH:MM with zero padding', () => {
      expect(minsToTime(0)).toBe('00:00');
      expect(minsToTime(330)).toBe('05:30');
      expect(minsToTime(1439)).toBe('23:59');
    });

    it('wraps values at or beyond 24h back into the day', () => {
      expect(minsToTime(24 * 60)).toBe('00:00');
      expect(minsToTime(25 * 60)).toBe('01:00');
    });

    it('wraps negative values forward into the day', () => {
      expect(minsToTime(-60)).toBe('23:00');
    });

    it('round-trips through both helpers', () => {
      expect(minsToTime(timeToMins('14:45'))).toBe('14:45');
    });
  });

  // ── generator branches ───────────────────────────────────────────────────

  it('handles an overnight branch window (end before start)', () => {
    const schedules = generateSchedules({
      positionCount: 1,
      branchStartTime: '18:00',
      branchEndTime: '02:00',   // crosses midnight
      maxHours: 6,
      minSegmentHours: 2,
      maxBreaks: 1,
    });
    expect(schedules).toHaveLength(1);
    expect(schedules[0].shifts.length).toBeGreaterThan(0);
    schedules[0].shifts.forEach(s => {
      expect(s.start).toMatch(/^\d{2}:\d{2}$/);
      expect(s.end).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  it('produces a single straight shift when maxBreaks is 0', () => {
    const schedules = generateSchedules({
      positionCount: 1,
      branchStartTime: '06:00',
      branchEndTime: '22:00',
      maxHours: 8,
      minSegmentHours: 2,
      maxBreaks: 0,
    });
    expect(schedules[0].shifts).toHaveLength(1);
    const { start, end } = schedules[0].shifts[0];
    expect(timeToMins(end) - timeToMins(start)).toBe(480); // 8h
  });

  it('caps segments at 3 even when more breaks are requested', () => {
    const schedules = generateSchedules({
      positionCount: 1,
      branchStartTime: '05:00',
      branchEndTime: '23:00',
      maxHours: 10,
      minSegmentHours: 1,
      maxBreaks: 5,
    });
    expect(schedules[0].shifts.length).toBeLessThanOrEqual(3);
  });

  it('honours a large minSegmentHours by lifting each segment to the minimum', () => {
    const schedules = generateSchedules({
      positionCount: 1,
      branchStartTime: '05:00',
      branchEndTime: '23:00',
      maxHours: 6,
      minSegmentHours: 4,   // larger than an even split of 6h across segments
      maxBreaks: 2,
    });
    schedules[0].shifts.forEach(s => {
      expect(timeToMins(s.end) - timeToMins(s.start)).toBeGreaterThanOrEqual(4 * 60);
    });
  });

  it('generates one schedule per position with sequential indexes', () => {
    const schedules = generateSchedules({
      positionCount: 4,
      branchStartTime: '06:00',
      branchEndTime: '22:00',
      maxHours: 8,
      minSegmentHours: 2,
      maxBreaks: 1,
    });
    expect(schedules.map(s => s.positionIndex)).toEqual([0, 1, 2, 3]);
  });

  it('returns an empty list when positionCount is 0', () => {
    const schedules = generateSchedules({
      positionCount: 0,
      branchStartTime: '06:00',
      branchEndTime: '22:00',
      maxHours: 8,
      minSegmentHours: 2,
      maxBreaks: 1,
    });
    expect(schedules).toEqual([]);
  });

  it('assigns a unique id to every generated shift', () => {
    const schedules = generateSchedules({
      positionCount: 2,
      branchStartTime: '05:00',
      branchEndTime: '23:00',
      maxHours: 10,
      minSegmentHours: 2,
      maxBreaks: 2,
    });
    const ids = schedules.flatMap(s => s.shifts.map(sh => sh.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
