import { loadBillingPage } from '../page'

export default async function BillingBranchPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchId: string }>
  searchParams?: Promise<{ branch?: string }>
}) {
  const { branchId } = await params
  return loadBillingPage(branchId, searchParams)
}
