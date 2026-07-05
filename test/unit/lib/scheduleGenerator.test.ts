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
});
