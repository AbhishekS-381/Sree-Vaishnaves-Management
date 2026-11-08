import {
  db,
  branches as branchesTable,
  eod as eodTable,
  expenses as expensesTable,
  payroll as payrollTable,
  attendance as attendanceTable,
  staff as staffTable,
  categories as categoriesTable,
} from '@/lib/db'
import { eq, and, isNull } from 'drizzle-orm'
import ReportsClientPage from './ReportsClientPage'
import { getSession } from '@/app/actions/auth'

export default async function ReportsPage() {
  const session = await getSession()
  const isGlobal = session?.isGlobalAdmin || session?.role === 'readonly'
  const branchId = session?.branchId

  const isScoped = !isGlobal && Boolean(branchId)

  const [branches, eod, expenses, payroll, attendance, staff, categories] = await Promise.all([
    (isScoped
      ? db
          .select()
          .from(branchesTable)
          .where(and(eq(branchesTable.id, branchId!), eq(branchesTable.isActive, true), isNull(branchesTable.deletedAt)))
      : db
          .select()
          .from(branchesTable)
          .where(and(eq(branchesTable.isActive, true), isNull(branchesTable.deletedAt)))
    ).catch(() => []),
    (isScoped
      ? db.select().from(eodTable).where(eq(eodTable.branchId, branchId!))
      : db.select().from(eodTable)
    ).catch(() => []),
    (isScoped
      ? db.select().from(expensesTable).where(eq(expensesTable.branchId, branchId!))
      : db.select().from(expensesTable)
    ).catch(() => []),
    (isScoped
      ? db.select().from(payrollTable).where(eq(payrollTable.branchId, branchId!))
      : db.select().from(payrollTable)
    ).catch(() => []),
    (isScoped
      ? db.select().from(attendanceTable).where(eq(attendanceTable.branchId, branchId!))
      : db.select().from(attendanceTable)
    ).catch(() => []),
    (isScoped
      ? db
          .select()
          .from(staffTable)
          .where(and(eq(staffTable.branchId, branchId!), eq(staffTable.isActive, true), isNull(staffTable.deletedAt)))
      : db
          .select()
          .from(staffTable)
          .where(and(eq(staffTable.isActive, true), isNull(staffTable.deletedAt)))
    ).catch(() => []),
    db.select().from(categoriesTable).catch(() => []),
  ])

  return (
    <ReportsClientPage 
      branches={branches} 
      eodData={eod}
      expensesData={expenses}
      payrollData={payroll}
      attendanceData={attendance}
      staffData={staff}
      categories={categories}
    />
  )
}
