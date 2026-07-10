import { readJSON, DB_FILES } from '@/lib/db'
import PayrollClientPage from './PayrollClientPage'
import { getSession } from '@/app/actions/auth'

export default async function PayrollPage() {
  const session = await getSession();
  try {
    let [staff, payroll, attendance] = await Promise.all([
      readJSON<any>(DB_FILES.STAFF),
      readJSON<any>(DB_FILES.PAYROLL),
      readJSON<any>(DB_FILES.ATTENDANCE).catch(() => [])
    ]);

    if (!session?.isGlobalAdmin && session?.role !== 'readonly') {
      staff = staff.filter((s: any) => s.branchId === session?.branchId)
      payroll = payroll.filter((p: any) => p.branchId === session?.branchId)
      attendance = attendance.filter((a: any) => a.branchId === session?.branchId)
    }
    
    staff = staff.filter((s: any) => s.isActive === true)

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
