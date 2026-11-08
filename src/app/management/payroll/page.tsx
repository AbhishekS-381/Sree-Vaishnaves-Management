import {
  db,
  staff as staffTable,
  payroll as payrollTable,
  attendance as attendanceTable,
} from '@/lib/db'
import { eq, and, isNull } from 'drizzle-orm'
import PayrollClientPage from './PayrollClientPage'
import { getSession } from '@/app/actions/auth'

export default async function PayrollPage() {
  const session = await getSession()
  const isGlobal = session?.isGlobalAdmin || session?.role === 'readonly'
  const branchId = session?.branchId

  try {
    const [staff, payroll, attendance] = await Promise.all([
      db
        .select()
        .from(staffTable)
        .where(
          and(
            !isGlobal && branchId ? eq(staffTable.branchId, branchId) : undefined,
            eq(staffTable.isActive, true),
            isNull(staffTable.deletedAt)
          )
        )
        .catch(() => []),
      (!isGlobal && branchId
        ? db.select().from(payrollTable).where(eq(payrollTable.branchId, branchId))
        : db.select().from(payrollTable)
      ).catch(() => []),
      (!isGlobal && branchId
        ? db.select().from(attendanceTable).where(eq(attendanceTable.branchId, branchId))
        : db.select().from(attendanceTable)
      ).catch(() => []),
    ])

    return (
      <PayrollClientPage
        staff={Array.isArray(staff) ? staff : []}
        savedRecords={Array.isArray(payroll) ? payroll : []}
        attendanceLogs={Array.isArray(attendance) ? attendance : []}
      />
    )
  } catch (error) {
    console.error('Critical Error in Payroll Page:', error)
    return <div className="p-10 text-red-500 font-bold">Error loading data. See server logs.</div>
  }
}
