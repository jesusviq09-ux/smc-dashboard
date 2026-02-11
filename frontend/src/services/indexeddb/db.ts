import Dexie, { Table } from 'dexie'
import {
  Pilot, PilotRatingHistory, CoachNote,
  TrainingLocation, TrainingSession, TrainingStint, LapTime,
  Vehicle, RaceEvent, RaceStrategy, RaceStint, RaceIncident,
  MaintenanceRecord, MaintenanceChecklist,
  Circuit, CircuitRecord,
  Message, Briefing,
  Goal, SparePart, TelemetryReading, SyncQueueItem
} from '@/types'

export class SMCDatabase extends Dexie {
  // Pilots
  pilots!: Table<Pilot>
  pilotRatingHistory!: Table<PilotRatingHistory>
  coachNotes!: Table<CoachNote>

  // Training
  trainingLocations!: Table<TrainingLocation>
  trainingSessions!: Table<TrainingSession>
  trainingStints!: Table<TrainingStint>
  lapTimes!: Table<LapTime>

  // Vehicles
  vehicles!: Table<Vehicle>

  // Race
  raceEvents!: Table<RaceEvent>
  raceStrategies!: Table<RaceStrategy>
  raceStints!: Table<RaceStint>
  raceIncidents!: Table<RaceIncident>

  // Maintenance
  maintenanceRecords!: Table<MaintenanceRecord>
  maintenanceChecklists!: Table<MaintenanceChecklist>
  spareParts!: Table<SparePart>

  // Circuits
  circuits!: Table<Circuit>
  circuitRecords!: Table<CircuitRecord>

  // Communication
  messages!: Table<Message>
  briefings!: Table<Briefing>

  // Goals
  goals!: Table<Goal>

  // Telemetry
  telemetryReadings!: Table<TelemetryReading>

  // Sync
  syncQueue!: Table<SyncQueueItem & { id?: number }>

  constructor() {
    super('SMCDashboard')

    this.version(1).stores({
      pilots: 'id, name, dni, age, weightKg',
      pilotRatingHistory: '++id, pilotId, sessionDate',
      coachNotes: '++id, pilotId, date',
      trainingLocations: 'id, name',
      trainingSessions: 'id, date, locationId, vehicleId, status',
      trainingStints: 'id, sessionId, pilotId',
      lapTimes: 'id, stintId, lapNumber',
      vehicles: 'id, name',
      raceEvents: 'id, date, status',
      raceStrategies: 'id, raceId, vehicleId',
      raceStints: 'id, strategyId, pilotId',
      raceIncidents: 'id, raceId, vehicleId, timestamp',
      maintenanceRecords: 'id, vehicleId, type, date, completed',
      maintenanceChecklists: 'id, vehicleId, type, date',
      spareParts: 'id, vehicleId, name',
      circuits: 'id, name, city',
      circuitRecords: 'id, circuitId, vehicleId, pilotId',
      messages: 'id, eventId, timestamp, senderId',
      briefings: 'id, eventId, type',
      goals: 'id, type, pilotId, deadline, status',
      telemetryReadings: '++id, deviceId, vehicleId, timestamp, sessionId',
      syncQueue: '++id, status, timestamp',
    })
  }
}

export const db = new SMCDatabase()

// Seed initial data if empty
export async function seedInitialData() {
  const vehicleCount = await db.vehicles.count()
  if (vehicleCount > 0) return

  // Seed vehicles
  await db.vehicles.bulkPut([
    {
      id: 'smc01',
      name: 'SMC 01',
      material: 'Acero',
      weightKg: 80,
      restrictions: [],
      description: 'Vehículo convencional. Apto para todos los circuitos y pilotos.',
      status: 'operational',
      totalHours: 0,
      totalKm: 0,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'smc02',
      name: 'SMC 02 EVO',
      material: 'Aluminio',
      weightKg: 40,
      restrictions: ['karting_rivas'],
      description: 'Vehículo de competición avanzado. Mayor velocidad y eficiencia. No apto para Karting de Rivas.',
      status: 'operational',
      totalHours: 0,
      totalKm: 0,
      createdAt: new Date().toISOString(),
    },
  ])

  // Seed training locations
  await db.trainingLocations.bulkPut([
    {
      id: 'karting_rivas',
      name: 'Karting de Rivas',
      scheduleStart: '09:30',
      scheduleEnd: '16:30',
      allowedVehicleIds: ['smc01'],
      circuitType: 'Karting cerrado',
      description: 'Circuito de karting. Solo apto para SMC 01 (SMC 02 EVO no gira suficiente).',
    },
    {
      id: 'smc_development',
      name: 'Circuito de Desarrollo SMC',
      allowedVehicleIds: ['smc01', 'smc02'],
      circuitType: 'Superficie asfaltada amplia',
      description: 'Circuito propio del equipo. Sin restricción de horario. Apto para ambos vehículos.',
    },
  ])

  console.log('[SMC DB] Initial data seeded')
}
