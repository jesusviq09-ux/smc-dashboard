import { DataTypes, Model, Optional } from 'sequelize'
import { sequelize } from '../config/database'

// ============================================================
// VEHICLE
// ============================================================
interface VehicleAttrs {
  id: string; name: string; material: string; weightKg: number
  restrictions: string[]; description: string; status: string
  totalHours: number; totalKm: number
}
export class Vehicle extends Model<VehicleAttrs, Optional<VehicleAttrs, 'totalHours' | 'totalKm'>> implements VehicleAttrs {
  declare id: string; declare name: string; declare material: string; declare weightKg: number
  declare restrictions: string[]; declare description: string; declare status: string
  declare totalHours: number; declare totalKm: number
}
Vehicle.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  material: { type: DataTypes.STRING, allowNull: false },
  weightKg: { type: DataTypes.FLOAT, allowNull: false },
  restrictions: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  status: { type: DataTypes.STRING, defaultValue: 'operational' },
  totalHours: { type: DataTypes.FLOAT, defaultValue: 0 },
  totalKm: { type: DataTypes.FLOAT, defaultValue: 0 },
}, { sequelize, modelName: 'Vehicle', tableName: 'vehicles', timestamps: true })

// ============================================================
// PILOT
// ============================================================
interface PilotAttrs {
  id: string; fullName: string; dni: string; age: number; weightKg: number
  heightCm: number; photo?: string; joinDate: string; availability: boolean
  ratingExperience: number; ratingDriving: number; ratingEnergyManagement: number
  ratingTeamwork: number; ratingConsistency: number; ratingAdaptation: number
  weightedScore: number; notes?: string
}
export class Pilot extends Model<PilotAttrs> implements PilotAttrs {
  declare id: string; declare fullName: string; declare dni: string
  declare age: number; declare weightKg: number; declare heightCm: number
  declare photo?: string; declare joinDate: string; declare availability: boolean
  declare ratingExperience: number; declare ratingDriving: number
  declare ratingEnergyManagement: number; declare ratingTeamwork: number
  declare ratingConsistency: number; declare ratingAdaptation: number
  declare weightedScore: number; declare notes?: string
}
Pilot.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  fullName: { type: DataTypes.STRING, allowNull: false },
  dni: { type: DataTypes.STRING, allowNull: false, unique: true },
  age: { type: DataTypes.INTEGER, allowNull: false },
  weightKg: { type: DataTypes.FLOAT, allowNull: false },
  heightCm: { type: DataTypes.FLOAT, defaultValue: 170 },
  photo: { type: DataTypes.TEXT },
  joinDate: { type: DataTypes.DATEONLY, allowNull: false },
  availability: { type: DataTypes.BOOLEAN, defaultValue: true },
  ratingExperience: { type: DataTypes.FLOAT, defaultValue: 5 },
  ratingDriving: { type: DataTypes.FLOAT, defaultValue: 5 },
  ratingEnergyManagement: { type: DataTypes.FLOAT, defaultValue: 5 },
  ratingTeamwork: { type: DataTypes.FLOAT, defaultValue: 5 },
  ratingConsistency: { type: DataTypes.FLOAT, defaultValue: 5 },
  ratingAdaptation: { type: DataTypes.FLOAT, defaultValue: 5 },
  weightedScore: { type: DataTypes.FLOAT, defaultValue: 5 },
  notes: { type: DataTypes.TEXT },
}, { sequelize, modelName: 'Pilot', tableName: 'pilots', timestamps: true })

// ============================================================
// TRAINING LOCATION
// ============================================================
interface LocationAttrs {
  id: string; name: string; scheduleStart?: string; scheduleEnd?: string
  allowedVehicleIds: string[]; circuitType: string; description?: string
}
export class TrainingLocation extends Model<LocationAttrs> implements LocationAttrs {
  declare id: string; declare name: string; declare scheduleStart?: string
  declare scheduleEnd?: string; declare allowedVehicleIds: string[]
  declare circuitType: string; declare description?: string
}
TrainingLocation.init({
  id: { type: DataTypes.STRING, primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  scheduleStart: { type: DataTypes.STRING },
  scheduleEnd: { type: DataTypes.STRING },
  allowedVehicleIds: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  circuitType: { type: DataTypes.STRING, defaultValue: '' },
  description: { type: DataTypes.TEXT },
}, { sequelize, modelName: 'TrainingLocation', tableName: 'training_locations', timestamps: false })

// ============================================================
// TRAINING SESSION
// ============================================================
export class TrainingSession extends Model {
  declare id: string; declare date: string; declare locationId: string
  declare vehicleId: string; declare pilotIds: string[]; declare durationMinutes: number
  declare objectives: string[]; declare objectivesOther?: string; declare notes?: string
  declare status: string
}
TrainingSession.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  date: { type: DataTypes.DATE, allowNull: false },
  locationId: { type: DataTypes.STRING, allowNull: false },
  vehicleId: { type: DataTypes.STRING, allowNull: false },
  pilotIds: { type: DataTypes.ARRAY(DataTypes.UUID), defaultValue: [] },
  durationMinutes: { type: DataTypes.INTEGER, defaultValue: 60 },
  objectives: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  objectivesOther: { type: DataTypes.TEXT },
  notes: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING, defaultValue: 'planned' },
}, { sequelize, modelName: 'TrainingSession', tableName: 'training_sessions', timestamps: true })

