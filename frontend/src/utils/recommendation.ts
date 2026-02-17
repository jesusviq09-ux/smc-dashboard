import {
  Pilot, Vehicle, Circuit, RaceCategory, RacePriorityMode,
  StintObjective, RecommendationOutput
} from '@/types'
import { calculateWeightedScore, calculateVehicleAffinity, calculateCircuitAffinity } from './pilotScore'
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

  // Step 2: Score each pilot per vehicle (including circuit affinity)
  const scoredPilots: ScoredPilot[] = eligiblePilots.map(pilot => {
    const baseScore = calculateWeightedScore(pilot.ratings, pilot.weightKg, scoreConfig)
    const circuitBonus = input.circuit ? calculateCircuitAffinity(pilot, input.circuit) : 0
    const finalScore = Math.round((baseScore + circuitBonus) * 100) / 100
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

  // Step 3: Check if we have enough pilots for no-repeat assignment
  const totalSlotsNeeded = vehicles.length * minStints

  let vehicleAssignments: ReturnType<typeof assignStintsForVehicle>[]

  if (totalSlotsNeeded <= eligiblePilots.length) {
    // Enough pilots — original flow, no repetition across vehicles
    const globalUsedPilotIds = new Set<string>()
    vehicleAssignments = vehicles.map(vehicle => {
      const assignment = assignStintsForVehicle({
        vehicle,
        scoredPilots,
        globalUsedPilotIds,
        durationMinutes,
        minStints,
        priorityMode,
        category,
        warnings,
        circuit: input.circuit,
      })
      assignment.stints.forEach(s => globalUsedPilotIds.add(s.pilot.id))
      return assignment
    })
  } else {
    // Not enough pilots — use optimized greedy algorithm
    vehicleAssignments = optimizeWithLimitedPilots({
      vehicles,
      scoredPilots,
      durationMinutes,
      minStints,
      priorityMode,
      warnings,
      circuit: input.circuit,
    })
  }

  return {
    vehicleAssignments,
    warnings,
  }
}

// ─── GREEDY OPTIMIZER FOR LIMITED PILOTS ────────────────────────────────────

interface OptimizeInput {
  vehicles: Vehicle[]
  scoredPilots: ScoredPilot[]
  durationMinutes: number
  minStints: number
  priorityMode: RacePriorityMode
  warnings: string[]
  circuit?: Circuit
}

interface SlotCandidate {
  vehicleIdx: number
  vehicle: Vehicle
  stintIdx: number    // 0-based
  pilot: ScoredPilot
  score: number
}

function optimizeWithLimitedPilots({
  vehicles,
  scoredPilots,
  durationMinutes,
  minStints,
  priorityMode,
  warnings,
  circuit,
}: OptimizeInput) {
  const stintDurationMinutes = Math.floor(durationMinutes / minStints)

  // Build all (vehicle, stintIdx, pilot) candidates with their score
  const candidates: SlotCandidate[] = []
  for (let vi = 0; vi < vehicles.length; vi++) {
    const vehicle = vehicles[vi]
    for (let si = 0; si < minStints; si++) {
      for (const pilot of scoredPilots) {
        const vehicleBonus = pilot.vehicleAffinity[vehicle.id] ?? 0
        // Apply priority mode weighting to the base score
        let score = pilot.finalScore + vehicleBonus
        if (priorityMode === 'FINISH') {
          score += (pilot.ratings.consistency + pilot.ratings.energyManagement) * 0.1
        }
        // Prefer best pilots in last stint for WIN mode
        if (priorityMode === 'WIN' && si === minStints - 1) {
          score += pilot.finalScore * 0.2
        }
        // Prefer experienced pilots in first and last stint for DEVELOP_JUNIORS
        if (priorityMode === 'DEVELOP_JUNIORS') {
          if ((si === 0 || si === minStints - 1) && pilot.age >= 16) score += 0.5
          if (si > 0 && si < minStints - 1 && pilot.age < 16) score += 0.5
        }
        candidates.push({ vehicleIdx: vi, vehicle, stintIdx: si, pilot, score })
      }
    }
  }

  // Sort by score DESC — greedy assigns best fits first
  candidates.sort((a, b) => b.score - a.score)

  // Track assignments: assignments[vehicleIdx][stintIdx] = pilot | null
  const assignments: (ScoredPilot | null)[][] = vehicles.map(() =>
    Array(minStints).fill(null)
  )
  // Track how many times each pilot appears total
  const pilotAppearances: Record<string, number> = {}
  const maxAppearances = Math.ceil((vehicles.length * minStints) / scoredPilots.length)

  for (const candidate of candidates) {
    const { vehicleIdx, stintIdx, pilot } = candidate

    // Skip if slot already filled
    if (assignments[vehicleIdx][stintIdx] !== null) continue

    // Skip if pilot already maxed out appearances
    const appearances = pilotAppearances[pilot.id] ?? 0
    if (appearances >= maxAppearances) continue

    // Skip if pilot is already in ANY stint of this vehicle (one pilot per car rule)
    const alreadyInVehicle = assignments[vehicleIdx].some(p => p?.id === pilot.id)
    if (alreadyInVehicle) continue

    // Assign
    assignments[vehicleIdx][stintIdx] = pilot
    pilotAppearances[pilot.id] = appearances + 1
  }

  // Fill any remaining nulls (fallback: best available without consecutive constraint)
  for (let vi = 0; vi < vehicles.length; vi++) {
    for (let si = 0; si < minStints; si++) {
      if (assignments[vi][si] !== null) continue
      // Try relaxed assignment (allow any pilot, just not already in this vehicle)
      for (const pilot of scoredPilots) {
        const alreadyInVehicle = assignments[vi].some(p => p?.id === pilot.id)
        if (alreadyInVehicle) continue
        assignments[vi][si] = pilot
        pilotAppearances[pilot.id] = (pilotAppearances[pilot.id] ?? 0) + 1
        break
      }
      // Last resort: any pilot
      if (assignments[vi][si] === null) {
        assignments[vi][si] = scoredPilots[0]
        warnings.push(`No hay suficientes pilotos para ${vehicles[vi].name} stint ${si + 1}. Se reutiliza el mejor piloto.`)
      }
    }
  }

  // Build warnings for repeated pilots
  for (const [pilotId, count] of Object.entries(pilotAppearances)) {
    if (count > 1) {
      const pilot = scoredPilots.find(p => p.id === pilotId)
      if (!pilot) continue
      const slots: string[] = []
      for (let vi = 0; vi < vehicles.length; vi++) {
        for (let si = 0; si < minStints; si++) {
          if (assignments[vi][si]?.id === pilotId) {
            slots.push(`${vehicles[vi].name} stint ${si + 1}`)
          }
        }
      }
      warnings.push(`${pilot.fullName} conduce en ${count} stints: ${slots.join(', ')}.`)
    }
  }

  // Build final vehicle assignments
  return vehicles.map((vehicle, vi) => {
    const stints = assignments[vi].map((pilot, si) => {
      const p = pilot! as ScoredPilotWithAffinity
      const stintNumber = si + 1
      const objective = determineObjective(stintNumber, minStints)
      const justification = buildJustification(
        { ...p, totalScore: p.finalScore + (p.vehicleAffinity[vehicle.id] ?? 0) },
        vehicle, stintNumber, minStints, priorityMode, circuit
      )
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
  })
}

// ─── ORIGINAL VEHICLE ASSIGNMENT (sufficient pilots) ────────────────────────

interface VehicleAssignmentInput {
  vehicle: Vehicle
  scoredPilots: ScoredPilot[]
  globalUsedPilotIds: Set<string>
  durationMinutes: number
  minStints: number
  priorityMode: RacePriorityMode
  category: RaceCategory
  warnings: string[]
  circuit?: Circuit
}

function assignStintsForVehicle({
  vehicle,
  scoredPilots,
  globalUsedPilotIds,
  durationMinutes,
  minStints,
  priorityMode,
  warnings,
  circuit,
}: VehicleAssignmentInput) {
  const stintDurationMinutes = Math.floor(durationMinutes / minStints)

  // Score pilots with vehicle affinity, sorted best first
  const allVehiclePilots = scoredPilots
    .map(p => ({
      ...p,
      totalScore: p.finalScore + (p.vehicleAffinity[vehicle.id] ?? 0),
    }))
    .sort((a, b) => b.totalScore - a.totalScore)

  // Prefer pilots not yet used by other vehicles
  const availablePilots = allVehiclePilots.filter(p => !globalUsedPilotIds.has(p.id))
  const fallbackPilots = allVehiclePilots.filter(p => globalUsedPilotIds.has(p.id))

  // Use available pilots first; if not enough, supplement with fallbacks (with warning)
  const vehicleScoredPilots = availablePilots.length >= minStints
    ? availablePilots
    : [
        ...availablePilots,
        ...fallbackPilots.filter(p => !availablePilots.some(a => a.id === p.id)),
      ]

  if (availablePilots.length < minStints && availablePilots.length < allVehiclePilots.length) {
    warnings.push(`Pocos pilotos disponibles para ${vehicle.name}. Algunos pilotos se asignan a varios vehículos.`)
  }

  // Select pilots based on priority mode
  let orderedPilots: typeof vehicleScoredPilots = []

  if (priorityMode === 'WIN') {
    orderedPilots = selectForWin(vehicleScoredPilots, minStints)
  } else if (priorityMode === 'FINISH') {
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
      orderedPilots.push(vehicleScoredPilots[0])
      warnings.push(`No hay suficientes pilotos para ${vehicle.name}. Se reutiliza un piloto.`)
    }
  }

  // Build stint assignments
  const stints = orderedPilots.slice(0, minStints).map((pilot, index) => {
    const stintNumber = index + 1
    const objective = determineObjective(stintNumber, minStints)
    const justification = buildJustification(pilot, vehicle, stintNumber, minStints, priorityMode, circuit)

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
  priorityMode: RacePriorityMode,
  circuit?: Circuit
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

  // Circuit compatibility hints
  if (circuit) {
    if ((circuit.demandingTechnical ?? 5) >= 7 && pilot.ratings.driving >= 7) {
      parts.push(`Buen pilotaje para circuito técnico (${pilot.ratings.driving}/10)`)
    }
    if ((circuit.energyConsumption ?? 5) >= 7 && pilot.ratings.energyManagement >= 7) {
      parts.push(`Gestión energética adecuada para este circuito (${pilot.ratings.energyManagement}/10)`)
    }
    if ((circuit.demandingPhysical ?? 5) >= 7 && pilot.ratings.experience >= 7) {
      parts.push(`Experiencia para circuito físicamente exigente (${pilot.ratings.experience}/10)`)
    }
  } else {
    if (pilot.ratings.energyManagement >= 8) {
      parts.push(`Gestión energética destacada (${pilot.ratings.energyManagement}/10)`)
    }
    if (pilot.ratings.consistency >= 8) {
      parts.push(`Alta consistencia (${pilot.ratings.consistency}/10)`)
    }
  }

  // Weight reason for SMC 02 EVO
  if (affinityBonus > 0) {
    parts.push(`Bonificación por peso (${pilot.weightKg}kg): +${affinityBonus.toFixed(2)} en ${vehicle.name}`)
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
