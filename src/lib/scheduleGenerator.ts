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
    myStartMins = Math.round(myStartMins / 30) * 30 // Snap to 30m
    
    const shifts: Shift[] = []
    const segments = Math.min(3, maxBreaks + 1)
    
    // Distribute maxHours into segments chunks of 30 mins
    let totalMinsToDistribute = maxHours * 60
    const segmentMinsList = []
    for (let i = 0; i < segments; i++) {
        if (i === segments - 1) {
             segmentMinsList.push(totalMinsToDistribute)
        } else {
             let share = Math.round((totalMinsToDistribute / (segments - i)) / 30) * 30
             if (share < minSegmentHours * 60) share = minSegmentHours * 60
             segmentMinsList.push(share)
             totalMinsToDistribute -= share
        }
    }
    
    // Prevent truncation by clamping the start time
    const totalRequiredMins = (maxHours * 60) + ((segments - 1) * 60)
    let maxStartMins = restEndMins - totalRequiredMins
    // Snap maxStartMins to 30m as well just in case
    maxStartMins = Math.floor(maxStartMins / 30) * 30
    
    if (myStartMins > maxStartMins) myStartMins = maxStartMins
    if (myStartMins < restStartMins) myStartMins = restStartMins

    let currentMarker = myStartMins

    for (let s = 0; s < segments; s++) {
      let segmentMins = segmentMinsList[s]
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
