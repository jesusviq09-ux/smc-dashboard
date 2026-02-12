import { Router, Request, Response } from 'express'
import { CalendarEvent } from '../models/index'

const router = Router()

// GET /calendar
router.get('/', async (_req: Request, res: Response) => {
  try {
    const events = await CalendarEvent.findAll({ order: [['date', 'ASC']] })
    res.json(events)
  } catch (err: any) {
    console.error('GET /calendar error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /calendar
router.post('/', async (req: Request, res: Response) => {
  try {
    const event = await CalendarEvent.create(req.body)
    res.status(201).json(event)
  } catch (err: any) {
    console.error('POST /calendar error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// PUT /calendar/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const event = await CalendarEvent.findByPk(req.params.id)
    if (!event) return res.status(404).json({ error: 'Evento no encontrado' })
    await event.update(req.body)
    res.json(event)
  } catch (err: any) {
    console.error('PUT /calendar/:id error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /calendar/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const event = await CalendarEvent.findByPk(req.params.id)
    if (!event) return res.status(404).json({ error: 'Evento no encontrado' })
    await event.destroy()
    res.status(204).send()
  } catch (err: any) {
    console.error('DELETE /calendar/:id error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
