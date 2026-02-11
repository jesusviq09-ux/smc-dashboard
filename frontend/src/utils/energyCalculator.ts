/**
 * Estimate energy consumption for a race stint
 */
export function estimateStintEnergy(
  durationMinutes: number,
  objective: 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE',
  vehicleWeightKg: number,
  circuitLengthMeters?: number
): number {
  // Base consumption W/min per vehicle weight category
  const baseWhPerMin = vehicleWeightKg > 60 ? 3.5 : 2.5  // SMC 01 vs SMC 02 EVO

  const objectiveMultiplier = {
    CONSERVATIVE: 0.75,
    BALANCED: 1.0,
    AGGRESSIVE: 1.25,
  }[objective]

  const circuitMultiplier = circuitLengthMeters
    ? Math.min(1.3, Math.max(0.8, circuitLengthMeters / 1000))
    : 1.0

  return Math.round(durationMinutes * baseWhPerMin * objectiveMultiplier * circuitMultiplier)
}

/**
 * Calculate battery state of charge percentage
 */
export function calculateSoC(currentWh: number, totalCapacityWh: number): number {
  return Math.round((currentWh / totalCapacityWh) * 100)
}

/**
 * Estimate time remaining based on current consumption rate
 */
export function estimateTimeRemaining(
  remainingWh: number,
  avgConsumptionWhPerMin: number
): number {
  if (avgConsumptionWhPerMin <= 0) return Infinity
  return Math.round(remainingWh / avgConsumptionWhPerMin)
}

/**
 * Linear regression for time prediction across sessions
 */
export function linearRegression(dataPoints: { x: number; y: number }[]): {
  slope: number
  intercept: number
  predict: (x: number) => number
} {
  const n = dataPoints.length
  if (n < 2) {
    return { slope: 0, intercept: dataPoints[0]?.y ?? 0, predict: () => dataPoints[0]?.y ?? 0 }
  }

  const sumX = dataPoints.reduce((s, p) => s + p.x, 0)
  const sumY = dataPoints.reduce((s, p) => s + p.y, 0)
  const sumXY = dataPoints.reduce((s, p) => s + p.x * p.y, 0)
  const sumX2 = dataPoints.reduce((s, p) => s + p.x * p.x, 0)

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  const intercept = (sumY - slope * sumX) / n

  return {
    slope,
    intercept,
    predict: (x: number) => slope * x + intercept,
  }
}