// ============================================================
// TRAINING STINT
// ============================================================
export class TrainingStint extends Model {
  declare id: string; declare sessionId: string; declare pilotId: string
  declare startTime?: string; declare endTime?: string; declare notes?: string
  declare voltageInitial?: number; declare voltageFinal?: number; declare voltageAvg?: number
  declare currentAvg?: number; declare currentPeak?: number
  declare motorTempInitial?: number; declare motorTempMax?: number; declare motorTempFinal?: number
  declare batteryConsumptionWh?: number; declare batteryConsumptionPct?: number
}
TrainingStint.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  sessionId: { type: DataTypes.UUID, allowNull: false, references: { model: 'training_sessions', key: 'id' } },
  pilotId: { type: DataTypes.UUID, allowNull: false },
  startTime: { type: DataTypes.DATE },
  endTime: { type: DataTypes.DATE },
  notes: { type: DataTypes.TEXT },
  voltageInitial: DataTypes.FLOAT, voltageFinal: DataTypes.FLOAT, voltageAvg: DataTypes.FLOAT,
  currentAvg: DataTypes.FLOAT, currentPeak: DataTypes.FLOAT,
  motorTempInitial: DataTypes.FLOAT, motorTempMax: DataTypes.FLOAT, motorTempFinal: DataTypes.FLOAT,
  batteryConsumptionWh: DataTypes.FLOAT, batteryConsumptionPct: DataTypes.FLOAT,
}, { sequelize, modelName: 'TrainingStint', tableName: 'training_stints', timestamps: false })

// ============================================================
// LAP TIME
// ============================================================
export class LapTime extends Model {
  declare id: string; declare stintId: string; declare lapNumber: number; declare timeSeconds: number
}
LapTime.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  stintId: { type: DataTypes.UUID, allowNull: false },
  lapNumber: { type: DataTypes.INTEGER, allowNull: false },
  timeSeconds: { type: DataTypes.FLOAT, allowNull: false },
}, { sequelize, modelName: 'LapTime', tableName: 'lap_times', timestamps: false })

// ============================================================
// CIRCUIT
// ============================================================
export class Circuit extends Model {
  declare id: string; declare name: string; declare city: string; declare country: string
  declare lengthMeters: number; declare asphaltType?: string; declare elevationMeters?: number
  declare numberOfCurves?: number; declare sectors: object[]; declare photo?: string
  declare mapUrl?: string; declare notes?: string; declare restrictions?: string[]
}
Circuit.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING, allowNull: false },
  city: { type: DataTypes.STRING, defaultValue: '' },
  country: { type: DataTypes.STRING, defaultValue: 'España' },
  lengthMeters: { type: DataTypes.FLOAT, defaultValue: 0 },
  asphaltType: DataTypes.STRING,
  elevationMeters: DataTypes.FLOAT,
  numberOfCurves: DataTypes.INTEGER,
  sectors: { type: DataTypes.JSONB, defaultValue: [] },
  photo: DataTypes.TEXT,
  mapUrl: DataTypes.STRING,
  notes: DataTypes.TEXT,
  restrictions: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
}, { sequelize, modelName: 'Circuit', tableName: 'circuits', timestamps: true })

// ============================================================
// RACE EVENT
// ============================================================
export class RaceEvent extends Model {
  declare id: string; declare name: string; declare circuitId: string
  declare date: string; declare categories: string[]; declare weatherConditions?: string
  declare circuitNotes?: string; declare status: string; declare results?: object[]
}
RaceEvent.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  name: { type: DataTypes.STRING, allowNull: false },
  circuitId: { type: DataTypes.UUID },
  date: { type: DataTypes.DATE, allowNull: false },
  categories: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  weatherConditions: DataTypes.STRING,
  circuitNotes: DataTypes.TEXT,
  status: { type: DataTypes.STRING, defaultValue: 'planned' },
  results: { type: DataTypes.JSONB, defaultValue: [] },
}, { sequelize, modelName: 'RaceEvent', tableName: 'race_events', timestamps: true })

