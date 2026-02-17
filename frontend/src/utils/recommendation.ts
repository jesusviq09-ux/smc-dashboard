import {
  Pilot, Vehicle, Circuit, RaceCategory, RacePriorityMode,
  StintObjective, RecommendationOutput
} from '@/types'
import { calculateWeightedScore, calculateVehicleAffinity, calculateCircuitAffinity } from './pilotScore'
import { ScoreConfig } from './pilotScore'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RecommendationInput {
  category: RaceCategory
  durationMinutes: number
  vehicles: Vehicle[]
  circuit?: Circuit
  pilots: Pilot[]
  priorityMode: RacePriorityMode
  scoreConfig?: ScoreConfig
}

type VehicleRole = 'speed' | 'endurance' | 'balanced'

interface ScoredPilot extends Pilot {
  baseScore: number           // weighted score + circuit affinity
  roleScore: number           // role-specific score used for sorting
  vehicleAffinity: Record<string, number>
  circuitBonus: number
}

const ENERGY_PER_STINT_WH = 200

// ─── Main entry point ─────────────────────────────────────────────────────────

export function generateRecommendation(input: RecommendationInput): RecommendationOutput {
  const { category, durationMinutes, vehicles, pilots, priorityMode, scoreConfig, circuit } = input
  const warnings: string[] = []

  // 1. Filter eligible pilots
  const eligible = pilots.filter(p => {
    if (category === 'F24+' && p.age < 16) return false
    return p.availability !== false
  })

  if (eligible.length < 2) {
    warnings.push(`Solo ${eligible.length} piloto(s) elegible(s). Se necesitan al menos 2.`)
  }

  // 2. Calculate dynamic stint count and durations
  const numStints = calcNumStints(durationMinutes, circuit)
  const stintDurations = calcStintDurations(durationMinutes, numStints, circuit)

  // 3. Assign vehicle roles (speed / endurance / balanced)
  const vehicleRoles = assignVehicleRoles(vehicles)

  // 4. Pre-score pilots (base + circuit affinity + vehicle affinity)
  const baseScoredPilots: ScoredPilot[] = eligible.map(pilot => {
    const baseScore = calculateWeightedScore(pilot.ratings, pilot.weightKg, scoreConfig)
    const circuitBonus = circuit ? calculateCircuitAffinity(pilot, circuit) : 0
    const vehicleAffinity: Record<string, number> = {}
    for (const v of vehicles) {
      vehicleAffinity[v.id] = calculateVehicleAffinity(pilot.weightKg, v.id)
    }
    return {
      ...pilot,
      baseScore: Math.round((baseScore + circuitBonus) * 100) / 100,
      roleScore: 0,  // filled per vehicle below
      vehicleAffinity,
      circuitBonus,
    }
  })

  // 5. Track which stint slots are occupied (stintNumber → Set of pilotIds)
  // A pilot cannot drive the SAME stint number in two different cars simultaneously
  const stintSlotOccupied: Record<number, Set<string>> = {}
  for (let n = 1; n <= numStints; n++) stintSlotOccupied[n] = new Set()

  // 6. Build assignment for each vehicle
  const vehicleAssignments = vehicles.map(vehicle => {
    const role = vehicleRoles[vehicle.id]

    // Score pilots specifically for this vehicle's role
    const rolePilots = baseScoredPilots
      .map(p => ({
        ...p,
        roleScore: calcRoleScore(p, vehicle, role, circuit),
      }))
      .sort((a, b) => b.roleScore - a.roleScore)

    const stints = buildStints({
      vehicle,
      rolePilots,
      numStints,
      stintDurations,
      priorityMode,
      stintSlotOccupied,
      circuit,
      warnings,
    })

    const totalEnergyEstimateWh = Math.round(
      stints.reduce((sum, s) => sum + s.estimatedEnergyWh, 0)
    )
    const finishProbability = calcFinishProbability(stints, totalEnergyEstimateWh)

    return { vehicle, stints, totalEnergyEstimateWh, finishProbability }
  })

  return { vehicleAssignments, warnings }
}

// ─── Dynamic stint count ──────────────────────────────────────────────────────

export function calcNumStints(_durationMinutes: number, _circuit?: Circuit): number {
  // Always 3 stints regardless of duration or circuit
  return 3
}

// ─── Stint duration distribution ─────────────────────────────────────────────

