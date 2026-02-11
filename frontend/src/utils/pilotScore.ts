import { PilotRatings } from '@/types'

export interface ScoreConfig {
  penaltyThresholdKg: number  // Default: 50
  penaltyPer10kg: number      // Default: 0.2
}

const DEFAULT_CONFIG: ScoreConfig = {
  penaltyThresholdKg: 50,
  penaltyPer10kg: 0.2,
}

/**
 * Calculate the weighted score for a pilot.
 * Formula: (Exp×0.30) + (Driving×0.25) + (Energy×0.20) + (Team×0.10) + (Consistency×0.10) + (Adaptation×0.05) - weightPenalty
 */
export function calculateWeightedScore(
  ratings: PilotRatings,
  weightKg: number,
  config: ScoreConfig = DEFAULT_CONFIG
): number {
  const rawScore =
    ratings.experience * 0.30 +
    ratings.driving * 0.25 +
    ratings.energyManagement * 0.20 +
    ratings.teamwork * 0.10 +
    ratings.consistency * 0.10 +
    ratings.adaptation * 0.05

  const excessKg = Math.max(0, weightKg - config.penaltyThresholdKg)
  const weightPenalty = Math.floor(excessKg / 10) * config.penaltyPer10kg

  return Math.max(0, Math.round((rawScore - weightPenalty) * 100) / 100)
}

/**
 * Calculate vehicle affinity score.
 * SMC 02 EVO benefits lighter pilots (aluminum chassis, power-to-weight).
 */
export function calculateVehicleAffinity(weightKg: number, vehicleId: string): number {
  // SMC 02 EVO = lightweight vehicle (aluminium)
  if (vehicleId === 'smc02' || vehicleId.toLowerCase().includes('02')) {
    const bonus = Math.max(0, (70 - weightKg) / 10) * 0.15
    return Math.round(bonus * 100) / 100
  }
  // SMC 01 = steel vehicle, weight matters less
  return 0
}

/**
 * Get score color class based on value (1-10)
 */
export function getScoreColor(score: number): string {
  if (score >= 8) return 'text-success'
  if (score >= 6) return 'text-primary'
  if (score >= 4) return 'text-warning'
  return 'text-danger'
}

/**
 * Get score background color class
 */
export function getScoreBgColor(score: number): string {
  if (score >= 8) return 'bg-success/10 border-success/20'
  if (score >= 6) return 'bg-primary/10 border-primary/20'
  if (score >= 4) return 'bg-warning/10 border-warning/20'
  return 'bg-danger/10 border-danger/20'
}

/**
 * Calculate improvement percentage between two scores
 */
export function calculateImprovementPct(oldScore: number, newScore: number): number {
  if (oldScore === 0) return 0
  return Math.round(((newScore - oldScore) / oldScore) * 100)
}

/**
 * Calculate percentile rank within a team
 */
export function calculateTeamPercentile(pilotScore: number, allScores: number[]): number {
  if (allScores.length <= 1) return 100
  const below = allScores.filter(s => s < pilotScore).length
  return Math.round((below / (allScores.length - 1)) * 100)
}

/**
 * Get rating label for display
 */
export const RATING_LABELS: Record<keyof PilotRatings, string> = {
  experience: 'Experiencia',
  driving: 'Pilotaje',
  energyManagement: 'Gest. Energética',
  teamwork: 'Trabajo en Equipo',
  consistency: 'Consistencia',
  adaptation: 'Adaptación',
}

export const RATING_WEIGHTS: Record<keyof PilotRatings, number> = {
  experience: 0.30,
  driving: 0.25,
  energyManagement: 0.20,
  teamwork: 0.10,
  consistency: 0.10,
  adaptation: 0.05,
}