// ============================================================
// RACE STRATEGY
// ============================================================
export class RaceStrategy extends Model {
  declare id: string; declare raceId: string; declare vehicleId: string
  declare category: string; declare priorityMode: string
  declare totalEnergyEstimateWh?: number; declare finishProbability?: number; declare isActive: boolean
}
RaceStrategy.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  raceId: { type: DataTypes.UUID, allowNull: false },
  vehicleId: { type: DataTypes.STRING, allowNull: false },
  category: { type: DataTypes.STRING, allowNull: false },
  priorityMode: { type: DataTypes.STRING, defaultValue: 'FINISH' },
  totalEnergyEstimateWh: DataTypes.FLOAT,
  finishProbability: DataTypes.FLOAT,
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
}, { sequelize, modelName: 'RaceStrategy', tableName: 'race_strategies', timestamps: true })

// ============================================================
// RACE STINT
// ============================================================
export class RaceStint extends Model {
  declare id: string; declare strategyId: string; declare stintNumber: number
  declare pilotId: string; declare plannedDurationMinutes: number; declare actualDurationMinutes?: number
  declare objective: string; declare pilotChangeTimeSeconds: number; declare notes?: string
  declare actualStartTime?: string; declare actualEndTime?: string; declare justification?: string
}
RaceStint.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  strategyId: { type: DataTypes.UUID, allowNull: false },
  stintNumber: { type: DataTypes.INTEGER, allowNull: false },
  pilotId: { type: DataTypes.UUID, allowNull: false },
  plannedDurationMinutes: { type: DataTypes.INTEGER, allowNull: false },
  actualDurationMinutes: DataTypes.INTEGER,
  objective: { type: DataTypes.STRING, defaultValue: 'BALANCED' },
  pilotChangeTimeSeconds: { type: DataTypes.INTEGER, defaultValue: 60 },
  notes: DataTypes.TEXT,
  actualStartTime: DataTypes.DATE,
  actualEndTime: DataTypes.DATE,
  justification: DataTypes.TEXT,
}, { sequelize, modelName: 'RaceStint', tableName: 'race_stints', timestamps: false })

// ============================================================
// MAINTENANCE RECORD
// ============================================================
export class MaintenanceRecord extends Model {
  declare id: string; declare vehicleId: string; declare type: string; declare date: string
  declare description: string; declare partsReplaced?: string[]; declare costEur?: number
  declare technicianName?: string; declare hoursAtService?: number; declare nextServiceHours?: number
  declare nextServiceDate?: string; declare completed: boolean; declare notes?: string
}
MaintenanceRecord.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  vehicleId: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false },
  date: { type: DataTypes.DATEONLY, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  partsReplaced: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
  costEur: DataTypes.FLOAT,
  technicianName: DataTypes.STRING,
  hoursAtService: DataTypes.FLOAT,
  nextServiceHours: DataTypes.FLOAT,
  nextServiceDate: DataTypes.DATEONLY,
  completed: { type: DataTypes.BOOLEAN, defaultValue: false },
  notes: DataTypes.TEXT,
}, { sequelize, modelName: 'MaintenanceRecord', tableName: 'maintenance_records', timestamps: true })

// ============================================================
// SPARE PART
// ============================================================
export class SparePart extends Model {
  declare id: string; declare vehicleId?: string; declare name: string
  declare partNumber?: string; declare stock: number; declare minStock: number
  declare unit: string; declare location?: string; declare notes?: string
}
SparePart.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  vehicleId: DataTypes.STRING,
  name: { type: DataTypes.STRING, allowNull: false },
  partNumber: DataTypes.STRING,
  stock: { type: DataTypes.INTEGER, defaultValue: 0 },
  minStock: { type: DataTypes.INTEGER, defaultValue: 1 },
  unit: { type: DataTypes.STRING, defaultValue: 'ud' },
  location: DataTypes.STRING,
  notes: DataTypes.TEXT,
}, { sequelize, modelName: 'SparePart', tableName: 'spare_parts', timestamps: true })

