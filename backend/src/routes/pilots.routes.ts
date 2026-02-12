import { Router, Request, Response } from 'express'
import multer from 'multer'
import path from 'path'
import { Pilot, CoachNote, PilotRatingHistory } from '../models/index'

const router = Router()

// Multer config for photo uploads
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads/pilots'),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
})
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })

// Helper: format pilot row to frontend shape
function formatPilot(p: Pilot) {
  return {
    id: p.id,
    fullName: p.fullName,
    dni: p.dni,
    age: p.age,
    weightKg: p.weightKg,
    heightCm: p.heightCm,
    photo: p.photo,
    joinDate: p.joinDate,
    availability: p.availability,
    weightedScore: p.weightedScore,
    notes: p.notes,
    createdAt: (p as any).createdAt,
    updatedAt: (p as any).updatedAt,
    ratings: {
      experience: p.ratingExperience,
      driving: p.ratingDriving,
      energyManagement: p.ratingEnergyManagement,
      teamwork: p.ratingTeamwork,
      consistency: p.ratingConsistency,
      adaptation: p.ratingAdaptation,
    },
  }
}

// Calculate weighted score
function calcScore(ratings: Record<string, number>, weightKg: number): number {
  const raw = ratings.experience * 0.30 + ratings.driving * 0.25 +
    ratings.energyManagement * 0.20 + ratings.teamwork * 0.10 +
    ratings.consistency * 0.10 + ratings.adaptation * 0.05
  const penalty = Math.floor(Math.max(0, weightKg - 50) / 10) * 0.2
  return Math.max(0, Math.round((raw - penalty) * 100) / 100)
}

