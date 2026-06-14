import { readJSON, DB_FILES } from '@/lib/db'
import ReportsClientPage from './ReportsClientPage'

export default async function ReportsPage() {
  const branches = await readJSON<any>(DB_FILES.BRANCHES)
  const eod = await readJSON<any>(DB_FILES.EOD).catch(() => [])
  const expenses = await readJSON<any>(DB_FILES.EXPENSES).catch(() => [])
  const payroll = await readJSON<any>(DB_FILES.PAYROLL).catch(() => [])
  const attendance = await readJSON<any>(DB_FILES.ATTENDANCE).catch(() => [])
  const staff = await readJSON<any>(DB_FILES.STAFF).catch(() => [])

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
