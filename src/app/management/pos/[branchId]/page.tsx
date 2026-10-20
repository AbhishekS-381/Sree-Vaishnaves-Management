import { loadPosDashboardPage } from '../page'

export default async function PosDashboardBranchPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchId: string }>
  searchParams?: Promise<{ branch?: string }>
}) {
  const { branchId } = await params
  return loadPosDashboardPage(branchId, searchParams)
}
