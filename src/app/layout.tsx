import type { Metadata } from 'next'
import './globals.css'
import { Navigation } from '@/components/Navigation'
import { getSession } from './actions/auth'
import { readJSON, DB_FILES } from '@/lib/db'

export const metadata: Metadata = {
  title: 'Restaurant Manager',
  description: 'Manage branches, staff and daily tally',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  const role = session?.role
  const isGlobalOwner = session?.isGlobalOwner
  
  let configList = await readJSON<any>(DB_FILES.CONFIG).catch(() => [])
  let config = configList[0] || {
    attendance: true,
    payroll: true,
    vendors: true,
    inventory: true,
    menu: true,
    reports: true
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`font-sans bg-slate-50 text-slate-900`}>
        {role ? (
          <div className="flex h-screen overflow-hidden">
            <Navigation role={role} config={config}  />
            <main className="flex-1 overflow-y-auto w-full pt-16 md:pt-0">
              <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto min-h-full">
                {children}
              </div>
            </main>
          </div>
        ) : (
          <main className="h-screen w-full">
            {children}
          </main>
        )}
      </body>
    </html>
  )
}
