"use client"

import { useState, useMemo, useRef, useEffect } from 'react'
import { updateRequirementSchedules, Shift, PositionSchedule } from '@/app/actions/staff_requirements'
import { X, Save, Loader2, Wand2 } from 'lucide-react'
import { AutoScheduleModal } from './AutoScheduleModal'
import { generateSchedules } from '@/lib/scheduleGenerator'

type Props = {
  staff: any[]
  requirements: any[]
  branches: any[]
  departments: any[]
  roles: any[]
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
  onSave 
}: { 
  req: any, positionIndex: number, startMins: number, totalDuration: number, onSave: (s: Shift[]) => void 
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
      className="relative h-12 w-full group border-b border-[#3b3054]/30 last:border-0 hover:bg-white/[0.02] cursor-crosshair touch-none"
      onPointerDown={(e) => handlePointerDown(e, 'create')}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {shifts.map(s => (
        <div 
          key={s.id} 
          className="absolute h-8 top-2 rounded bg-gradient-to-r from-[#c084fc] to-[#a855f7] shadow-md flex items-center group/shift transition-all"
          style={getStyle(s.start, s.end)}
          onPointerDown={e => e.stopPropagation()} // Prevent create when clicking inside block
        >
          {/* Resize handle left */}
          <div 
            className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 rounded-l"
            onPointerDown={e => handlePointerDown(e, 'resize-start', s.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
          
          <span className="px-2 text-[10px] font-bold text-white truncate pointer-events-none select-none">
            {formatTime(s.start)} - {formatTime(s.end)}
          </span>
          
          <button 
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 bg-black/20 hover:bg-black/40 rounded-full opacity-0 group-hover/shift:opacity-100 transition-opacity"
            onClick={(e) => removeShift(e, s.id)}
          >
            <X className="h-3 w-3 text-white" />
          </button>

          {/* Resize handle right */}
          <div 
            className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-white/20 rounded-r"
            onPointerDown={e => handlePointerDown(e, 'resize-end', s.id)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>
      ))}
    </div>
  )
}

export function ScheduleTimeline({ requirements, branches, departments, roles }: Props) {
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || '')
  const [selectedDept, setSelectedDept] = useState('')
  const [savingReqId, setSavingReqId] = useState<string | null>(null)
  const [autoScheduleReq, setAutoScheduleReq] = useState<any>(null)

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

  const attemptedAutoGenerations = useRef(new Set<string>())

  // Internal Auto-Trigger for mismatching position counts
  useEffect(() => {
    filteredReqs.forEach(req => {
      const currentSchedulesCount = req.schedules ? req.schedules.length : 0
      const attemptKey = `${req.id}-${req.requiredCount}`
      if (req.requiredCount > 0 && currentSchedulesCount !== req.requiredCount && !savingReqId && !attemptedAutoGenerations.current.has(attemptKey)) {
        attemptedAutoGenerations.current.add(attemptKey)
        // Automatically generate with default baseline params if count changed
        const generated = generateSchedules({
          positionCount: req.requiredCount,
          branchStartTime: branch?.internalStartTime || '05:00',
          branchEndTime: branch?.internalEndTime || '23:00',
          maxHours: 10,
          minSegmentHours: 2,
          maxBreaks: 2
        })
        handleAutoGenerate(req, generated)
      }
    })
  }, [filteredReqs, branch, savingReqId])

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
      <div className="flex items-center gap-4 bg-[#252033] p-4 rounded-xl border border-[#3b3054]">
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

      <div className="bg-[#1e1b2e] rounded-2xl border border-[#3b3054] shadow-xl overflow-hidden overflow-x-auto select-none">
        <div className="min-w-[800px]">
          {/* Header row (Hours) */}
          <div className="flex border-b border-[#3b3054] bg-[#131018] sticky top-0 z-10">
            <div className="w-48 shrink-0 p-4 border-r border-[#3b3054] font-bold text-slate-300 text-sm flex items-center justify-between">
              Role / Position
              {savingReqId && <Loader2 className="h-4 w-4 text-[#c084fc] animate-spin" />}
            </div>
            <div className="flex-1 relative h-12">
              {hours.map((h, i) => (
                <div 
                  key={i} 
                  className="absolute top-0 bottom-0 border-l border-[#3b3054]/30 text-[10px] font-medium text-slate-500 pl-1 pt-1"
                  style={{ left: `${((h.mins - startMins) / totalDuration) * 100}%` }}
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
                      {req.requiredCount > 0 && (
                        <button 
                          onClick={() => setAutoScheduleReq(req)}
                          className="w-full py-1.5 px-2 bg-[#252033] hover:bg-[#3b3054] text-[#c084fc] text-[10px] font-bold rounded flex items-center justify-center gap-1 transition-colors border border-[#3b3054]"
                        >
                          <Wand2 className="h-3 w-3" /> Auto-Schedule
                        </button>
                      )}
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
          }
        }}
      />
    </div>
  )
}
