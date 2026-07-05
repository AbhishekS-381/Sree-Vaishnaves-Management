"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Store, Users, FileText, Settings, Menu, X, LogOut, Shield, Package, Truck, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { logout } from '@/app/actions/auth'

const navItems = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Menu', href: '/menu', icon: FileText },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Vendors', href: '/vendors', icon: Truck },
  { name: 'EOD Entry', href: '/eod', icon: Store },
  { name: 'Expenses', href: '/expenses', icon: FileText },
  { name: 'Attendance', href: '/attendance', icon: Users },
  { name: 'Payroll', href: '/payroll', icon: FileText },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Staff', href: '/staff', icon: Users },    
  { name: 'Branches', href: '/branches', icon: Store },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Navigation({ role, config }: { role: string, config: any }) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const isGlobalAdmin = role === 'owner' || role === 'admin'
  const isBranchManager = !isGlobalAdmin

  return (
    <>
      {/* Mobile Toggle Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <span className="font-bold text-lg text-accent">Sree Vaishnaves</span>
        <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-slate-600">
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-[#13101c] border-r border-[#2d2438] text-slate-300 transform transition-transform duration-300 ease-in-out md:translate-x-0 md:static md:inset-auto",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          {/* Brand */}
          <div className="p-6 md:p-8">
            <h1 className="text-2xl font-bold bg-gradient-to-br from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              Sree Vaishnaves
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                {isBranchManager ? 'Manager Portal' : 'Admin Portal'}
              </p>
              {isBranchManager && <Shield className="h-3 w-3 text-emerald-500" />}
            </div>
          </div>

          {/* Nav Items */}
          <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => {
              if (item.name === 'Menu' && config?.menu === false) return null;
              if (item.name === 'Inventory' && config?.inventory === false) return null;
              if (item.name === 'Vendors' && config?.vendors === false) return null;
              if (item.name === 'Attendance' && config?.attendance === false) return null;
              if (item.name === 'Payroll' && config?.payroll === false) return null;
              if (item.name === 'Reports' && config?.reports === false) return null;
              if ((item.name === 'Branches' || item.name === 'Settings') && !isGlobalAdmin) return null;

              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-200 group",
                    isActive
                      ? "bg-primary/20 text-accent border border-primary/30 shadow-[0_0_15px_rgba(192,132,252,0.15)]"
                      : "hover:bg-white/5 hover:text-white"
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className={cn(
                    "h-5 w-5 transition-colors",
                    isActive ? "text-accent" : "text-slate-500 group-hover:text-white"
                  )} />
                  <span className="font-medium text-sm tracking-wide">{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {/* User Profile */}
          <div className="p-4 border-t border-slate-800 m-4 rounded-2xl bg-slate-900/50">
            <div className="flex items-center gap-3 mb-3">
              <div className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center text-white shadow-md",
                isBranchManager ? "bg-emerald-600" : "bg-primary"
              )}>
                <span className="font-bold text-sm">{isBranchManager ? 'MA' : 'AD'}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {role === 'owner' ? 'Owner' : role === 'admin' ? 'Admin' : 'Manager'}
                </p>
                <p className="text-xs text-slate-400 capitalize">{isBranchManager ? 'Restricted Access' : 'Full Access'}</p>
              </div>
            </div>

            <button
              onClick={() => logout()}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <LogOut className="h-3 w-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