export function calcStintDurations(
  totalMinutes: number,
  numStints: number,
  circuit?: Circuit
): number[] {
  const energy = circuit?.energyConsumption ?? 5

  // Base percentage distributions per stint count
  const baseDistributions: Record<number, number[]> = {
    2: [0.55, 0.45],
    3: [0.40, 0.35, 0.25],
    4: [0.30, 0.27, 0.25, 0.18],
  }

  let percentages = baseDistributions[numStints] ?? baseDistributions[3]

  // High energy consumption circuit: put heavier stint in the middle, shorter at start
  if (energy >= 7) {
    if (numStints === 3) percentages = [0.28, 0.42, 0.30]
    if (numStints === 4) percentages = [0.22, 0.30, 0.28, 0.20]
  }

  // Convert to minutes, ensure each is at least 10 min and integers
  const raw = percentages.map(p => Math.round(totalMinutes * p))

  // Adjust last stint to absorb rounding errors
  const sumRaw = raw.reduce((a, b) => a + b, 0)
  raw[raw.length - 1] += totalMinutes - sumRaw

  return raw.map(m => Math.max(10, m))
}

// ─── Vehicle roles ────────────────────────────────────────────────────────────

function assignVehicleRoles(vehicles: Vehicle[]): Record<string, VehicleRole> {
  if (vehicles.length <= 1) {
    return Object.fromEntries(vehicles.map(v => [v.id, 'balanced' as VehicleRole]))
  }

  // Sort vehicles: lighter/aluminium first → 'speed', heavier/steel → 'endurance'
  const sorted = [...vehicles].sort((a, b) => {
    const matA = a.material?.toLowerCase().includes('alumin') ? 0 : 1
    const matB = b.material?.toLowerCase().includes('alumin') ? 0 : 1
    if (matA !== matB) return matA - matB
    return (a.weightKg ?? 100) - (b.weightKg ?? 100)
  })

  const roles: Record<string, VehicleRole> = {}
  sorted.forEach((v, idx) => {
    if (idx === 0) roles[v.id] = 'speed'
    else if (idx === sorted.length - 1) roles[v.id] = 'endurance'
    else roles[v.id] = 'balanced'
  })
  return roles
}

// ─── Role-specific scoring ────────────────────────────────────────────────────

function calcRoleScore(
  pilot: ScoredPilot,
  vehicle: Vehicle,
  role: VehicleRole,
  circuit?: Circuit
): number {
  const r = pilot.ratings
  const va = pilot.vehicleAffinity[vehicle.id] ?? 0
  const ca = pilot.circuitBonus

  if (role === 'speed') {
    // Prioritise drivers who are fast and adaptable
    return r.driving * 0.40 + r.adaptation * 0.20 + r.experience * 0.10 + ca + va
  }
  if (role === 'endurance') {
    // Prioritise consistency and energy management
    return r.energyManagement * 0.40 + r.consistency * 0.30 + r.experience * 0.20 + ca + va
  }
  // balanced
  return pilot.baseScore + ca + va
}

// ─── Stint builder ────────────────────────────────────────────────────────────

interface BuildStintsInput {
  vehicle: Vehicle
  rolePilots: ScoredPilot[]
  numStints: number
  stintDurations: number[]
  priorityMode: RacePriorityMode
  stintSlotOccupied: Record<number, Set<string>>
  circuit?: Circuit
  warnings: string[]
}

function buildStints({
  vehicle,
  rolePilots,
  numStints,
  stintDurations,
  priorityMode,
  stintSlotOccupied,
  circuit,
  warnings,
}: BuildStintsInput) {
  // Choose pilot order based on priority mode
  const orderedPilots = selectPilotOrder(rolePilots, numStints, priorityMode, warnings, vehicle.name)

  const stints = orderedPilots.map((pilot, idx) => {
    const stintNumber = idx + 1
    const durationMinutes = stintDurations[idx] ?? stintDurations[stintDurations.length - 1]
    const objective = determineObjective(stintNumber, numStints)
    const energyFactor = objective === 'AGGRESSIVE' ? 1.2 : objective === 'CONSERVATIVE' ? 0.75 : 1.0
    const estimatedEnergyWh = ENERGY_PER_STINT_WH * energyFactor * (durationMinutes / 20)

    // Mark this slot as used
    stintSlotOccupied[stintNumber].add(pilot.id)

    return {
      stintNumber,
      pilot: pilot as Pilot,
      plannedDurationMinutes: durationMinutes,
      objective,
      estimatedEnergyWh: Math.round(estimatedEnergyWh),
      justification: buildJustification(pilot, vehicle, stintNumber, numStints, priorityMode, circuit, durationMinutes),
    }
  })

  return stints
}

// ─── Pilot ordering by priority mode ─────────────────────────────────────────

