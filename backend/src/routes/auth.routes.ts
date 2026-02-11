import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { User } from '../models/index'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'smc-dashboard-secret-change-in-prod'
const ADMIN_EMAIL = 'smcgreenpower@gmail.com'

function buildUserPayload(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    department: user.department,
    role: user.role || 'user',
    permissions: user.permissions || [],
  }
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, department } = req.body
    if (!email || !password || !name || !department) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' })
    }
    const existing = await User.findOne({ where: { email } })
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese email' })
    }
    const passwordHash = await bcrypt.hash(password, 10)
    // Force admin role for the designated admin email
    const role = email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'user'
    const user = await User.create({ email, passwordHash, name, department, role, permissions: [] } as any)
    const payload = buildUserPayload(user)
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
    res.status(201).json({ token, user: payload })
  } catch (err: any) {
    console.error('Register error:', err)
    res.status(500).json({ error: err.message || 'Error al registrar' })
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' })
    }
    const user = await User.findOne({ where: { email } })
    if (!user) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' })
    }
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' })
    }
    // Ensure admin email always has admin role (even if created before this change)
    if (user.email.toLowerCase() === ADMIN_EMAIL && user.role !== 'admin') {
      await user.update({ role: 'admin' })
    }
    const payload = buildUserPayload(user)
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' })
    res.json({ token, user: payload })
  } catch (err: any) {
    console.error('Login error:', err)
    res.status(500).json({ error: err.message || 'Error al iniciar sesión' })
  }
})

// GET /api/auth/me — verify token
router.get('/me', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' })
    const token = authHeader.slice(7)
    const decoded = jwt.verify(token, JWT_SECRET) as any
    res.json({
      user: {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
        department: decoded.department,
        role: decoded.role || 'user',
        permissions: decoded.permissions || [],
      },
    })
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
})

export default router
