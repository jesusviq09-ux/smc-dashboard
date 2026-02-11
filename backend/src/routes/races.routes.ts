import { Router, Request, Response } from 'express'
import { RaceEvent, RaceStrategy, RaceStint, Pilot, Vehicle } from '../models/index'

const router = Router()

function calcScore(ratings: Record<string, number>, weightKg: number): number {
  const raw = ratings.experience * 0.30 + ratings.driving * 0.25 +
    ratings.energyManagement * 0.20 + ratings.teamwork * 0.10 +
    ratings.consistency * 0.10 + ratings.adaptation * 0.05
  const penalty = Math.floor(Math.max(0, weightKg - 50) / 10) * 0.2
  return Math.max(0, Math.round((raw - penalty) * 100) / 100)
}

// GET /races
router.get('/', async (_req: Request, res: Response) => {
  try {
    const events = await RaceEvent.findAll({ order: [['date', 'DESC']] })
    res.json(events)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// GET /races/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const event = await RaceEvent.findByPk(req.params.id)
    if (!event) return res.status(404).json({ error: 'Race not found' })
    res.json(event)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// POST /races
router.post('/', async (req: Request, res: Response) => {
  try {
    const event = await RaceEvent.create(req.body)
    res.status(201).json(event)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// PUT /races/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const event = await RaceEvent.findByPk(req.params.id)
    if (!event) return res.status(404).json({ error: 'Race not found' })
    await event.update(req.body)
    res.json(event)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// DELETE /races/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const event = await RaceEvent.findByPk(req.params.id)
    if (!event) return res.status(404).json({ error: 'Race not found' })
    await event.destroy()
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// GET /races/:id/strategies
router.get('/:id/strategies', async (req: Request, res: Response) => {
  try {
    const strategies = await RaceStrategy.findAll({ where: { raceId: req.params.id } })
    const withStints = await Promise.all(strategies.map(async (s) => {
      const stints = await RaceStint.findAll({ where: { strategyId: s.id }, order: [['stintNumber', 'ASC']] })
      return { ...s.toJSON(), stints }
    }))
    res.json(withStints)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// POST /races/:id/strategies
router.post('/:id/strategies', async (req: Request, res: Response) => {
  try {
    const { stints, ...strategyData } = req.body
    const strategy = await RaceStrategy.create({ ...strategyData, raceId: req.params.id })

    if (stints && Array.isArray(stints)) {
      await RaceStint.bulkCreate(stints.map((s: any) => ({ ...s, strategyId: strategy.id })))
    }

    const allStints = await RaceStint.findAll({ where: { strategyId: strategy.id }, order: [['stintNumber', 'ASC']] })
    res.status(201).json({ ...strategy.toJSON(), stints: allStints })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// PUT /races/strategies/:id
router.put('/strategies/:id', async (req: Request, res: Response) => {
  try {
    const strategy = await RaceStrategy.findByPk(req.params.id)
    if (!strategy) return res.status(404).json({ error: 'Strategy not found' })
    await strategy.update(req.body)
    res.json(strategy)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// POST /races/:id/recommend
router.post('/:id/recommend', async (req: Request, res: Response) => {
  try {
    const { vehicleIds, category } = req.body

    const pilots = await Pilot.findAll({ where: { availability: true } })
    const vehicles = await Vehicle.findAll({
      where: vehicleIds ? { id: vehicleIds } : {},
    })

    const durationMinutes = category === 'F24+' ? 60 : 90
    const minStints = 3

    const recommendations = vehicles.map(vehicle => {
      const eligible = pilots.filter(p => {
        if (category === 'F24+' && p.age < 16) return false
        if (vehicle.restrictions?.includes('karting_rivas')) return false
        return true
      })

      const scored = eligible.map(p => ({
        id: p.id, fullName: p.fullName, weightKg: p.weightKg, age: p.age,
        score: p.weightedScore,
        affinityBonus: vehicle.id === 'smc02' ? Math.max(0, (70 - p.weightKg) / 10) * 0.15 : 0,
      })).map(p => ({ ...p, totalScore: p.score + p.affinityBonus }))
        .sort((a, b) => b.totalScore - a.totalScore)

      const stintDuration = Math.floor(durationMinutes / minStints)
      const stints = scored.slice(0, minStints).map((pilot, i) => ({
        stintNumber: i + 1,
        pilotId: pilot.id,
        pilotName: pilot.fullName,
        plannedDurationMinutes: stintDuration,
        objective: i === 0 ? 'CONSERVATIVE' : i === minStints - 1 ? 'AGGRESSIVE' : 'BALANCED',
        justification: `Puntuación: ${pilot.totalScore.toFixed(1)}/10${pilot.affinityBonus > 0 ? ` · Bonificación peso +${pilot.affinityBonus.toFixed(2)}` : ''}`,
      }))

      return { vehicleId: vehicle.id, vehicleName: vehicle.name, stints }
    })

    res.json({ recommendations, warnings: [] })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

export default router
