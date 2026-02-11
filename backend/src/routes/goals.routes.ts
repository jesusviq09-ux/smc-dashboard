import { Router, Request, Response } from 'express'
import { Goal } from '../models/index'
import { Op } from 'sequelize'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const goals = await Goal.findAll({ order: [['deadline', 'ASC']] })

  // Auto-update status based on deadline
  const now = new Date()
  const updated = goals.map(g => {
    const isOverdue = new Date(g.deadline) < now && g.status !== 'completed'
    const progress = Math.min(100, Math.round((g.currentValue / g.targetValue) * 100))
    return {
      ...g.toJSON(),
      status: isOverdue ? 'overdue' : g.status,
      progress,
    }
  })

  res.json(updated)
})

router.post('/', async (req: Request, res: Response) => {
  const goal = await Goal.create(req.body)
  res.status(201).json(goal)
})

router.put('/:id', async (req: Request, res: Response) => {
  const goal = await Goal.findByPk(req.params.id)
  if (!goal) return res.status(404).json({ error: 'Goal not found' })

  const updates = req.body
  if (updates.currentValue !== undefined && updates.targetValue !== undefined) {
    updates.progress = Math.min(100, Math.round((updates.currentValue / updates.targetValue) * 100))
    if (updates.progress >= 100) updates.status = 'completed'
  }

  await goal.update(updates)
  res.json(goal)
})

router.delete('/:id', async (req: Request, res: Response) => {
  const goal = await Goal.findByPk(req.params.id)
  if (!goal) return res.status(404).json({ error: 'Goal not found' })
  await goal.destroy()
  res.status(204).send()
})

export default router