// ============================================================
// TELEMETRY READING
// ============================================================
export class TelemetryReading extends Model {
  declare id: string; declare deviceId: string; declare vehicleId?: string
  declare voltage: number; declare current: number; declare temperature: number
  declare speed: number; declare gpsLat?: number; declare gpsLon?: number
  declare timestamp: string; declare sessionId?: string; declare sessionType?: string
}
TelemetryReading.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  deviceId: { type: DataTypes.STRING, allowNull: false },
  vehicleId: DataTypes.STRING,
  voltage: { type: DataTypes.FLOAT, defaultValue: 0 },
  current: { type: DataTypes.FLOAT, defaultValue: 0 },
  temperature: { type: DataTypes.FLOAT, defaultValue: 0 },
  speed: { type: DataTypes.FLOAT, defaultValue: 0 },
  gpsLat: DataTypes.FLOAT,
  gpsLon: DataTypes.FLOAT,
  timestamp: { type: DataTypes.DATE, allowNull: false },
  sessionId: DataTypes.UUID,
  sessionType: DataTypes.STRING,
}, { sequelize, modelName: 'TelemetryReading', tableName: 'telemetry_readings', timestamps: false })

// ============================================================
// MESSAGE
// ============================================================
export class Message extends Model {
  declare id: string; declare senderId: string; declare senderName: string
  declare content: string; declare eventId?: string; declare mentions?: string[]
}
Message.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  senderId: { type: DataTypes.STRING, defaultValue: 'team' },
  senderName: { type: DataTypes.STRING, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  eventId: DataTypes.UUID,
  mentions: { type: DataTypes.ARRAY(DataTypes.STRING), defaultValue: [] },
}, { sequelize, modelName: 'Message', tableName: 'messages', timestamps: true })

// ============================================================
// GOAL
// ============================================================
export class Goal extends Model {
  declare id: string; declare type: string; declare pilotId?: string; declare title: string
  declare description?: string; declare metric: string; declare currentValue: number
  declare targetValue: number; declare unit: string; declare deadline: string
  declare status: string; declare progress: number
}
Goal.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  type: { type: DataTypes.STRING, allowNull: false },
  pilotId: DataTypes.UUID,
  title: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  metric: { type: DataTypes.STRING, allowNull: false },
  currentValue: { type: DataTypes.FLOAT, defaultValue: 0 },
  targetValue: { type: DataTypes.FLOAT, allowNull: false },
  unit: { type: DataTypes.STRING, defaultValue: '' },
  deadline: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'in_progress' },
  progress: { type: DataTypes.FLOAT, defaultValue: 0 },
}, { sequelize, modelName: 'Goal', tableName: 'goals', timestamps: true })

// ============================================================
// COACH NOTE
// ============================================================
export class CoachNote extends Model {
  declare id: string; declare pilotId: string; declare content: string
  declare author: string; declare date: string; declare sessionId?: string
}
CoachNote.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  pilotId: { type: DataTypes.UUID, allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  author: { type: DataTypes.STRING, defaultValue: 'Equipo' },
  date: { type: DataTypes.DATE, allowNull: false },
  sessionId: DataTypes.UUID,
}, { sequelize, modelName: 'CoachNote', tableName: 'coach_notes', timestamps: false })

// ============================================================
// PILOT RATING HISTORY
// ============================================================
export class PilotRatingHistory extends Model {
  declare id: string; declare pilotId: string; declare sessionDate: string
  declare sessionType: string; declare sessionId?: string
  declare ratingExperience: number; declare ratingDriving: number
  declare ratingEnergyManagement: number; declare ratingTeamwork: number
  declare ratingConsistency: number; declare ratingAdaptation: number
  declare weightedScore: number; declare notes?: string
}
PilotRatingHistory.init({
  id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
  pilotId: { type: DataTypes.UUID, allowNull: false },
  sessionDate: { type: DataTypes.DATE, allowNull: false },
  sessionType: { type: DataTypes.STRING, defaultValue: 'manual' },
  sessionId: DataTypes.UUID,
  ratingExperience: DataTypes.FLOAT, ratingDriving: DataTypes.FLOAT,
  ratingEnergyManagement: DataTypes.FLOAT, ratingTeamwork: DataTypes.FLOAT,
  ratingConsistency: DataTypes.FLOAT, ratingAdaptation: DataTypes.FLOAT,
  weightedScore: DataTypes.FLOAT,
  notes: DataTypes.TEXT,
}, { sequelize, modelName: 'PilotRatingHistory', tableName: 'pilot_rating_history', timestamps: false })

export async function syncModels() {
  await sequelize.sync({ alter: true })
  console.log('All models synced')
}
