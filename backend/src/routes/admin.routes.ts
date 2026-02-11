import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { User } from '../models/index'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'smc-dashboard-secret-change-in-prod'
const ADMIN_EMAIL = 'smcgreenpower@gmail.com'

// Middleware: only allow admin users
function requireAdmin(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' })
    const token = authHeader.slice(7)
    const decoded = jwt.verify(token, JWT_SECRET) as any
    if (decoded.role !== 'admin' && decoded.email?.toLowerCase() !== ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Acceso denegado: se requiere rol de administrador' })
    }
    ;(req as any).adminUser = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

// GET /api/admin/users
router.get('/users', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'email', 'name', 'department', 'role', 'permissions'],
      order: [['name', 'ASC']],
    })
    res.json(users)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// PUT /api/admin/users/:id/permissions
router.put('/users/:id/permissions', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.params.id)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    // Cannot change permissions of the main admin
    if (user.email.toLowerCase() === ADMIN_EMAIL) {
      return res.status(403).json({ error: 'No se pueden modificar los permisos del administrador principal' })
    }
    const { permissions } = req.body
    await user.update({ permissions: Array.isArray(permissions) ? permissions : [] })
    res.json({ id: user.id, email: user.email, name: user.name, permissions: user.permissions })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', requireAdmin, async (req: Request, res: Response) => {
  try {
    const user = await User.findByPk(req.params.id)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    if (user.email.toLowerCase() === ADMIN_EMAIL) {
      return res.status(403).json({ error: 'No se puede cambiar el rol del administrador principal' })
    }
    const { role } = req.body
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Rol no válido. Use "admin" o "user"' })
    }
    await user.update({ role })
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

export default router
