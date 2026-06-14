import { readJSON, DB_FILES } from '@/lib/db'
import PayrollClientPage from './PayrollClientPage'

export default async function PayrollPage() {
  console.log("Loading Payroll Page...");
  try {
    const staff = await readJSON<any>(DB_FILES.STAFF)
    console.log("Staff loaded:", Array.isArray(staff) ? staff.length : typeof staff);

    const payroll = await readJSON<any>(DB_FILES.PAYROLL)
    console.log("Payroll loaded:", Array.isArray(payroll) ? payroll.length : typeof payroll);

    const attendance = await readJSON<any>(DB_FILES.ATTENDANCE).catch(() => [])

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
