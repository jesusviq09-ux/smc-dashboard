import { Router, Request, Response } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { User, PasswordResetToken } from '../models/index'
import { sendPasswordResetEmail } from '../utils/mailer'

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
    receiveEmails: user.receiveEmails ?? true,
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

// PUT /api/auth/profile — update own name and department
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' })
    const token = authHeader.slice(7)
    const decoded = jwt.verify(token, JWT_SECRET) as any
    const user = await User.findByPk(decoded.id)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    const { name, department, receiveEmails } = req.body
    await user.update({
      ...(name?.trim() ? { name: name.trim() } : {}),
      ...(department?.trim() ? { department: department.trim() } : {}),
      ...(receiveEmails !== undefined ? { receiveEmails: !!receiveEmails } : {}),
    })
    res.json({ user: buildUserPayload(user) })
  } catch (err: any) {
    console.error('PUT /auth/profile error:', err)
    res.status(500).json({ error: err.message || 'Error al actualizar perfil' })
  }
})

// GET /api/auth/me — verify token and return fresh user data from DB (including latest permissions)
router.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' })
    const token = authHeader.slice(7)
    const decoded = jwt.verify(token, JWT_SECRET) as any
    // Fetch fresh data from DB to get up-to-date permissions
    const user = await User.findByPk(decoded.id)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    // Ensure admin email always has admin role
    if (user.email.toLowerCase() === ADMIN_EMAIL && user.role !== 'admin') {
      await user.update({ role: 'admin' })
    }
    res.json({ user: buildUserPayload(user) })
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
})

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body
    // Respond 200 always to not reveal whether email exists
    if (!email) return res.json({ ok: true })

    const user = await User.findOne({ where: { email: email.toLowerCase() } })
    if (user) {
      const token = require('crypto').randomUUID() as string
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      await PasswordResetToken.create({ userId: user.id, token, expiresAt, used: false })
      const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:5173'
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`
      sendPasswordResetEmail(user.email, resetUrl).catch(console.error)
    }
    res.json({ ok: true })
  } catch (err: any) {
    console.error('POST /auth/forgot-password error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body
    if (!token || !newPassword) return res.status(400).json({ error: 'Token y contraseña requeridos' })
    if (newPassword.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' })

    const resetToken = await PasswordResetToken.findOne({ where: { token } })
    if (!resetToken || resetToken.used) return res.status(400).json({ error: 'Token inválido o ya utilizado' })
    if (new Date() > resetToken.expiresAt) return res.status(400).json({ error: 'El enlace ha expirado. Solicita uno nuevo.' })

    const user = await User.findByPk(resetToken.userId)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })

    const passwordHash = await bcrypt.hash(newPassword, 10)
    await user.update({ passwordHash })
    await resetToken.update({ used: true })
    res.json({ ok: true })
  } catch (err: any) {
    console.error('POST /auth/reset-password error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
