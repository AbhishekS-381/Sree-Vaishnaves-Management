"use client"

import { useMemo } from "react"
import { Users, UserCheck, UserX, IndianRupee } from "lucide-react"
import { computePositionsSummary, type RequirementLike, type StaffLike } from "@/lib/positionsSummary"

type Props = {
  requirements: RequirementLike[]
  staff: StaffLike[]
}

const cards = [
  {
    key: "totalPositions" as const,
    label: "Total Positions",
    icon: Users,
    color: "bg-purple-500/10 text-purple-300 border-purple-500/20",
    glow: "shadow-purple-500/5",
    format: (v: number) => v.toString(),
  },
  {
    key: "filledPositions" as const,
    label: "Filled",
    icon: UserCheck,
    color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
    glow: "shadow-emerald-500/5",
    format: (v: number) => v.toString(),
  },
  {
    key: "vacantPositions" as const,
    label: "Vacant",
    icon: UserX,
    color: "bg-rose-500/10 text-rose-300 border-rose-500/20",
    glow: "shadow-rose-500/5",
    format: (v: number) => v.toString(),
  },
  {
    key: "totalSalary" as const,
    label: "Total Salary Budget",
    icon: IndianRupee,
    color: "bg-amber-500/10 text-amber-300 border-amber-500/20",
    glow: "shadow-amber-500/5",
    format: (v: number) => `₹${v.toLocaleString("en-IN")}`,
  },
] as const

export function PositionsSummaryCards({ requirements, staff }: Props) {
  const summary = useMemo(
    () => computePositionsSummary(requirements, staff),
    [requirements, staff]
  )

  return (
    <div
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      data-testid="positions-summary"
    >
      {cards.map(({ key, label, icon: Icon, color, glow, format }) => (
        <div
          key={key}
          className={`relative overflow-hidden bg-card p-5 rounded-2xl border border-card shadow-lg ${glow} hover:border-primary/30 transition-all duration-300 group`}
        >
          {/* Subtle gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">
                {label}
              </p>
              <p
                className="text-2xl font-bold text-white mt-1.5 tabular-nums"
                data-testid={`summary-${key}`}
              >
                {format(summary[key])}
              </p>
            </div>
            <div
              className={`p-2.5 rounded-xl border ${color} transition-transform duration-300 group-hover:scale-110`}
            >
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
