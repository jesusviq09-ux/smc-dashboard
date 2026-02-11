import {
  Pilot, Vehicle, Circuit, RaceCategory, RacePriorityMode,
  StintObjective, RecommendationOutput
} from '@/types'
import { calculateWeightedScore, calculateVehicleAffinity } from './pilotScore'
import { ScoreConfig } from './pilotScore'

interface RecommendationInput {
  category: RaceCategory
  durationMinutes: number
  vehicles: Vehicle[]
  circuit?: Circuit
  pilots: Pilot[]
  priorityMode: RacePriorityMode
  minStints?: number
  scoreConfig?: ScoreConfig
}

interface ScoredPilotWithAffinity extends Pilot {
  finalScore: number
  vehicleAffinity: Record<string, number>
  eligibleCategories: string[]
  totalScore: number
}

interface ScoredPilot extends Pilot {
  finalScore: number
  vehicleAffinity: Record<string, number>
  eligibleCategories: string[]
}

const ENERGY_PER_STINT_WH = 200  // Baseline energy estimate per stint (configurable)

/**
 * Generate race strategy recommendation based on pilot scores, weights, and priority mode.
 */
export function generateRecommendation(input: RecommendationInput): RecommendationOutput {
  const {
    category,
    durationMinutes,
    vehicles,
    pilots,
    priorityMode,
    minStints = 3,
    scoreConfig,
  } = input

  const warnings: string[] = []

  // Step 1: Filter eligible pilots
  const eligiblePilots = pilots.filter(pilot => {
    if (category === 'F24+' && pilot.age < 16) {
      return false
    }
    return pilot.availability !== false
  })

  if (eligiblePilots.length < 2) {
    warnings.push(`Solo ${eligiblePilots.length} piloto(s) elegible(s). Se necesitan al menos 2.`)
  }

  // Step 2: Score each pilot per vehicle
  const scoredPilots: ScoredPilot[] = eligiblePilots.map(pilot => {
    const finalScore = calculateWeightedScore(
      pilot.ratings,
      pilot.weightKg,
      scoreConfig
    )
    const vehicleAffinity: Record<string, number> = {}
    for (const vehicle of vehicles) {
      vehicleAffinity[vehicle.id] = calculateVehicleAffinity(pilot.weightKg, vehicle.id)
    }

    return {
      ...pilot,
      finalScore,
      vehicleAffinity,
      eligibleCategories: pilot.age < 16 ? ['F24'] : ['F24', 'F24+'],
    }
  })

  // Sort by score descending
  scoredPilots.sort((a, b) => b.finalScore - a.finalScore)

  // Step 3: Assign stints per vehicle
  const vehicleAssignments = vehicles.map(vehicle => {
    return assignStintsForVehicle({
      vehicle,
      scoredPilots,
      durationMinutes,
      minStints,
      priorityMode,
      category,
      warnings,
    })
  })

  return {
    vehicleAssignments,
    warnings,
  }
}

interface VehicleAssignmentInput {
  vehicle: Vehicle
  scoredPilots: ScoredPilot[]
  durationMinutes: number
  minStints: number
  priorityMode: RacePriorityMode
  category: RaceCategory
  warnings: string[]
}

function assignStintsForVehicle({
  vehicle,
  scoredPilots,
  durationMinutes,
  minStints,
  priorityMode,
  warnings,
}: VehicleAssignmentInput) {
  const stintDurationMinutes = Math.floor(durationMinutes / minStints)
  const usedPilotIds = new Set<string>()

  // Score pilots with vehicle affinity
  const vehicleScoredPilots = scoredPilots
    .map(p => ({
      ...p,
      totalScore: p.finalScore + (p.vehicleAffinity[vehicle.id] ?? 0),
    }))
    .sort((a, b) => b.totalScore - a.totalScore)

  // Select pilots based on priority mode
  let orderedPilots: typeof vehicleScoredPilots = []

  if (priorityMode === 'WIN') {
    // Best pilots in last and first stints
    orderedPilots = selectForWin(vehicleScoredPilots, minStints)
  } else if (priorityMode === 'FINISH') {
    // Most consistent pilots
    const consistentFirst = [...vehicleScoredPilots].sort((a, b) =>
      (b.ratings.consistency + b.ratings.energyManagement) -
      (a.ratings.consistency + a.ratings.energyManagement)
    )
    orderedPilots = consistentFirst.slice(0, minStints)
  } else if (priorityMode === 'DEVELOP_JUNIORS') {
    orderedPilots = selectForDevelopment(vehicleScoredPilots, minStints, warnings)
  }

  // Fallback if not enough pilots
  while (orderedPilots.length < minStints) {
    const available = vehicleScoredPilots.find(p =>
      !orderedPilots.some(op => op.id === p.id)
    )
    if (available) {
      orderedPilots.push(available)
    } else {
      // Reuse best pilot if needed
      orderedPilots.push(vehicleScoredPilots[0])
      warnings.push(`No hay suficientes pilotos para ${vehicle.name}. Se reutiliza un piloto.`)
    }
  }

  // Build stint assignments
  const stints = orderedPilots.slice(0, minStints).map((pilot, index) => {
    const stintNumber = index + 1
    const objective = determineObjective(stintNumber, minStints)
    const justification = buildJustification(pilot, vehicle, stintNumber, minStints, priorityMode)

    usedPilotIds.add(pilot.id)

    return {
      stintNumber,
      pilot: pilot as Pilot,
      plannedDurationMinutes: stintDurationMinutes,
      objective,
      estimatedEnergyWh: ENERGY_PER_STINT_WH * (objective === 'AGGRESSIVE' ? 1.2 : objective === 'CONSERVATIVE' ? 0.75 : 1.0),
      justification,
    }
  })

  const totalEnergyEstimateWh = stints.reduce((sum, s) => sum + s.estimatedEnergyWh, 0)
  const finishProbability = calculateFinishProbability(stints, totalEnergyEstimateWh)

  return {
    vehicle,
    stints,
    totalEnergyEstimateWh: Math.round(totalEnergyEstimateWh),
    finishProbability: Math.round(finishProbability * 100) / 100,
  }
}

