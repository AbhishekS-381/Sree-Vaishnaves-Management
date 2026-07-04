import { readJSON, DB_FILES } from '@/lib/db'
import ReportsClientPage from './ReportsClientPage'

export default async function ReportsPage() {
  const [branches, eod, expenses, payroll, attendance, staff] = await Promise.all([
    readJSON<any>(DB_FILES.BRANCHES),
    readJSON<any>(DB_FILES.EOD).catch(() => []),
    readJSON<any>(DB_FILES.EXPENSES).catch(() => []),
    readJSON<any>(DB_FILES.PAYROLL).catch(() => []),
    readJSON<any>(DB_FILES.ATTENDANCE).catch(() => []),
    readJSON<any>(DB_FILES.STAFF).catch(() => [])
  ]);

  return (
    <ReportsClientPage 
      branches={branches} 
      eodData={eod}
      expensesData={expenses}
      payrollData={payroll}
      attendanceData={attendance}
      staffData={staff}
    />
  )
}
