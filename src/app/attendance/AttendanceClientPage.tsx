'use client'

import { useState, useEffect } from 'react'
import { Calendar as CalendarIcon, Store, ChevronLeft, ChevronRight, CheckCircle2, UserCheck, UserX, UserMinus, Lock } from 'lucide-react'
import { saveAttendance, getAttendanceByDate, AttendanceLog, AttendanceStatus } from '@/app/actions/attendance'
import { useDraft } from '@/lib/useDraft'

export default function AttendanceClientPage({ staff, branches, roles, userRole }: { staff: any[], branches: any[], roles: any[], userRole: string }) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [selectedBranch, setSelectedBranch] = useState(branches[0]?.id || '')
  const [logs, setLogs] = useState<Record<string, AttendanceLog>>({})
  const [saving, setSaving] = useState(false)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const { saveDraft, loadDraft, clearDraft } = useDraft('attendance')
  
  const activeStaff = staff.filter(s => s.isActive && (selectedBranch === '' || s.branchId === selectedBranch))

  const todayStr = new Date().toISOString().split('T')[0]
  const diffTime = Math.abs(new Date(todayStr).getTime() - new Date(date).getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  const isLocked = diffDays > 7 && userRole !== 'Admin' && userRole !== 'SuperAdmin' && userRole !== 'owner'

  useEffect(() => {
    loadAttendance()
  }, [date, selectedBranch])

  async function loadAttendance() {
    setLoadingInitial(true)
    const existing = await getAttendanceByDate(date, selectedBranch)
    const newLogs: Record<string, AttendanceLog> = {}
    existing.forEach(l => {
      newLogs[l.staffId] = l
    })

    const draft = loadDraft(`${selectedBranch}_${date}`)
    if (draft && Object.keys(draft).length > 0 && !isLocked) {
      if (window.confirm("You have an unsaved draft for this date and branch. Restore it?")) {
        setLogs(draft)
        setLoadingInitial(false)
        return
      } else {
        clearDraft(`${selectedBranch}_${date}`)
      }
    }

    setLogs(newLogs)
    setLoadingInitial(false)
  }

  useEffect(() => {
    if (!loadingInitial && !isLocked && selectedBranch && date && Object.keys(logs).length > 0) {
      saveDraft(`${selectedBranch}_${date}`, logs)
    }
  }, [logs, isLocked, selectedBranch, date, loadingInitial, saveDraft])

  function handleStatusChange(staffId: string, status: AttendanceStatus) {
    setLogs(prev => ({
      ...prev,
      [staffId]: {
        ...prev[staffId],
        id: prev[staffId]?.id || '',
        date,
        staffId,
        branchId: selectedBranch,
        status,
        shiftsWorked: prev[staffId]?.shiftsWorked || [staff.find(s => s.id === staffId)?.shiftType || 'Full Day'],
        updatedAt: new Date().toISOString()
      }
    }))
  }

  function handleShiftToggle(staffId: string, shift: string, defaultShift: string) {
    setLogs(prev => {
       const current = prev[staffId] || { 
         id: '', date, staffId, branchId: selectedBranch, status: 'present' as AttendanceStatus, 
         shiftsWorked: [defaultShift], updatedAt: new Date().toISOString() 
       }
       let shifts = current.shiftsWorked || [defaultShift]
       if (shifts.includes(shift)) {
         shifts = shifts.filter(s => s !== shift)
       } else {
         shifts = [...shifts, shift]
       }
       
       return { 
         ...prev, 
         [staffId]: { ...current, shiftsWorked: shifts, updatedAt: new Date().toISOString() } 
       }
    })
  }

  function handleMarkAll(status: AttendanceStatus) {
    const newLogs = { ...logs }
    activeStaff.forEach(s => {
      newLogs[s.id] = {
        id: logs[s.id]?.id || '',
        date,
        staffId: s.id,
        branchId: selectedBranch,
        status,
        shiftsWorked: logs[s.id]?.shiftsWorked || [s.shiftType || 'Full Day'],
        updatedAt: new Date().toISOString()
      }
    })
    setLogs(newLogs)
  }

  async function onSave() {
    if (isLocked) return;
    setSaving(true)
    const logsArray = Object.values(logs).filter(l => Boolean(l.status) && l.status !== 'unmarked')
    
    try {
        const res = await saveAttendance(logsArray)
        if (res.error) {
            alert(res.error)
        } else {
            clearDraft(`${selectedBranch}_${date}`)
            alert("Saved successfully!")
        }
    } catch (e: any) {
        alert(e.message || "Failed to save")
    }
    
    setSaving(false)
  }

  function changeDate(days: number) {
    const d = new Date(date)
    d.setDate(d.getDate() + days)
    setDate(d.toISOString().split('T')[0])
  }

  const getRoleName = (roleId: string) => roles.find((r: any) => r.id === roleId)?.name || 'Unknown'
  
  const totals = {
    present: activeStaff.filter(s => logs[s.id]?.status === 'present').length,
    absent: activeStaff.filter(s => logs[s.id]?.status === 'absent').length,
    halfDay: activeStaff.filter(s => logs[s.id]?.status === 'half-day').length,
    unmarked: activeStaff.filter(s => !logs[s.id] || logs[s.id]?.status === 'unmarked').length
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Daily Attendance</h1>
          <p className="text-slate-400 mt-2">Mark who is present today</p>
        </div>
        
        <div className="flex bg-card border border-white/10 rounded-xl p-2 items-center gap-4">
          <button onClick={() => changeDate(-1)} className="p-2 hover:bg-white/5 rounded-lg"><ChevronLeft size={20}/></button>
          <div className="flex items-center gap-2 font-medium text-slate-200">
            <CalendarIcon size={18} className="text-primary"/>
            {new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <button onClick={() => changeDate(1)} className="p-2 hover:bg-white/5 rounded-lg"><ChevronRight size={20}/></button>
        </div>
      </div>

      <div className="flex items-center gap-4">
          <div className="flex relative items-center">
            <Store className="w-5 h-5 absolute left-3 text-slate-400" />
            <select
              title="Select Branch"
              className="pl-10 pr-10 py-2 bg-[#1e1b2e] border border-[#3b3054] rounded-xl text-sm focus:border-[#c084fc] focus:outline-none focus:ring-0 cursor-pointer text-slate-200"
              value={selectedBranch}
              onChange={e => setSelectedBranch(e.target.value)}
            >
              <option value="">All Branches (Readonly view)</option>
              {branches.map((b: any) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          {selectedBranch !== "" && !isLocked && (
             <div className="flex gap-2">
               <button onClick={() => handleMarkAll('present')} className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-emerald-500/20 flex items-center gap-2"><CheckCircle2 size={16}/> Mark All Present</button>
               <button onClick={() => handleMarkAll('holiday')} className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-amber-500/20">Mark Holiday</button>
             </div>
          )}
          {isLocked && (
             <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl text-sm font-semibold text-red-400">
               <Lock size={16} /> Locked (Older than 7 days)
             </div>
          )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
         <div className="bg-card border border-white/5 rounded-xl p-4 flex flex-col items-center">
            <span className="text-slate-400 text-sm mb-1">Present</span>
            <span className="text-3xl font-bold text-emerald-400">{totals.present}</span>
         </div>
         <div className="bg-card border border-white/5 rounded-xl p-4 flex flex-col items-center">
            <span className="text-slate-400 text-sm mb-1">Absent</span>
            <span className="text-3xl font-bold text-red-400">{totals.absent}</span>
         </div>
         <div className="bg-card border border-white/5 rounded-xl p-4 flex flex-col items-center">
            <span className="text-slate-400 text-sm mb-1">Half Day</span>
            <span className="text-3xl font-bold text-amber-400">{totals.halfDay}</span>
         </div>
         <div className="bg-card border border-white/5 rounded-xl p-4 flex flex-col items-center">
            <span className="text-slate-400 text-sm mb-1">Unmarked</span>
            <span className="text-3xl font-bold text-slate-400">{totals.unmarked}</span>
         </div>
      </div>

      <div className="bg-card border border-white/5 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/5 bg-white/5">
              <th className="p-4 font-medium text-slate-300">Staff Member</th>
              <th className="p-4 font-medium text-slate-300">Role</th>
              <th className="p-4 font-medium text-slate-300">Shift Type Log</th>
              <th className="p-4 font-medium text-slate-300 text-right">Attendance Status</th>
            </tr>
          </thead>
          <tbody>
            {activeStaff.length === 0 ? (
              <tr><td colSpan={3} className="p-8 text-center text-slate-500">No active staff found for this branch.</td></tr>
            ) : activeStaff.map(s => {
              const status = logs[s.id]?.status || 'unmarked';
              return (
                <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4 font-medium text-slate-200">{s.name}</td>
                  <td className="p-4 text-slate-400 text-sm">{getRoleName(s.roleId)}</td>
                  <td className="p-4">
                    <div className="flex gap-1.5 flex-wrap">
                      {['Morning', 'Evening', 'Full Day'].map(sh => {
                         const currentShifts = logs[s.id]?.shiftsWorked || [s.shiftType || 'Full Day']
                         const isActive = currentShifts.includes(sh)
                         return (
                           <button 
                             key={sh}
                             disabled={isLocked}
                             onClick={() => handleShiftToggle(s.id, sh, s.shiftType || 'Full Day')}
                             className={`px-2 py-1 text-[10px] rounded uppercase font-bold border transition-colors ${isActive ? 'bg-[#c084fc]/10 text-[#c084fc] border-[#c084fc]/30' : 'bg-transparent text-slate-500 border-white/10'} ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/20'}`}
                           >
                             {sh}
                           </button>
                         )
                      })}
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1 sm:gap-2">
                       <button disabled={isLocked} onClick={() => handleStatusChange(s.id, 'present')} className={`p-1.5 sm:p-2 rounded-lg flex items-center gap-1 text-xs sm:text-sm font-medium transition-colors ${status === 'present' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'} ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'}`}><UserCheck size={14}/> <span className="hidden sm:inline">Present</span><span className="sm:hidden">P</span></button>
                       <button disabled={isLocked} onClick={() => handleStatusChange(s.id, 'half-day')} className={`p-1.5 sm:p-2 rounded-lg flex items-center gap-1 text-xs sm:text-sm font-medium transition-colors ${status === 'half-day' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-400'} ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'}`}><UserMinus size={14}/> <span className="hidden sm:inline">Half Day</span><span className="sm:hidden">HD</span></button>
                       <button disabled={isLocked} onClick={() => handleStatusChange(s.id, 'absent')} className={`p-1.5 sm:p-2 rounded-lg flex items-center gap-1 text-xs sm:text-sm font-medium transition-colors ${status === 'absent' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400'} ${isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-700'}`}><UserX size={14}/> <span className="hidden sm:inline">Absent</span><span className="sm:hidden">A</span></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/80 backdrop-blur-md border-t border-white/10 flex justify-end md:pl-72 z-40">
         <button 
           disabled={selectedBranch === '' || saving || isLocked}
           onClick={onSave}
           className="bg-primary hover:bg-primary/90 text-white font-medium py-2.5 px-8 rounded-xl shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
         >
           {saving ? "Saving..." : "Save Attendance"}
         </button>
      </div>

    </div>
  )
}