// GET /pilots
router.get('/', async (_req: Request, res: Response) => {
  try {
    const pilots = await Pilot.findAll({ order: [['weightedScore', 'DESC']] })
    res.json(pilots.map(formatPilot))
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// GET /pilots/:id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const pilot = await Pilot.findByPk(req.params.id)
    if (!pilot) return res.status(404).json({ error: 'Pilot not found' })
    res.json(formatPilot(pilot))
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// POST /pilots
router.post('/', async (req: Request, res: Response) => {
  try {
    const { fullName, dni, age, weightKg, heightCm, availability, joinDate, notes, ratings } = req.body
    const weightedScore = calcScore(ratings, weightKg)

    const pilot = await Pilot.create({
      fullName, dni, age, weightKg, heightCm: heightCm ?? 170,
      availability: availability ?? true, joinDate, notes,
      ratingExperience: ratings.experience, ratingDriving: ratings.driving,
      ratingEnergyManagement: ratings.energyManagement, ratingTeamwork: ratings.teamwork,
      ratingConsistency: ratings.consistency, ratingAdaptation: ratings.adaptation,
      weightedScore,
    })

    res.status(201).json(formatPilot(pilot))
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// PUT /pilots/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
  const pilot = await Pilot.findByPk(req.params.id)
  if (!pilot) return res.status(404).json({ error: 'Pilot not found' })

  const { fullName, dni, age, weightKg, heightCm, availability, joinDate, notes, ratings } = req.body

  const updates: Partial<typeof req.body> = {}
  if (fullName) updates.fullName = fullName
  if (dni) updates.dni = dni
  if (age !== undefined) updates.age = age
  if (weightKg !== undefined) updates.weightKg = weightKg
  if (heightCm !== undefined) updates.heightCm = heightCm
  if (availability !== undefined) updates.availability = availability
  if (joinDate) updates.joinDate = joinDate
  if (notes !== undefined) updates.notes = notes

  if (ratings) {
    updates.ratingExperience = ratings.experience
    updates.ratingDriving = ratings.driving
    updates.ratingEnergyManagement = ratings.energyManagement
    updates.ratingTeamwork = ratings.teamwork
    updates.ratingConsistency = ratings.consistency
    updates.ratingAdaptation = ratings.adaptation

    const finalWeight = weightKg ?? pilot.weightKg
    updates.weightedScore = calcScore(ratings, finalWeight)
  }

  await pilot.update(updates)

  // Save rating history snapshot
  if (ratings) {
    await PilotRatingHistory.create({
      pilotId: pilot.id,
      sessionDate: new Date().toISOString(),
      sessionType: 'manual',
      ratingExperience: ratings.experience, ratingDriving: ratings.driving,
      ratingEnergyManagement: ratings.energyManagement, ratingTeamwork: ratings.teamwork,
      ratingConsistency: ratings.consistency, ratingAdaptation: ratings.adaptation,
      weightedScore: updates.weightedScore,
    })
  }

  res.json(formatPilot(pilot))
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// DELETE /pilots/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const pilot = await Pilot.findByPk(req.params.id)
    if (!pilot) return res.status(404).json({ error: 'Pilot not found' })
    await pilot.destroy()
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// GET /pilots/:id/rating-history
router.get('/:id/rating-history', async (req: Request, res: Response) => {
  try {
    const history = await PilotRatingHistory.findAll({
      where: { pilotId: req.params.id },
      order: [['sessionDate', 'ASC']],
    })
    const formatted = history.map(h => ({
      id: h.id,
      pilotId: h.pilotId,
      sessionDate: h.sessionDate,
      sessionType: h.sessionType,
      sessionId: h.sessionId,
      weightedScore: h.weightedScore,
      notes: h.notes,
      ratings: {
        experience: h.ratingExperience, driving: h.ratingDriving,
        energyManagement: h.ratingEnergyManagement, teamwork: h.ratingTeamwork,
        consistency: h.ratingConsistency, adaptation: h.ratingAdaptation,
      },
    }))
    res.json(formatted)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// GET /pilots/:id/notes
router.get('/:id/notes', async (req: Request, res: Response) => {
  try {
    const notes = await CoachNote.findAll({
      where: { pilotId: req.params.id },
      order: [['date', 'DESC']],
    })
    res.json(notes)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// POST /pilots/:id/notes
router.post('/:id/notes', async (req: Request, res: Response) => {
  try {
    const { content, author, date, sessionId } = req.body
    const note = await CoachNote.create({
      pilotId: req.params.id,
      content, author: author || 'Equipo',
      date: date || new Date().toISOString(),
      sessionId,
    })
    res.status(201).json(note)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// POST /pilots/:id/photo
router.post('/:id/photo', upload.single('photo'), async (req: Request, res: Response) => {
  const pilot = await Pilot.findByPk(req.params.id)
  if (!pilot) return res.status(404).json({ error: 'Pilot not found' })
  const url = `/uploads/pilots/${req.file?.filename}`
  await pilot.update({ photo: url })
  res.json({ url })
})

// POST /pilots/:id/stint-rating — guardar valoración de piloto tras un stint de carrera
router.post('/:id/stint-rating', async (req: Request, res: Response) => {
  try {
    const { stintScore, notes, raceId, sessionDate } = req.body
    const pilot = await Pilot.findByPk(req.params.id)
    if (!pilot) return res.status(404).json({ error: 'Piloto no encontrado' })

    await PilotRatingHistory.create({
      pilotId: req.params.id,
      sessionDate: sessionDate || new Date(),
      sessionType: 'race',
      sessionId: raceId || null,
      ratingExperience: pilot.ratingExperience,
      ratingDriving: stintScore,
      ratingEnergyManagement: pilot.ratingEnergyManagement,
      ratingTeamwork: pilot.ratingTeamwork,
      ratingConsistency: pilot.ratingConsistency,
      ratingAdaptation: pilot.ratingAdaptation,
      weightedScore: stintScore,
      notes: notes || null,
    })
    res.status(201).json({ ok: true })
  } catch (err: any) {
    console.error('POST /pilots/:id/stint-rating error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
