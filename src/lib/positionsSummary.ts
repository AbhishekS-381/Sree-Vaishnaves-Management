/**
 * Compute summary statistics for position requirements.
 *
 * Pure function — no side effects. Designed to be called with already-
 * filtered requirement + staff arrays so the summary reflects whatever
 * filters the user has applied.
 */

export type PositionsSummary = {
  totalPositions: number   // sum of requiredCount across all requirements
  filledPositions: number  // active staff assigned to these positions
  vacantPositions: number  // totalPositions - filledPositions (min 0)
  totalSalary: number      // sum of (defaultSalary × requiredCount) for each requirement
}

export type RequirementLike = {
  id: string
  requiredCount: number
  defaultSalary?: number
}

export type StaffLike = {
  positionId?: string
  isActive: boolean
}

export function computePositionsSummary(
  requirements: RequirementLike[],
  staff: StaffLike[]
): PositionsSummary {
  let totalPositions = 0
  let filledPositions = 0
  let totalSalary = 0

  for (const req of requirements) {
    totalPositions += req.requiredCount

    const filled = staff.filter(
      (s) => s.isActive && s.positionId === req.id
    ).length
    filledPositions += filled

    totalSalary += (req.defaultSalary ?? 0) * req.requiredCount
  }

  return {
    totalPositions,
    filledPositions,
    vacantPositions: Math.max(0, totalPositions - filledPositions),
    totalSalary,
  }
}