function selectForWin(pilots: ScoredPilotWithAffinity[], count: number): ScoredPilotWithAffinity[] {
  // Top scorer in last stint (closer), second in first, fill middle
  const sorted = [...pilots].sort((a, b) => b.totalScore - a.totalScore)
  if (count === 3) {
    return [sorted[1], sorted[2] ?? sorted[0], sorted[0]]
  }
  return sorted.slice(0, count)
}

function selectForDevelopment(
  pilots: ScoredPilotWithAffinity[],
  count: number,
  warnings: string[]
): ScoredPilotWithAffinity[] {
  const juniors = pilots.filter(p => p.age !== undefined && p.age < 16)
  const seniors = pilots.filter(p => p.age === undefined || p.age >= 16)

  if (juniors.length === 0) {
    warnings.push('No hay pilotos junior disponibles para el modo "Desarrollar Juniors".')
    return seniors.slice(0, count)
  }

  // Seniors in first and last, juniors in middle
  const result: ScoredPilotWithAffinity[] = []
  result.push(seniors[0]) // First stint: experienced
  if (count > 2) {
    result.push(...juniors.slice(0, count - 2)) // Middle: juniors
  }
  result.push(seniors[1] ?? seniors[0]) // Last: experienced

  return result.slice(0, count)
}

function determineObjective(stintNumber: number, totalStints: number): StintObjective {
  if (stintNumber === 1) return 'CONSERVATIVE'
  if (stintNumber === totalStints) return 'AGGRESSIVE'
  return 'BALANCED'
}

function buildJustification(
  pilot: { fullName: string; weightKg: number; ratings: Pilot['ratings']; totalScore: number; vehicleAffinity: Record<string, number> },
  vehicle: Vehicle,
  stintNumber: number,
  totalStints: number,
  priorityMode: RacePriorityMode
): string {
  const parts: string[] = []
  const affinityBonus = pilot.vehicleAffinity[vehicle.id] ?? 0

  // Position reason
  if (stintNumber === 1) {
    parts.push(`Stint inicial: piloto sólido para establecer ritmo y conservar energía`)
  } else if (stintNumber === totalStints) {
    parts.push(`Stint final: piloto de cierre ${priorityMode === 'WIN' ? 'más rápido del equipo' : 'consistente para asegurar llegada'}`)
  } else {
    parts.push(`Stint intermedio: gestión equilibrada de energía`)
  }

  // Score reason
  parts.push(`Puntuación: ${pilot.totalScore.toFixed(1)}/10`)

  // Weight reason for SMC 02 EVO
  if (affinityBonus > 0) {
    parts.push(`Bonificación por peso (${pilot.weightKg}kg): +${affinityBonus.toFixed(2)} en ${vehicle.name}`)
  }

  // Energy management highlight
  if (pilot.ratings.energyManagement >= 8) {
    parts.push(`Gestión energética destacada (${pilot.ratings.energyManagement}/10)`)
  }

  // Consistency highlight
  if (pilot.ratings.consistency >= 8) {
    parts.push(`Alta consistencia (${pilot.ratings.consistency}/10)`)
  }

  return parts.join(' · ')
}

function calculateFinishProbability(
  stints: { objective: StintObjective; estimatedEnergyWh: number }[],
  totalEnergyWh: number
): number {
  // Base probability from consistency
  let probability = 0.85

  // Aggressive stints increase risk
  const aggressiveCount = stints.filter(s => s.objective === 'AGGRESSIVE').length
  probability -= aggressiveCount * 0.05

  // Too many stints with high energy = lower probability
  if (totalEnergyWh > 600) probability -= 0.05
  if (totalEnergyWh > 800) probability -= 0.10

  return Math.max(0.4, Math.min(0.99, probability))
}
