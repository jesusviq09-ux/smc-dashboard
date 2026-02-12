import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import path from 'path'
import rateLimit from 'express-rate-limit'

// Routes
import pilotsRouter from './routes/pilots.routes'
import trainingRouter from './routes/training.routes'
import racesRouter from './routes/races.routes'
import maintenanceRouter from './routes/maintenance.routes'
import circuitsRouter from './routes/circuits.routes'
import telemetryRouter from './routes/telemetry.routes'
import messagesRouter from './routes/messages.routes'
import goalsRouter from './routes/goals.routes'
import exportsRouter from './routes/exports.routes'
import authRouter from './routes/auth.routes'
import adminRouter from './routes/admin.routes'
import noticesRouter from './routes/notices.routes'
import accountingRouter from './routes/accounting.routes'
import calendarRouter from './routes/calendar.routes'

const app = express()

// Trust Railway/Vercel proxy (needed for express-rate-limit and correct IP detection)
app.set('trust proxy', 1)

// Security
// CORS_ORIGIN se configura como variable de entorno en Railway/producción
// En desarrollo local permite cualquier origen ('*')
app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  credentials: true,
}))

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 })
app.use('/api', limiter)

// Logging & parsing
app.use(morgan('dev'))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Static files (uploads)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

// API routes
app.use('/api/pilots', pilotsRouter)
app.use('/api/training', trainingRouter)
app.use('/api/races', racesRouter)
app.use('/api/maintenance', maintenanceRouter)
app.use('/api/circuits', circuitsRouter)
app.use('/api/telemetry', telemetryRouter)
app.use('/api/messages', messagesRouter)
app.use('/api/briefings', messagesRouter)
app.use('/api/goals', goalsRouter)
app.use('/api/exports', exportsRouter)
app.use('/api/auth', authRouter)
app.use('/api/admin', adminRouter)
app.use('/api/notices', noticesRouter)
app.use('/api/accounting', accountingRouter)
app.use('/api/calendar', calendarRouter)

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' })
})

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

export default app
