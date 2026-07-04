"use client"

import { useState } from 'react'
import { X, Wand2, Plus, Trash2 } from 'lucide-react'
import { Shift, PositionSchedule } from '@/app/actions/staff_requirements'
import { generateSchedules } from '@/lib/scheduleGenerator'

type Props = {
  isOpen: boolean
  onClose: () => void
  roleName: string
  positionCount: number
  branchStartTime: string
  branchEndTime: string
  onGenerate: (generatedSchedules: PositionSchedule[]) => void
}



export function AutoScheduleModal({ isOpen, onClose, roleName, positionCount, branchStartTime, branchEndTime, onGenerate }: Props) {
  const [maxHours, setMaxHours] = useState(10)
  const [minSegmentHours, setMinSegmentHours] = useState(2)
  const [maxBreaks, setMaxBreaks] = useState(2)
  
  // Custom Peak Hours
  const [peakPeriods, setPeakPeriods] = useState([
    { id: 1, start: '08:00', end: '10:00', label: 'Breakfast Rush' },
    { id: 2, start: '12:00', end: '15:00', label: 'Lunch Rush' },
    { id: 3, start: '19:00', end: '22:00', label: 'Dinner Rush' }
  ])

  if (!isOpen) return null

  const handleAddPeak = () => {
    setPeakPeriods([...peakPeriods, { id: Date.now(), start: '12:00', end: '14:00', label: 'Custom Peak' }])
  }

  const handleRemovePeak = (id: number) => {
    setPeakPeriods(peakPeriods.filter(p => p.id !== id))
  }

  const updatePeak = (id: number, field: string, value: string) => {
    setPeakPeriods(peakPeriods.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const handleGenerate = () => {
    const schedules = generateSchedules({
      positionCount,
      branchStartTime,
      branchEndTime,
      maxHours,
      minSegmentHours,
      maxBreaks
    });

    onGenerate(schedules)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[110]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="relative w-full max-w-xl flex flex-col bg-[#1e1b2e] rounded-2xl border border-[#3b3054] shadow-2xl overflow-hidden pointer-events-auto max-h-[90vh]">
          <div className="flex items-center justify-between p-6 border-b border-[#3b3054]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#c084fc]/10 text-[#c084fc] rounded-lg">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Auto-Schedule Generator</h2>
                <p className="text-xs text-slate-400">Configuring baseline for: <strong className="text-white">{roleName}</strong> ({positionCount} positions)</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-[#252033] rounded-lg text-slate-400 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Max Work Hours / Position</label>
                <input 
                  type="number" 
                  value={maxHours}
                  onChange={e => setMaxHours(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Min Segment Duration (hrs)</label>
                <input 
                  type="number" 
                  value={minSegmentHours}
                  onChange={e => setMinSegmentHours(Number(e.target.value))}
                  min={1}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Max Breaks (Split Shifts)</label>
                <select 
                  value={maxBreaks}
                  onChange={e => setMaxBreaks(Number(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#131018] border border-[#3b3054] text-white focus:border-[#c084fc] outline-none"
                >
                  <option value={0}>0 Breaks (Straight Shift)</option>
                  <option value={1}>1 Break (2 Segments)</option>
                  <option value={2}>2 Breaks (3 Segments)</option>
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-slate-400">Target Peak Hours</label>
                <button onClick={handleAddPeak} className="text-[#c084fc] text-xs font-bold hover:underline flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Add Peak
                </button>
              </div>
              
              <div className="space-y-3">
                {peakPeriods.map(peak => (
                  <div key={peak.id} className="flex items-center gap-3 bg-[#131018] p-3 rounded-xl border border-[#3b3054]">
                    <input 
                      type="text" 
                      value={peak.label}
                      onChange={e => updatePeak(peak.id, 'label', e.target.value)}
                      className="flex-1 bg-transparent text-sm text-white border-b border-transparent focus:border-[#c084fc] outline-none" 
                    />
                    <input 
                      type="time" 
                      value={peak.start}
                      onChange={e => updatePeak(peak.id, 'start', e.target.value)}
                      className="w-24 bg-transparent text-sm text-white outline-none" 
                    />
                    <span className="text-slate-500">to</span>
                    <input 
                      type="time" 
                      value={peak.end}
                      onChange={e => updatePeak(peak.id, 'end', e.target.value)}
                      className="w-24 bg-transparent text-sm text-white outline-none" 
                    />
                    <button onClick={() => handleRemovePeak(peak.id)} className="p-1 text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2 italic">
                * The generator will attempt to maximize coverage density during these defined time blocks.
              </p>
            </div>
          </div>

          <div className="p-6 border-t border-[#3b3054] bg-[#1a1726]">
            <button 
              onClick={handleGenerate}
              className="w-full py-3 bg-gradient-to-r from-[#c084fc] to-[#a855f7] text-white font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-lg"
            >
              <Wand2 className="h-5 w-5" />
              Generate Optimal Baseline
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
