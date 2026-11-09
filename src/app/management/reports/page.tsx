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
import { eq, and, isNull, gte } from 'drizzle-orm'
import ReportsClientPage from './ReportsClientPage'
import { getSession } from '@/app/actions/auth'

export default async function ReportsPage() {
  const session = await getSession()
  const isGlobal = session?.isGlobalAdmin || session?.role === 'readonly'
  const branchId = session?.branchId

  const isScoped = !isGlobal && Boolean(branchId)
  const currentYear = new Date().getFullYear()
  const cutoffDate = `${currentYear - 1}-01-01`

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
      ? db.select().from(eodTable).where(and(eq(eodTable.branchId, branchId!), gte(eodTable.date, cutoffDate)))
      : db.select().from(eodTable).where(gte(eodTable.date, cutoffDate))
    ).catch(() => []),
    (isScoped
      ? db.select().from(expensesTable).where(and(eq(expensesTable.branchId, branchId!), gte(expensesTable.date, cutoffDate)))
      : db.select().from(expensesTable).where(gte(expensesTable.date, cutoffDate))
    ).catch(() => []),
    (isScoped
      ? db.select().from(payrollTable).where(and(eq(payrollTable.branchId, branchId!), gte(payrollTable.year, currentYear - 1)))
      : db.select().from(payrollTable).where(gte(payrollTable.year, currentYear - 1))
    ).catch(() => []),
    (isScoped
      ? db.select().from(attendanceTable).where(and(eq(attendanceTable.branchId, branchId!), gte(attendanceTable.date, cutoffDate)))
      : db.select().from(attendanceTable).where(gte(attendanceTable.date, cutoffDate))
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
