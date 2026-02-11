import { Router, Request, Response } from 'express'
import { Message } from '../models/index'

const router = Router()

router.get('/', async (req: Request, res: Response) => {
  const where = req.query.eventId ? { eventId: req.query.eventId } : {}
  const messages = await Message.findAll({ where, order: [['createdAt', 'ASC']], limit: 200 })
  res.json(messages)
})

router.post('/', async (req: Request, res: Response) => {
  const message = await Message.create(req.body)

  // Emit via Socket.io
  const io = req.app.get('io')
  if (io) {
    const channelId = req.body.eventId || 'general'
    io.to(channelId).emit('new-message', message)
  }

  res.status(201).json(message)
})

// Briefing routes (simplified, sharing this router)
router.get('/briefings/:eventId/:type', async (req: Request, res: Response) => {
  // Placeholder - briefings stored as special messages
  res.json(null)
})

router.post('/briefings', async (req: Request, res: Response) => {
  res.status(201).json({ ...req.body, id: crypto.randomUUID(), createdAt: new Date().toISOString(), confirmations: [] })
})

router.post('/briefings/:id/confirm', async (req: Request, res: Response) => {
  res.json({ confirmed: true })
})

export default router
