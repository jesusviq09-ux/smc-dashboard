import { Router, Request, Response } from 'express'
import { TrainingSession, TrainingStint, LapTime, TrainingLocation } from '../models/index'

const router = Router()

// GET /training/locations
router.get('/locations', async (_req: Request, res: Response) => {
  try {
    const locations = await TrainingLocation.findAll()
    res.json(locations)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// GET /training/sessions
router.get('/sessions', async (_req: Request, res: Response) => {
  try {
    const sessions = await TrainingSession.findAll({ order: [['date', 'DESC']] })
    res.json(sessions)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// GET /training/sessions/:id
router.get('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const session = await TrainingSession.findByPk(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })

    const stints = await TrainingStint.findAll({ where: { sessionId: session.id } })
    const stintsWithLaps = await Promise.all(stints.map(async (stint) => {
      const lapTimes = await LapTime.findAll({
        where: { stintId: stint.id },
        order: [['lapNumber', 'ASC']],
      })
      return { ...stint.toJSON(), lapTimes }
    }))

    res.json({ ...session.toJSON(), stints: stintsWithLaps })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// POST /training/sessions
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const session = await TrainingSession.create(req.body)
    res.status(201).json({ ...session.toJSON(), stints: [] })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// PUT /training/sessions/:id
router.put('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const session = await TrainingSession.findByPk(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    await session.update(req.body)
    res.json(session)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// DELETE /training/sessions/:id
router.delete('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const session = await TrainingSession.findByPk(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    await session.destroy()
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// POST /training/sessions/:id/stints
router.post('/sessions/:sessionId/stints', async (req: Request, res: Response) => {
  try {
    const { lapTimes, ...stintData } = req.body
    const stint = await TrainingStint.create({ ...stintData, sessionId: req.params.sessionId })

    if (lapTimes && Array.isArray(lapTimes)) {
      await LapTime.bulkCreate(lapTimes.map((lt: { lapNumber: number; timeSeconds: number }) => ({
        stintId: stint.id,
        lapNumber: lt.lapNumber,
        timeSeconds: lt.timeSeconds,
      })))
    }

    const allLaps = await LapTime.findAll({ where: { stintId: stint.id }, order: [['lapNumber', 'ASC']] })
    res.status(201).json({ ...stint.toJSON(), lapTimes: allLaps })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// GET /training/sessions/:id/compare/:pilotId
router.get('/sessions/:sessionId/compare/:pilotId', async (req: Request, res: Response) => {
  try {
    const { pilotId } = req.params

    const allSessions = await TrainingSession.findAll({
      order: [['date', 'DESC']],
      limit: 5,
    })

    const stints = await Promise.all(allSessions.map(async (session) => {
      const stints = await TrainingStint.findAll({ where: { sessionId: session.id, pilotId } })
      const lapData = await Promise.all(stints.map(async (s) => {
        const laps = await LapTime.findAll({ where: { stintId: s.id } })
        return { sessionId: session.id, sessionDate: (session as any).date, laps: laps.map(l => l.timeSeconds) }
      }))
      return lapData
    }))

    res.json(stints.flat())
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

export default router
