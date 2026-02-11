import { Router, Request, Response } from 'express'
import { TelemetryReading } from '../models/index'

const router = Router()

// SSE: Live telemetry stream
router.get('/live/:deviceId', (req: Request, res: Response) => {
  const { deviceId } = req.params

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  // Send a keepalive every 15s
  const keepalive = setInterval(() => {
    res.write(': keepalive\n\n')
  }, 15000)

  // In real integration with Echook, this would poll their API
  // and forward data to the client via SSE
  // For now, send mock data if Echook not configured
  const mockInterval = setInterval(() => {
    const reading = {
      id: crypto.randomUUID(),
      deviceId,
      voltage: 24 + (Math.random() - 0.5) * 2,
      current: 15 + (Math.random() - 0.5) * 5,
      temperature: 35 + Math.random() * 10,
      speed: 40 + Math.random() * 20,
      timestamp: new Date().toISOString(),
    }
    res.write(`data: ${JSON.stringify(reading)}\n\n`)
  }, 2000)

  req.on('close', () => {
    clearInterval(keepalive)
    clearInterval(mockInterval)
    res.end()
  })
})

// GET /telemetry/session/:type/:id
router.get('/session/:type/:sessionId', async (req: Request, res: Response) => {
  const readings = await TelemetryReading.findAll({
    where: { sessionId: req.params.sessionId, sessionType: req.params.type },
    order: [['timestamp', 'ASC']],
  })
  res.json(readings)
})

// POST /telemetry/batch - Store batch of readings
router.post('/batch', async (req: Request, res: Response) => {
  const readings = req.body
  if (!Array.isArray(readings)) return res.status(400).json({ error: 'Expected array' })
  await TelemetryReading.bulkCreate(readings, { ignoreDuplicates: true })
  res.json({ stored: readings.length })
})

// POST /telemetry/webhook - Echook webhook endpoint
router.post('/webhook', async (req: Request, res: Response) => {
  const data = req.body
  // Parse Echook webhook payload
  try {
    const reading = {
      deviceId: data.device_id || data.deviceId || 'unknown',
      vehicleId: data.vehicle_id,
      voltage: parseFloat(data.voltage || data.v || 0),
      current: parseFloat(data.current || data.a || 0),
      temperature: parseFloat(data.temperature || data.temp || 0),
      speed: parseFloat(data.speed || data.kmh || 0),
      gpsLat: data.lat ? parseFloat(data.lat) : null,
      gpsLon: data.lon ? parseFloat(data.lon) : null,
      timestamp: data.timestamp || new Date().toISOString(),
    }
    await TelemetryReading.create(reading)
    res.json({ received: true })
  } catch (err) {
    res.status(400).json({ error: 'Invalid payload' })
  }
})

export default router
