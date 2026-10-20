import { loadKitchenPage } from '../page'

export default async function KitchenBranchPage({
  params,
  searchParams,
}: {
  params: Promise<{ branchId: string }>
  searchParams?: Promise<{ branch?: string }>
}) {
  const { branchId } = await params
  return loadKitchenPage(branchId, searchParams)
}
