import { Navigation } from '@/components/Navigation'
import { getSession } from '@/app/actions/auth'
import { readJSON, DB_FILES } from '@/lib/db'

import { headers } from 'next/headers'

export default async function ManagementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  const role = session?.role
  const isGlobalOwner = session?.isGlobalOwner
  const isRootAdmin = session?.isRootAdmin
  const userName = session?.name || ''

  let configList = await readJSON<any>(DB_FILES.CONFIG).catch(() => [])
  let config = configList[0] || {
    attendance: true,
    payroll: true,
    vendors: true,
    inventory: true,
    menu: true,
    reports: true,
  }

  const headerList = await headers().catch(() => null)
  const pathname = headerList?.get('x-pathname') || ''
  const isPosRoute = pathname.startsWith('/management/pos')

  // POS-dedicated roles (billing/kitchen/waiter) and POS station routes see full-screen station — no sidebar
  if (session?.posRole || isPosRoute) {
    return (
      <main className="h-screen w-full overflow-y-auto">
        {children}
      </main>
    )
  }

  return (
    <>
      {role ? (
        <div className="flex h-screen overflow-hidden">
          <Navigation
            role={role}
            isGlobalOwner={!!isGlobalOwner}
            isRootAdmin={!!isRootAdmin}
            userName={userName}
            config={config}
          />
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
    </>
  )
}
