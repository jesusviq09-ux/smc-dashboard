import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { Op } from 'sequelize'
import { Notice } from '../models/index'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'smc-dashboard-secret-change-in-prod'
const ADMIN_EMAIL = 'smcgreenpower@gmail.com'

function getUser(req: Request): any | null {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return null
    return jwt.verify(authHeader.slice(7), JWT_SECRET) as any
  } catch {
    return null
  }
}

function canWrite(user: any): boolean {
  if (!user) return false
  if (user.role === 'admin' || user.email?.toLowerCase() === ADMIN_EMAIL) return true
  return Array.isArray(user.permissions) && user.permissions.includes('notices_write')
}

// GET /api/notices
router.get('/', async (_req: Request, res: Response) => {
  try {
    const where: any = {
      [Op.or]: [
        { expiresAt: null },
        { expiresAt: { [Op.gt]: new Date() } },
      ],
    }
    const notices = await Notice.findAll({
      where,
      order: [['pinned', 'DESC'], ['createdAt', 'DESC']],
    })
    res.json(notices)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// POST /api/notices
router.post('/', async (req: Request, res: Response) => {
  try {
    const user = getUser(req)
    if (!canWrite(user)) return res.status(403).json({ error: 'Sin permisos para crear avisos' })
    const notice = await Notice.create({
      ...req.body,
      authorId: user.id,
      authorName: user.name,
    })
    res.status(201).json(notice)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// PUT /api/notices/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const user = getUser(req)
    if (!canWrite(user)) return res.status(403).json({ error: 'Sin permisos para editar avisos' })
    const notice = await Notice.findByPk(req.params.id)
    if (!notice) return res.status(404).json({ error: 'Aviso no encontrado' })
    await notice.update(req.body)
    res.json(notice)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// DELETE /api/notices/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const user = getUser(req)
    if (!user || (user.role !== 'admin' && user.email?.toLowerCase() !== ADMIN_EMAIL)) {
      return res.status(403).json({ error: 'Solo el administrador puede eliminar avisos' })
    }
    const notice = await Notice.findByPk(req.params.id)
    if (!notice) return res.status(404).json({ error: 'Aviso no encontrado' })
    await notice.destroy()
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

export default router
