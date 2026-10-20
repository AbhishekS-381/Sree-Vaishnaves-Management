import { loadWaiterOrderPage } from '../page'

export default async function WaiterOrderBranchPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchId: string }>
  searchParams?: Promise<{ branch?: string }>
}) {
  const { branchId } = await params
  return loadWaiterOrderPage(branchId, searchParams)
}
