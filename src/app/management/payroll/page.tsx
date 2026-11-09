import {
  db,
  staff as staffTable,
  payroll as payrollTable,
  attendance as attendanceTable,
} from '@/lib/db'
import { eq, and, isNull, gte } from 'drizzle-orm'
import PayrollClientPage from './PayrollClientPage'
import { getSession } from '@/app/actions/auth'

export default async function PayrollPage() {
  const session = await getSession()
  const isGlobal = session?.isGlobalAdmin || session?.role === 'readonly'
  const branchId = session?.branchId

  const currentYear = new Date().getFullYear()

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
      db
        .select()
        .from(payrollTable)
        .where(
          and(
            !isGlobal && branchId ? eq(payrollTable.branchId, branchId) : undefined,
            gte(payrollTable.year, currentYear - 1)
          )
        )
        .catch(() => []),
      db
        .select()
        .from(attendanceTable)
        .where(
          and(
            !isGlobal && branchId ? eq(attendanceTable.branchId, branchId) : undefined,
            gte(attendanceTable.date, `${currentYear}-01-01`)
          )
        )
        .catch(() => []),
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