function selectPilotOrder(
  pilots: ScoredPilot[],
  numStints: number,
  priorityMode: RacePriorityMode,
  warnings: string[],
  vehicleName: string
): ScoredPilot[] {
  const result: ScoredPilot[] = []
  const used = new Set<string>()

  const pickBest = (pool: ScoredPilot[], exclude = used): ScoredPilot | undefined =>
    pool.find(p => !exclude.has(p.id))

  if (priorityMode === 'WIN') {
    // Best pilot closes (last stint), second opens, rest in middle
    const sorted = [...pilots]
    const closer = sorted[0]
    const opener = sorted[1] ?? sorted[0]

    if (numStints === 2) {
      result.push(opener, closer)
    } else {
      result.push(opener)
      used.add(opener.id)
      // Fill middle with best available
      for (let i = 1; i < numStints - 1; i++) {
        const mid = pickBest(sorted) ?? sorted[0]
        result.push(mid)
        used.add(mid.id)
      }
      result.push(closer)
    }
  } else if (priorityMode === 'FINISH') {
    // Most consistent and energy-efficient pilots
    const consistent = [...pilots].sort((a, b) =>
      (b.ratings.consistency + b.ratings.energyManagement) -
      (a.ratings.consistency + a.ratings.energyManagement)
    )
    for (let i = 0; i < numStints; i++) {
      result.push(consistent[i % consistent.length])
    }
  } else if (priorityMode === 'DEVELOP_JUNIORS') {
    const juniors = pilots.filter(p => p.age < 16)
    const seniors = pilots.filter(p => p.age >= 16)

    if (juniors.length === 0) {
      warnings.push(`No hay pilotos junior para "${vehicleName}". Usando modo FINISH.`)
      return selectPilotOrder(pilots, numStints, 'FINISH', warnings, vehicleName)
    }

    // Seniors bookend, juniors in middle
    result.push(seniors[0] ?? juniors[0])
    for (let i = 1; i < numStints - 1; i++) {
      result.push(juniors[(i - 1) % juniors.length])
    }
    result.push(seniors[1] ?? seniors[0] ?? juniors[0])
  }

  // Fallback: fill any missing slots
  while (result.length < numStints) {
    result.push(pilots[result.length % pilots.length] ?? pilots[0])
  }

  return result.slice(0, numStints)
}

// ─── Objective by stint position ──────────────────────────────────────────────

function determineObjective(stintNumber: number, totalStints: number): StintObjective {
  if (stintNumber === 1) return 'CONSERVATIVE'
  if (stintNumber === totalStints) return 'AGGRESSIVE'
  return 'BALANCED'
}

// ─── Rich justification ───────────────────────────────────────────────────────

function buildJustification(
  pilot: ScoredPilot,
  vehicle: Vehicle,
  stintNumber: number,
  totalStints: number,
  priorityMode: RacePriorityMode,
  circuit: Circuit | undefined,
  durationMinutes: number
): string {
  const r = pilot.ratings
  const parts: string[] = []

  // Position
  if (stintNumber === 1) {
    parts.push(`Stint inicial (${durationMinutes} min): establece ritmo y gestiona energía`)
  } else if (stintNumber === totalStints) {
    parts.push(`Cierre (${durationMinutes} min): ${priorityMode === 'WIN' ? 'sprint final para ganar' : 'asegurar la llegada'}`)
  } else {
    parts.push(`Stint ${stintNumber} (${durationMinutes} min): gestión equilibrada`)
  }

  // Score
  parts.push(`Score rol: ${pilot.roleScore.toFixed(1)}`)

  // Circuit-specific strengths
  if (circuit) {
    const tech = circuit.demandingTechnical ?? 5
    const phys = circuit.demandingPhysical ?? 5
    const energy = circuit.energyConsumption ?? 5

    if (tech >= 7 && r.driving >= 7) {
      parts.push(`Conducción ${r.driving}/10 ↔ circuito técnico ${tech}/10`)
    }
    if (energy >= 7 && r.energyManagement >= 7) {
      parts.push(`Energía ${r.energyManagement}/10 ↔ alto consumo ${energy}/10`)
    }
    if (phys >= 7 && r.experience >= 7) {
      parts.push(`Exp. ${r.experience}/10 ↔ exigencia física ${phys}/10`)
    }
  } else {
    if (r.consistency >= 8) parts.push(`Consistencia destacada: ${r.consistency}/10`)
    if (r.energyManagement >= 8) parts.push(`Energía destacada: ${r.energyManagement}/10`)
    if (r.driving >= 8) parts.push(`Conducción destacada: ${r.driving}/10`)
  }

  // Vehicle affinity
  const va = pilot.vehicleAffinity[vehicle.id] ?? 0
  if (va > 0) {
    parts.push(`+${va.toFixed(2)} afinidad peso (${pilot.weightKg}kg en ${vehicle.name})`)
  }

  return parts.join(' · ')
}

// ─── Finish probability ───────────────────────────────────────────────────────

function calcFinishProbability(
  stints: { objective: StintObjective; estimatedEnergyWh: number }[],
  totalEnergyWh: number
): number {
  let p = 0.85
  const aggressiveCount = stints.filter(s => s.objective === 'AGGRESSIVE').length
  p -= aggressiveCount * 0.05
  if (totalEnergyWh > 600) p -= 0.05
  if (totalEnergyWh > 800) p -= 0.10
  return Math.round(Math.max(0.4, Math.min(0.99, p)) * 100) / 100
}
