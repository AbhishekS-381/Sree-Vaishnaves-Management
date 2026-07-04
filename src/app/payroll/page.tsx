import { readJSON, DB_FILES } from '@/lib/db'
import PayrollClientPage from './PayrollClientPage'

export default async function PayrollPage() {
  try {
    const [staff, payroll, attendance] = await Promise.all([
      readJSON<any>(DB_FILES.STAFF),
      readJSON<any>(DB_FILES.PAYROLL),
      readJSON<any>(DB_FILES.ATTENDANCE).catch(() => [])
    ]);

    return (
      <PayrollClientPage
        staff={Array.isArray(staff) ? staff : []}
        savedRecords={Array.isArray(payroll) ? payroll : []}
        attendanceLogs={Array.isArray(attendance) ? attendance : []}
      />
    )
  } catch (error) {
    console.error("Critical Error in Payroll Page:", error);
    return <div className="p-10 text-red-500 font-bold">Error loading data. See server logs.</div>
  }
}
