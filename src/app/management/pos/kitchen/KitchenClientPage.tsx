'use client'

import React, { useState, useEffect, useTransition } from 'react'
import {
  Flame,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react'
import { useToast, ToastStack } from '@/components/Toast'
import { advanceKotStatus, getKitchenKots } from '@/app/actions/pos'

type KitchenKot = {
  id: string
  orderId: string
  kotNumber: number
  items: {
    nameSnapshot: string
    quantity: number
    note?: string
  }[]
  status: string
  firedAt: string
  orderIdentifier: string
  orderType?: string
}

export default function KitchenClientPage({
  branchId,
  initialActiveKots,
  initialServedKots,
  session,
}: {
  branchId: string
  initialActiveKots: KitchenKot[]
  initialServedKots: KitchenKot[]
  session: { userId: string; name: string; role: string; isGlobalAdmin?: boolean }
}) {
  const { messages, dismiss, success, error } = useToast()
  const [isPending, startTransition] = useTransition()

  const [activeKots, setActiveKots] = useState<KitchenKot[]>(initialActiveKots)
  const [servedKots, setServedKots] = useState<KitchenKot[]>(initialServedKots)
  const [isServedExpanded, setIsServedExpanded] = useState(false)
  const [isPollingActive, setIsPollingActive] = useState(true)

  // Polling: refresh active KOTs every 30 seconds (Req 15.8)
  useEffect(() => {
    if (!isPollingActive) return

    const interval = setInterval(async () => {
      const res = await getKitchenKots(branchId)
      if ('kots' in res && res.kots) {
        setActiveKots(res.kots)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [branchId, isPollingActive])

  const handleManualRefresh = async () => {
    startTransition(async () => {
      const res = await getKitchenKots(branchId)
      if ('kots' in res && res.kots) {
        setActiveKots(res.kots)
        success('Tickets refreshed')
      } else if ('error' in res && res.error) {
        error(res.error)
      }
    })
  }

  const handleAdvanceStatus = (kot: KitchenKot) => {
    startTransition(async () => {
      const res = await advanceKotStatus(kot.id)
      if (res?.error) {
        error(res.error)
      } else {
        // Optimistically advance local status
        if (kot.status === 'pending') {
          setActiveKots(prev =>
            prev.map(k => (k.id === kot.id ? { ...k, status: 'preparing' } : k))
          )
        } else if (kot.status === 'preparing') {
          setActiveKots(prev =>
            prev.map(k => (k.id === kot.id ? { ...k, status: 'ready' } : k))
          )
        } else if (kot.status === 'ready') {
          // Move from active to served immediately (Req 15.5)
          setActiveKots(prev => prev.filter(k => k.id !== kot.id))
          setServedKots(prev => [{ ...kot, status: 'served' }, ...prev])
        }
        success(`Ticket #${kot.kotNumber} updated`)
      }
    })
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 gap-6">
      <ToastStack messages={messages} onDismiss={dismiss} />

      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-500/10 border border-orange-500/30 rounded-xl text-orange-400">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Kitchen Display System (KDS)
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/30 font-semibold">
                Live FIFO
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Kitchen Staff: {session.name} ({session.role}) &bull; Auto-refreshing every 30s
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPollingActive(!isPollingActive)}
            className={`flex items-center gap-1.5 px-3 py-2 border text-sm font-semibold rounded-xl transition-all ${
              isPollingActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            {isPollingActive ? 'Poll: 30s' : 'Poll: Paused'}
          </button>

          <button
            onClick={handleManualRefresh}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${isPending ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => setIsServedExpanded(!isServedExpanded)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-sm font-semibold rounded-xl transition-all"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Served ({servedKots.length})
            {isServedExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Served Tickets Collapsible Section (Req 15.5) */}
      {isServedExpanded && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
            Completed / Served Tickets Today ({servedKots.length})
          </h2>
          {servedKots.length === 0 ? (
            <p className="text-xs text-slate-500 py-3 text-center">No served tickets yet today.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {servedKots.map(kot => (
                <div
                  key={kot.id}
                  className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-xs flex flex-col gap-1.5 opacity-70"
                >
                  <div className="flex justify-between items-center font-bold text-slate-300">
                    <span>{kot.orderIdentifier}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                      KOT #{kot.kotNumber}
                    </span>
                  </div>
                  <ul className="text-slate-400 pl-2 list-disc list-inside">
                    {kot.items.map((it, idx) => (
                      <li key={idx}>
                        {it.quantity} &times; {it.nameSnapshot}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active KOTs Grid (FIFO sorted) */}
      {activeKots.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center min-h-[400px]">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white mb-1">Kitchen All Clear!</h2>
          <p className="text-xs text-slate-400 max-w-sm">
            No active pending or preparing kitchen tickets. New orders will appear here automatically in FIFO order.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {activeKots.map(kot => {
            const firedTime = new Date(kot.firedAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })

            const statusColor =
              kot.status === 'pending'
                ? 'border-orange-500/40 bg-orange-950/10'
                : kot.status === 'preparing'
                ? 'border-yellow-500/40 bg-yellow-950/10'
                : 'border-emerald-500/40 bg-emerald-950/10'

            const chipColor =
              kot.status === 'pending'
                ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                : kot.status === 'preparing'
                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'

            const buttonLabel =
              kot.status === 'pending'
                ? 'Start Preparing'
                : kot.status === 'preparing'
                ? 'Mark Ready'
                : 'Mark Served'

            const buttonColor =
              kot.status === 'pending'
                ? 'bg-yellow-600 hover:bg-yellow-500 text-slate-950 font-bold'
                : kot.status === 'preparing'
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-bold'
                : 'bg-blue-600 hover:bg-blue-500 text-white font-bold'

            return (
              <div
                key={kot.id}
                className={`flex flex-col justify-between rounded-2xl border p-4 shadow-xl transition-all ${statusColor}`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between pb-3 border-b border-slate-800">
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tight">
                        {kot.orderIdentifier}
                      </h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        Fired at {firedTime}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs font-black text-slate-300 bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700">
                        KOT #{kot.kotNumber}
                      </span>
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${chipColor}`}
                      >
                        {kot.status}
                      </span>
                    </div>
                  </div>

                  {/* Items list */}
                  <div className="flex flex-col gap-2.5 py-4">
                    {kot.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-start justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80"
                      >
                        <div className="flex-1 pr-2">
                          <p className="text-sm font-bold text-white leading-snug">
                            {item.nameSnapshot}
                          </p>
                          {item.note && (
                            <p className="text-xs italic text-amber-300 font-medium mt-0.5">
                              &ldquo;{item.note}&rdquo;
                            </p>
                          )}
                        </div>
                        <span className="text-base font-black text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-lg border border-amber-500/30">
                          &times;{item.quantity}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Single Prominent Status Advance Button (Req 15.4) */}
                <button
                  onClick={() => handleAdvanceStatus(kot)}
                  disabled={isPending}
                  className={`w-full py-3 px-4 rounded-xl text-sm transition-all shadow-md ${buttonColor}`}
                >
                  {buttonLabel}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
