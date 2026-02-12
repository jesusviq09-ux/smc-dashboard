// ============================================================
// VEHICLES
// ============================================================
export interface Vehicle {
  id: string
  name: string
  material: 'Acero' | 'Aluminio'
  weightKg: number
  restrictions: string[]
  description: string
  status: 'operational' | 'maintenance' | 'out_of_service'
  totalHours: number
  totalKm: number
  createdAt: string
}

// ============================================================
// PILOTS
// ============================================================
export interface PilotRatings {
  experience: number      // 1-10, weight 0.30
  driving: number         // 1-10, weight 0.25
  energyManagement: number // 1-10, weight 0.20
  teamwork: number        // 1-10, weight 0.10
  consistency: number     // 1-10, weight 0.10
  adaptation: number      // 1-10, weight 0.05
}

export interface Pilot {
  id: string
  fullName: string
  dni: string
  age: number
  weightKg: number
  heightCm: number
  photo?: string
  joinDate: string
  availability: boolean
  ratings: PilotRatings
  weightedScore: number   // Calculated
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface PilotRatingHistory {
  id: string
  pilotId: string
  ratings: PilotRatings
  weightedScore: number
  sessionDate: string
  sessionType: 'training' | 'race' | 'manual'
  sessionId?: string
  notes?: string
}

export interface CoachNote {
  id: string
  pilotId: string
  content: string
  author: string
  date: string
  sessionId?: string
  sessionType?: 'training' | 'race'
}

// F24 age categories
export type AgeCategory = 'F24' | 'F24+'

export function getPilotCategories(age: number): AgeCategory[] {
  if (age < 16) return ['F24']
  return ['F24', 'F24+']
}

// ============================================================
// TRAINING
// ============================================================
export type TrainingObjective =
  | 'speed'
  | 'energy_management'
  | 'pilot_changes'
  | 'conditions'
  | 'technical_setup'
  | 'other'

export interface TrainingLocation {
  id: string
  name: string
  scheduleStart?: string   // HH:MM
  scheduleEnd?: string     // HH:MM
  allowedVehicleIds: string[]
  circuitType: string
  description?: string
}

export interface TelemetryData {
  voltageInitial?: number
  voltageFinal?: number
  voltageAvg?: number
  currentAvg?: number
  currentPeak?: number
  motorTempInitial?: number
  motorTempMax?: number
  motorTempFinal?: number
  batteryConsumptionWh?: number
  batteryConsumptionPct?: number
  speedAvg?: number
  speedMax?: number
}

export interface LapTime {
  id: string
  stintId: string
  lapNumber: number
  timeSeconds: number
}

export interface TrainingStint {
  id: string
  sessionId: string
  pilotId: string
  pilot?: Pilot
  startTime?: string
  endTime?: string
  lapTimes: LapTime[]
  bestLap?: number
  avgLap?: number
  consistency?: number  // Std deviation
  telemetry: TelemetryData
  notes?: string
}

export interface TrainingSession {
  id: string
  date: string
  locationId: string
  location?: TrainingLocation
  vehicleId: string
  vehicle?: Vehicle
  pilotIds: string[]
  pilots?: Pilot[]
  durationMinutes: number
  objectives: TrainingObjective[]
  objectivesOther?: string
  stints: TrainingStint[]
  notes?: string
  status: 'planned' | 'in_progress' | 'completed'
  createdAt: string
}

// ============================================================
// RACE & STRATEGY
// ============================================================
export type RaceCategory = 'F24' | 'F24+'
export type RacePriorityMode = 'WIN' | 'FINISH' | 'DEVELOP_JUNIORS'
export type StintObjective = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE'
export type RaceStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled'

export interface RaceEvent {
  id: string
  name: string
  circuitId: string
  circuit?: Circuit
  date: string
  categories: RaceCategory[]
  weatherConditions?: string
  circuitNotes?: string
  status: RaceStatus
  results?: RaceResult[]
  createdAt: string
}

export interface RaceStrategy {
  id: string
  raceId: string
  vehicleId: string
  vehicle?: Vehicle
  category: RaceCategory
  priorityMode: RacePriorityMode
  stints: RaceStint[]
  totalEnergyEstimateWh?: number
  finishProbability?: number
  isActive: boolean
}

export interface RaceStint {
  id: string
  strategyId: string
  stintNumber: number
  pilotId: string
  pilot?: Pilot
  plannedDurationMinutes: number
  actualDurationMinutes?: number
  objective: StintObjective
  pilotChangeTimeSeconds: number
  notes?: string
  actualStartTime?: string
  actualEndTime?: string
  telemetry?: TelemetryData
  justification?: string
}

export interface RaceResult {
  vehicleId: string
  position?: number
  finishTime?: number
  completed: boolean
  dnfReason?: string
  incidents: RaceIncident[]
}

export interface RaceIncident {
  id: string
  raceId: string
  vehicleId?: string
  timestamp: string
  elapsed: number  // seconds from race start
  type: 'technical' | 'strategic' | 'pilot' | 'other'
  description: string
  resolved: boolean
}

export interface RecommendationOutput {
  vehicleAssignments: {
    vehicle: Vehicle
    stints: {
      stintNumber: number
      pilot: Pilot
      plannedDurationMinutes: number
      objective: StintObjective
      justification: string
      estimatedEnergyWh: number
    }[]
    totalEnergyEstimateWh: number
    finishProbability: number
  }[]
  warnings: string[]
  alternativeScenarios?: Partial<RecommendationOutput>[]
}

// ============================================================
// MAINTENANCE
// ============================================================
export type MaintenanceType = 'preventive' | 'corrective' | 'pre_race' | 'post_race' | 'electrical'
export type VehicleStatus = 'green' | 'yellow' | 'red'

export interface MaintenanceRecord {
  id: string
  vehicleId: string
  vehicle?: Vehicle
  type: MaintenanceType
  date: string
  description: string
  partsReplaced?: string[]
  costEur?: number
  technicianName?: string
  hoursAtService?: number
  nextServiceHours?: number
  nextServiceDate?: string
  completed: boolean
  notes?: string
  createdAt: string
}

export interface ChecklistItem {
  id: string
  checklistId: string
  label: string
  checked: boolean
  notes?: string
  critical: boolean
}

export interface MaintenanceChecklist {
  id: string
  vehicleId: string
  type: 'pre_race' | 'post_race'
  eventId?: string
  date: string
  items: ChecklistItem[]
  signedBy?: string
  completedAt?: string
  maintenanceRecordId?: string  // ID del MaintenanceRecord en el backend (para borrado sincronizado)
}

export interface SparePart {
  id: string
  vehicleId?: string  // null = shared
  name: string
  partNumber?: string
  stock: number
  minStock: number
  unit: string
  location?: string
  notes?: string
  lastRestocked?: string
}

// ============================================================
// CIRCUITS
// ============================================================
export interface CircuitSector {
  number: number
  name: string
  description?: string
}

export interface Circuit {
  id: string
  name: string
  city: string
  country: string
  lengthMeters: number
  asphaltType?: string
  elevationMeters?: number
  numberOfCurves?: number
  sectors: CircuitSector[]
  photo?: string
  mapUrl?: string
  notes?: string
  restrictions?: string[]
  createdAt: string
}

export interface CircuitRecord {
  id: string
  circuitId: string
  vehicleId: string
  vehicle?: Vehicle
  pilotId: string
  pilot?: Pilot
  bestTimeSeconds: number
  avgEnergyWh?: number
  sessionDate: string
  sessionId?: string
  sessionType: 'training' | 'race'
  weatherConditions?: string
}

// ============================================================
// COMMUNICATION
// ============================================================
export interface Message {
  id: string
  senderId: string
  senderName: string
  content: string
  eventId?: string  // null = general channel
  timestamp: string
  attachments?: MessageAttachment[]
  mentions?: string[]
}

export interface MessageAttachment {
  id: string
  messageId: string
  filename: string
  url: string
  type: string
  size: number
}

export interface Briefing {
  id: string
  eventId: string
  type: 'pre_race' | 'post_race'
  objectives?: string
  strategy?: string
  roles?: string
  materialChecklist?: string
  schedule?: string
  additionalNotes?: string
  createdAt: string
  confirmations: BriefingConfirmation[]
}

export interface BriefingConfirmation {
  id: string
  briefingId: string
  memberName: string
  confirmedAt?: string
  confirmed: boolean
}

// ============================================================
// GOALS
// ============================================================
export type GoalType = 'pilot' | 'team'
export type GoalStatus = 'in_progress' | 'completed' | 'overdue'

export interface Goal {
  id: string
  type: GoalType
  pilotId?: string
  pilot?: Pilot
  title: string
  description?: string
  metric: string
  currentValue: number
  targetValue: number
  unit: string
  deadline: string
  status: GoalStatus
  progress: number  // 0-100
  createdAt: string
  updatedAt: string
}

// ============================================================
// TELEMETRY
// ============================================================
export interface TelemetryReading {
  id: string
  deviceId: string
  vehicleId?: string
  voltage: number
  current: number
  temperature: number
  speed: number
  gpsLat?: number
  gpsLon?: number
  timestamp: string
  sessionId?: string
  sessionType?: 'training' | 'race'
}

// ============================================================
// STATISTICS
// ============================================================
export interface PilotStats {
  pilotId: string
  pilot?: Pilot
  totalDrivingHours: number
  totalSessions: number
  totalRaces: number
  racesCompleted: number
  personalRecords: { circuitId: string; vehicleId: string; bestTimeSeconds: number }[]
  avgEnergyConsumption?: number
  improvementRate?: number  // % improvement vs 3 months ago
  teamRank?: number
}

export interface VehicleStats {
  vehicleId: string
  vehicle?: Vehicle
  totalHours: number
  totalKm: number
  totalEnergyWh: number
  maintenanceCount: number
  incidentCount: number
  racesCompleted: number
  podiums: number
}

// ============================================================
// APP CONFIG
// ============================================================
export interface AppConfig {
  weightPenaltyThresholdKg: number   // Default: 50
  weightPenaltyPer10kg: number       // Default: 0.2
  echookApiUrl?: string
  echookApiKey?: string
  teamName: string
}

// ============================================================
// SYNC
// ============================================================
export type SyncStatus = 'online' | 'offline' | 'syncing' | 'error'

export interface SyncQueueItem {
  id?: number
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  url: string
  body?: unknown
  timestamp: string
  retryCount: number
  status: 'pending' | 'processing' | 'failed'
  error?: string
}
