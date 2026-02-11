import { Router, Request, Response } from 'express'
import { Pilot, TrainingSession, RaceEvent, Vehicle, Goal } from '../models/index'

const router = Router()

// GET /exports/backup - Full JSON backup
router.get('/backup', async (_req: Request, res: Response) => {
  const [pilots, sessions, races, vehicles, goals] = await Promise.all([
    Pilot.findAll(),
    TrainingSession.findAll(),
    RaceEvent.findAll(),
    Vehicle.findAll(),
    Goal.findAll(),
  ])

  const backup = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    data: { pilots, trainingSessions: sessions, raceEvents: races, vehicles, goals },
  }

  res.setHeader('Content-Disposition', `attachment; filename=smc-backup-${Date.now()}.json`)
  res.setHeader('Content-Type', 'application/json')
  res.json(backup)
})

// GET /exports/pilots/csv
router.get('/pilots/csv', async (_req: Request, res: Response) => {
  const pilots = await Pilot.findAll()

  const headers = ['Nombre', 'DNI', 'Edad', 'Peso (kg)', 'Altura (cm)', 'Disponible', 'Puntuación', 'Experiencia', 'Pilotaje', 'Gest. Energética', 'Trabajo Equipo', 'Consistencia', 'Adaptación']
  const rows = pilots.map(p => [
    p.fullName, p.dni, p.age, p.weightKg, p.heightCm,
    p.availability ? 'Sí' : 'No', p.weightedScore,
    p.ratingExperience, p.ratingDriving, p.ratingEnergyManagement,
    p.ratingTeamwork, p.ratingConsistency, p.ratingAdaptation,
  ])

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')

  res.setHeader('Content-Disposition', 'attachment; filename=pilotos.csv')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.send('\uFEFF' + csv) // BOM for Excel
})

// GET /exports/training/csv
router.get('/training/csv', async (_req: Request, res: Response) => {
  const sessions = await TrainingSession.findAll({ order: [['date', 'DESC']] })
  const headers = ['Fecha', 'Localización', 'Vehículo', 'Duración (min)', 'Estado']
  const rows = sessions.map(s => [
    s.date, s.locationId, s.vehicleId, s.durationMinutes, s.status,
  ])

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  res.setHeader('Content-Disposition', 'attachment; filename=entrenamientos.csv')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.send('\uFEFF' + csv)
})

export default router
