"use client"

import { useState, useMemo, useRef, useEffect } from 'react'
import { updateRequirementSchedules, Shift, PositionSchedule } from '@/app/actions/staff_requirements'
import { X, Save, Loader2, Wand2, Info } from 'lucide-react'
import { AutoScheduleModal } from './AutoScheduleModal'


type Props = {
  staff: any[]
  requirements: any[]
  branches: any[]
  departments: any[]
  roles: any[]
  isReadOnly?: boolean
  isPending?: boolean
}

const timeToMins = (timeStr?: string) => {
  if (!timeStr) return 0
  const [h, m] = timeStr.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

const minsToTime = (mins: number) => {
  let h = Math.floor(mins / 60)
  let m = Math.floor(mins % 60)
  if (h >= 24) h -= 24
  if (h < 0) h += 24
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

const formatTime = (timeStr?: string) => {
  if (!timeStr) return ''
  const [hStr, mStr] = timeStr.split(':')
  let h = parseInt(hStr, 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${mStr} ${ampm}`
}

const normalizeMins = (mins: number, startMins: number) => {
  if (mins < startMins) return mins + 24 * 60
  return mins
}

function PositionRow({ 
  req, 
  positionIndex, 
  startMins, 
  totalDuration, 
  isEditMode,
  onSave 
}: { 
  req: any, positionIndex: number, startMins: number, totalDuration: number, isEditMode: boolean, onSave: (s: Shift[]) => void 
}) {
  const schedule = req.schedules?.find((s: any) => s.positionIndex === positionIndex)
  const [shifts, setShifts] = useState<Shift[]>(schedule?.shifts || [])
  
  useEffect(() => {
    setShifts(req.schedules?.find((s: any) => s.positionIndex === positionIndex)?.shifts || [])
  }, [req.schedules, positionIndex])

  const containerRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ type: 'create' | 'resize-start' | 'resize-end', shiftId: string, startMins: number, shiftSnapshot: Shift } | null>(null)

  const getMinsFromEvent = (e: React.PointerEvent) => {
    if (!containerRef.current) return 0
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const perc = Math.max(0, Math.min(1, x / rect.width))
    const mins = startMins + (perc * totalDuration)
    return Math.round(mins / 15) * 15 // Snap to 15 mins
  }

  const handlePointerDown = (e: React.PointerEvent, type: 'create' | 'resize-start' | 'resize-end', shiftId?: string) => {
    if (!isEditMode) return
    e.stopPropagation()
    const mins = getMinsFromEvent(e)
    
    if (type === 'create') {
      const newShift: Shift = {
        id: `s_${Date.now()}`,
        start: minsToTime(mins),
        end: minsToTime(mins + 60) // Default 1 hour
      }
      setShifts([...shifts, newShift])
      dragState.current = { type: 'resize-end', shiftId: newShift.id, startMins: mins, shiftSnapshot: newShift }
    } else if (shiftId) {
      const shift = shifts.find(s => s.id === shiftId)!
      dragState.current = { type, shiftId, startMins: mins, shiftSnapshot: {...shift} }
    }
    
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragState.current) return
    const { type, shiftId, shiftSnapshot } = dragState.current
    const mins = getMinsFromEvent(e)
    
    setShifts(prev => prev.map(s => {
      if (s.id !== shiftId) return s
      let newStartMins = normalizeMins(timeToMins(shiftSnapshot.start), startMins)
      let newEndMins = normalizeMins(timeToMins(shiftSnapshot.end), startMins)
      
      if (type === 'resize-start') {
        newStartMins = Math.min(mins, newEndMins - 15) // Min 15 min duration
      } else if (type === 'resize-end') {
        newEndMins = Math.max(mins, newStartMins + 15)
      }
      return { ...s, start: minsToTime(newStartMins), end: minsToTime(newEndMins) }
    }))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragState.current) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    dragState.current = null
    onSave(shifts)
  }

  const removeShift = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const newShifts = shifts.filter(s => s.id !== id)
    setShifts(newShifts)
    onSave(newShifts)
  }

  const getStyle = (start: string, end: string) => {
    let sMins = normalizeMins(timeToMins(start), startMins)
    let eMins = normalizeMins(timeToMins(end), startMins)
    if (eMins <= sMins) eMins += 24 * 60
    
    const actualStart = Math.max(startMins, sMins)
    const actualEnd = Math.min(startMins + totalDuration, eMins)

    if (actualEnd <= actualStart) return { display: 'none' }

    const left = ((actualStart - startMins) / totalDuration) * 100
    const width = ((actualEnd - actualStart) / totalDuration) * 100

    return { left: `${left}%`, width: `${width}%` }
  }

  return (
    <div 
      ref={containerRef}
      className={`relative h-12 w-full group border-b border-[#3b3054]/30 last:border-0 ${isEditMode ? 'hover:bg-white/[0.02] cursor-crosshair touch-none' : ''}`}
      onPointerDown={(e) => handlePointerDown(e, 'create')}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Total hours indicator */}
      {(() => {
        const totalMins = shifts.reduce((acc, s) => {
          let sMins = timeToMins(s.start)
          let eMins = timeToMins(s.end)
          if (eMins <= sMins) eMins += 24 * 60
          return acc + (eMins - sMins)
        }, 0)
        const totalHoursStr = (totalMins / 60).toFixed(1).replace(/\.0$/, '') + 'h'
        const isOver = totalMins > 10 * 60
        return (
          <div className={`absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-medium px-1.5 py-0.5 rounded border pointer-events-none z-10 ${isOver ? 'bg-red-900/40 text-red-400 border-red-900/50' : 'bg-[#131018] text-slate-500 border-[#3b3054]/50'}`}>
            {totalHoursStr} / max 10h
          </div>
        )
      })()}
      {shifts.map(s => (
        <div 
          key={s.id} 
          className="absolute h-8 top-2 rounded bg-gradient-to-r from-[#c084fc] to-[#a855f7] shadow-md flex items-center group/shift transition-all"
          style={getStyle(s.start, s.end)}
          onPointerDown={e => e.stopPropagation()} // Prevent create when clicking inside block
        >
          {/* Resize handle left */}
          {isEditMode && (
            <div 
              className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 rounded-l"
              onPointerDown={e => handlePointerDown(e, 'resize-start', s.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          )}
          
          <span className="px-2 text-[10px] font-bold text-white truncate pointer-events-none select-none">
            {formatTime(s.start)} - {formatTime(s.end)}
          </span>
          
          {isEditMode && (
            <button 
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 bg-black/20 hover:bg-black/40 rounded-full opacity-0 group-hover/shift:opacity-100 transition-opacity"
              onClick={(e) => removeShift(e, s.id)}
            >
              <X className="h-3 w-3 text-white" />
            </button>
          )}

          {/* Resize handle right */}
          {isEditMode && (
            <div 
              className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 rounded-r"
              onPointerDown={e => handlePointerDown(e, 'resize-end', s.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export function ScheduleTimeline({ staff, requirements, branches, departments, roles, isReadOnly = false, isPending = false }: Props) {
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || '')
  const [selectedDept, setSelectedDept] = useState('')
  const [savingReqId, setSavingReqId] = useState<string | null>(null)
  const [autoScheduleReq, setAutoScheduleReq] = useState<any>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [activeSlotMins, setActiveSlotMins] = useState<number | null>(null)

  const branch = branches.find(b => b.id === selectedBranch)
  
  const startMins = timeToMins(branch?.internalStartTime || '05:00')
  const endMins = timeToMins(branch?.internalEndTime || '23:00')
  let totalDuration = endMins - startMins
  if (totalDuration <= 0) totalDuration += 24 * 60

  // Generate hour markers
  const hours: { mins: number, label: string }[] = []
  for (let m = startMins; m <= startMins + totalDuration; m += 60) {
    let h = Math.floor(m / 60) % 24
    let ampm = h >= 12 ? 'PM' : 'AM'
    h = h % 12 || 12
    hours.push({ mins: m, label: `${h} ${ampm}` })
  }

  const handleSaveSchedules = async (req: any, positionIndex: number, shifts: Shift[]) => {
    setSavingReqId(req.id)
    const existingSchedules = req.schedules ? [...req.schedules] : []
    const scheduleIndex = existingSchedules.findIndex(s => s.positionIndex === positionIndex)
    
    if (scheduleIndex >= 0) {
      existingSchedules[scheduleIndex].shifts = shifts
    } else {
      existingSchedules.push({ positionIndex, shifts })
    }
    
    const result = await updateRequirementSchedules(req.id, existingSchedules)
    if (result && result.error) {
      alert("Error saving schedules: " + result.error)
    }
    setSavingReqId(null)
  }

  const handleAutoGenerate = async (req: any, generatedSchedules: PositionSchedule[]) => {
    setSavingReqId(req.id)
    const result = await updateRequirementSchedules(req.id, generatedSchedules)
    if (result && result.error) {
      alert("Error generating schedules: " + result.error)
    }
    setSavingReqId(null)
  }

  // Filter requirements
  const filteredReqs = useMemo(() => {
    return requirements.filter(r => 
      r.branchId === selectedBranch &&
      (!selectedDept || r.departmentId === selectedDept)
    )
  }, [requirements, selectedBranch, selectedDept])



  const groupedByRole = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const req of filteredReqs) {
      if (!map.has(req.roleId)) map.set(req.roleId, [])
      map.get(req.roleId)!.push(req)
    }
    return map
  }, [filteredReqs])

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#252033] p-4 rounded-xl border border-[#3b3054]">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Branch</label>
            <select 
              value={selectedBranch} 
              onChange={e => setSelectedBranch(e.target.value)}
              className="bg-[#131018] border border-[#3b3054] text-white text-sm rounded-lg px-3 py-1.5 focus:border-[#c084fc] outline-none"
            >
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">Department</label>
            <select 
              value={selectedDept} 
              onChange={e => setSelectedDept(e.target.value)}
              className="bg-[#131018] border border-[#3b3054] text-white text-sm rounded-lg px-3 py-1.5 focus:border-[#c084fc] outline-none"
            >
              <option value="">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
          {!isReadOnly && (
          <div className="flex items-center gap-3 bg-[#131018] p-2 px-4 rounded-xl border border-[#3b3054]">
            <span className="text-sm font-semibold text-slate-300">Edit Schedule</span>
            <button 
               onClick={() => setIsEditMode(!isEditMode)}
               className={`w-12 h-6 rounded-full relative transition-colors ${isEditMode ? 'bg-[#c084fc]' : 'bg-slate-700'}`}
            >
               <div className={`absolute top-1 bottom-1 w-4 bg-white rounded-full transition-all ${isEditMode ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
          )}
      </div>

      <div className="bg-[#1e1b2e] rounded-2xl border border-[#3b3054] shadow-xl overflow-hidden overflow-x-auto select-none">
        <div className="min-w-[800px]">
          {/* Header row (Hours) */}
          <div className="flex border-b border-[#3b3054] bg-[#131018] sticky top-0 z-10">
            <div className="w-48 shrink-0 p-4 border-r border-[#3b3054] font-bold text-slate-300 text-sm flex items-center justify-between">
              <span className="flex items-center gap-1.5 cursor-help" title="Shifts must fall between 05:00–23:00 and not exceed 10 hours total per position slot.">
                Role / Position <Info className="h-4 w-4 text-slate-500" />
              </span>
              {savingReqId && <Loader2 className="h-4 w-4 text-[#c084fc] animate-spin" />}
            </div>
            <div className="flex-1 relative h-12">
              {hours.map((h, i) => (
                <div 
                  key={i} 
                  onClick={() => setActiveSlotMins(h.mins)}
                  className="absolute top-0 bottom-0 border-l border-[#3b3054]/30 text-[10px] font-medium text-slate-500 pl-1 pt-1 cursor-pointer hover:bg-[#c084fc]/10 hover:text-[#c084fc] transition-colors"
                  style={{ left: `${((h.mins - startMins) / totalDuration) * 100}%`, right: i === hours.length - 1 ? 0 : `${100 - (((hours[i+1].mins - startMins) / totalDuration) * 100)}%` }}
                >
                  {h.label}
                </div>
              ))}
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-[#3b3054]/50">
            {Array.from(groupedByRole.entries()).map(([roleId, reqs]) => {
              const roleName = roles.find(r => r.id === roleId)?.name || roleId
              return reqs.map((req) => {
                const positions = Array.from({ length: req.requiredCount })
                
                return (
                  <div key={req.id} className="flex">
                    <div className="w-48 shrink-0 p-4 border-r border-[#3b3054] bg-[#1a1726] flex flex-col justify-center">
                      <h4 className="font-bold text-white text-sm">{roleName}</h4>
                      <p className="text-xs text-slate-500 mt-1 mb-3">{req.requiredCount} Positions</p>
                      {req.requiredCount > 0 && !isReadOnly && (
                        <button 
                          onClick={() => setAutoScheduleReq(req)}
                          className="w-full py-1.5 px-2 bg-[#252033] hover:bg-[#3b3054] text-[#c084fc] text-[10px] font-bold rounded flex items-center justify-center gap-1 transition-colors border border-[#3b3054]"
                        >
                          <Wand2 className="h-3 w-3" /> Auto-Schedule
                        </button>
                      )}
                      {(() => {
                        const scheduleCount = req.schedules ? req.schedules.length : 0
                        const scheduleMismatch = scheduleCount !== req.requiredCount && req.requiredCount > 0
                        return scheduleMismatch ? (
                          <p className="text-[9px] text-amber-400 mt-1.5 leading-tight bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-1">
                            ⚠ Schedules ({scheduleCount}) don't match positions ({req.requiredCount}). Click Auto-Schedule to regenerate.
                          </p>
                        ) : null
                      })()}
                    </div>
                    <div className="flex-1 relative bg-[#1e1b2e] flex flex-col justify-center">
                      {/* Hour grid lines */}
                      {hours.map((h, i) => (
                        <div 
                          key={i} 
                          className="absolute top-0 bottom-0 border-l border-[#3b3054]/20 pointer-events-none z-0"
                          style={{ left: `${((h.mins - startMins) / totalDuration) * 100}%` }}
                        />
                      ))}
                      
                      <div className="relative z-10">
                        {positions.map((_, idx) => (
                          <div key={idx} className="flex group/row">
                            <div className="absolute left-0 w-8 h-12 flex items-center justify-center text-[10px] font-bold text-slate-500 bg-[#1e1b2e] z-20 shadow-[2px_0_4px_rgba(0,0,0,0.2)]">
                              #{idx + 1}
                            </div>
                            <div className="flex-1 pl-8">
                              <PositionRow 
                                req={req}
                                positionIndex={idx}
                                startMins={startMins}
                                totalDuration={totalDuration}
                                isEditMode={isEditMode}
                                onSave={(shifts) => handleSaveSchedules(req, idx, shifts)}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })
            })}
            
            {filteredReqs.length === 0 && (
              <div className="p-8 text-center text-slate-500 text-sm italic">
                No configured positions found for the selected filters. Go to Open Positions to add some.
              </div>
            )}
          </div>
        </div>
      </div>

      <AutoScheduleModal 
        isOpen={!!autoScheduleReq}
        onClose={() => setAutoScheduleReq(null)}
        roleName={autoScheduleReq ? (roles.find(r => r.id === autoScheduleReq.roleId)?.name || autoScheduleReq.roleId) : ''}
        positionCount={autoScheduleReq?.requiredCount || 0}
        branchStartTime={branch?.internalStartTime || '05:00'}
        branchEndTime={branch?.internalEndTime || '23:00'}
        onGenerate={(schedules) => {
          if (autoScheduleReq) {
            handleAutoGenerate(autoScheduleReq, schedules)
            setAutoScheduleReq(null)
          }
        }}
      />

      {activeSlotMins !== null && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1e1b2e] rounded-2xl w-full max-w-md overflow-hidden border border-[#3b3054] shadow-2xl flex flex-col animate-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-[#3b3054] flex justify-between items-center bg-[#131018]">
              <h2 className="font-bold text-white text-lg">
                Working Staff at {Math.floor(activeSlotMins / 60) % 12 || 12} {Math.floor(activeSlotMins / 60) >= 12 ? 'PM' : 'AM'}
              </h2>
              <button onClick={() => setActiveSlotMins(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-4">
              {(() => {
                const slotStart = activeSlotMins;
                const slotEnd = activeSlotMins + 60;

                const isOverlapping = (start: number, end: number) => {
                  if (end < start) {
                    return (start < slotEnd && 1440 > slotStart) || (0 < slotEnd && end > slotStart);
                  }
                  return start < slotEnd && end > slotStart;
                };

                // 1. Group Working Staff
                const staffGrouped = new Map<string, any[]>();
                staff.forEach(s => {
                  if (s.branchId !== selectedBranch || s.deletedAt || s.isActive === false) return;
                  
                  let activeShifts: any[] = [];
                  let hasPositionSchedule = false;

                  if (s.positionId && s.positionIndex !== undefined) {
                    const req = filteredReqs.find(r => r.id === s.positionId);
                    if (req && req.schedules) {
                      const schedule = req.schedules.find((sch: any) => sch.positionIndex === s.positionIndex);
                      if (schedule && schedule.shifts && schedule.shifts.length > 0) {
                        activeShifts = schedule.shifts;
                        hasPositionSchedule = true;
                      }
                    }
                  }

                  let working = false;

                  if (hasPositionSchedule) {
                    // Check if any of their scheduled split shifts overlap
                    working = activeShifts.some(shift => isOverlapping(timeToMins(shift.start), timeToMins(shift.end)));
                  } else {
                    // Fall back to staff record times
                    let startMins = 0;
                    let endMins = 0;
                    if (s.startTime && s.endTime) {
                      startMins = timeToMins(s.startTime);
                      endMins = timeToMins(s.endTime);
                    } else {
                      const sType = (s.shiftType || 'full').toLowerCase();
                      if (sType === 'morning') { startMins = 6 * 60; endMins = 15 * 60; }
                      else if (sType === 'evening') { startMins = 15 * 60; endMins = 24 * 60; }
                      else { startMins = 9 * 60; endMins = 21 * 60; }
                    }
                    working = isOverlapping(startMins, endMins);
                  }

                  if (working) {
                    const roleName = roles.find(r => r.id === s.roleId)?.name || s.roleId;
                    if (!staffGrouped.has(roleName)) staffGrouped.set(roleName, []);
                    staffGrouped.get(roleName)!.push({ ...s, _timeSource: hasPositionSchedule ? 'schedule' : 'record' });
                  }
                });

                // 2. Group Required Positions
                const reqsGrouped = new Map<string, number>();
                filteredReqs.forEach(req => {
                  const roleName = roles.find(r => r.id === req.roleId)?.name || req.roleId;
                  let activePositions = 0;
                  
                  if (req.schedules) {
                    req.schedules.forEach((schedule: any) => {
                      const hasActiveShift = schedule.shifts.some((shift: any) => {
                         const sMins = timeToMins(shift.start);
                         const eMins = timeToMins(shift.end);
                         return isOverlapping(sMins, eMins);
                      });
                      if (hasActiveShift) activePositions++;
                    });
                  }
                  
                  if (activePositions > 0) {
                    reqsGrouped.set(roleName, (reqsGrouped.get(roleName) || 0) + activePositions);
                  }
                });

                const allRoles = Array.from(new Set([...staffGrouped.keys(), ...reqsGrouped.keys()]));

                if (allRoles.length === 0) {
                  return <p className="text-slate-400 text-sm text-center py-6">No staff or positions scheduled for this hour.</p>
                }

                return allRoles.map(role => {
                  const employees = staffGrouped.get(role) || [];
                  const assignedPositions = reqsGrouped.get(role) || 0;
                  const vacant = Math.max(0, assignedPositions - employees.length);
                  const extra = Math.max(0, employees.length - assignedPositions);
                  
                  const hourLabel = `${Math.floor(activeSlotMins / 60) % 12 || 12} ${Math.floor(activeSlotMins / 60) >= 12 ? 'PM' : 'AM'}`;

                  return (
                    <div key={role} className="bg-[#131018] rounded-xl border border-[#3b3054] p-3 mb-4 last:mb-0">
                      <div className="flex justify-between items-center mb-2 border-b border-[#3b3054]/50 pb-2">
                        <span className="font-bold text-[#c084fc] text-sm uppercase tracking-wide">{role}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-[#c084fc]/10 text-[#c084fc] px-2 py-0.5 rounded font-bold uppercase tracking-wider" title="Positions Assigned">
                            {assignedPositions} Req
                          </span>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded font-bold uppercase tracking-wider" title="Working Staff">
                            {employees.length} Staff
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-[11px] text-slate-400 mb-3 px-1 leading-relaxed">
                        {assignedPositions} position{assignedPositions !== 1 ? 's' : ''} assigned for {role.toLowerCase()} at {hourLabel} and staff count for that {role.toLowerCase()} role is {employees.length}.
                        {vacant > 0 && <span className="text-rose-400 ml-1 font-medium">({vacant} vacant)</span>}
                        {extra > 0 && <span className="text-amber-400 ml-1 font-medium">({extra} extra staff scheduled)</span>}
                      </div>

                      <div className="space-y-1">
                        {employees.map((e: any) => (
                          <div key={e.id} className="text-sm text-slate-300 font-medium flex items-center justify-between gap-2 px-1">
                            <div className="flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              {e.name}
                            </div>
                            <span className="text-[9px] uppercase tracking-wider text-slate-500 bg-slate-800/50 px-1.5 py-0.5 rounded border border-slate-700">
                              {e._timeSource === 'schedule' ? '📅 Position Schedule' : '🕐 Staff Record'}
                            </span>
                          </div>
                        ))}
                        {employees.length === 0 && (
                          <div className="text-xs text-slate-500 italic px-2">No staff assigned</div>
                        )}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
