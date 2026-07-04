import { Shift, PositionSchedule } from '@/app/actions/staff_requirements'

export const timeToMins = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export const minsToTime = (mins: number) => {
  let h = Math.floor(mins / 60)
  let m = Math.floor(mins % 60)
  if (h >= 24) h -= 24
  if (h < 0) h += 24
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

type GeneratorParams = {
  positionCount: number
  branchStartTime: string
  branchEndTime: string
  maxHours: number
  minSegmentHours: number
  maxBreaks: number
}

export function generateSchedules({
  positionCount,
  branchStartTime,
  branchEndTime,
  maxHours,
  minSegmentHours,
  maxBreaks
}: GeneratorParams): PositionSchedule[] {
  const schedules: PositionSchedule[] = []
  const restStartMins = timeToMins(branchStartTime)
  let restEndMins = timeToMins(branchEndTime)
  if (restEndMins <= restStartMins) restEndMins += 24 * 60

  const totalRestMins = restEndMins - restStartMins

  for (let p = 0; p < positionCount; p++) {
    let myStartMins = restStartMins + (p * (totalRestMins / Math.max(positionCount, 1)) * 0.5)
    myStartMins = Math.round(myStartMins / 15) * 15 // Snap to 15m
    
    const shifts: Shift[] = []
    const segments = Math.min(3, maxBreaks + 1)
    const hrsPerSegment = maxHours / segments
    let segmentMins = hrsPerSegment * 60
    if (segmentMins < minSegmentHours * 60) segmentMins = minSegmentHours * 60
    
    let currentMarker = myStartMins

    for (let s = 0; s < segments; s++) {
      let endMarker = currentMarker + segmentMins
      if (endMarker > restEndMins) endMarker = restEndMins
      
      if (endMarker - currentMarker >= minSegmentHours * 60) {
        shifts.push({
          id: `gen_${p}_${s}_${Date.now()}`,
          start: minsToTime(currentMarker),
          end: minsToTime(endMarker)
        })
      }
      
      currentMarker = endMarker + 60 // 1 hour break
      if (currentMarker >= restEndMins) break;
    }

    schedules.push({
      positionIndex: p,
      shifts
    })
  }

  return schedules
}
