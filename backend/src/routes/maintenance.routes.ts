import { Router, Request, Response } from 'express'
import { MaintenanceRecord, SparePart, Vehicle, User } from '../models/index'
import { sendLowStockAlert } from '../utils/mailer'

const router = Router()

// GET /maintenance/alerts
router.get('/alerts', async (_req: Request, res: Response) => {
  try {
    const vehicles = await Vehicle.findAll()
    const alerts: object[] = []

    for (const vehicle of vehicles) {
      const overdueRecords = await MaintenanceRecord.findAll({
        where: { vehicleId: vehicle.id, completed: false },
      })

      for (const record of overdueRecords) {
        if (record.nextServiceDate && new Date(record.nextServiceDate) <= new Date()) {
          alerts.push({
            id: record.id, vehicleId: vehicle.id, vehicleName: vehicle.name,
            type: 'overdue',
            message: `${vehicle.name}: ${record.description} (vencido el ${record.nextServiceDate})`,
            severity: 'red',
          })
        } else if (record.nextServiceDate) {
          const daysUntil = Math.floor((new Date(record.nextServiceDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          if (daysUntil <= 7) {
            alerts.push({
              id: record.id, vehicleId: vehicle.id, vehicleName: vehicle.name,
              type: 'upcoming',
              message: `${vehicle.name}: ${record.description} en ${daysUntil} días`,
              severity: 'yellow',
            })
          }
        }
      }
    }

    const lowStockParts = await SparePart.findAll()
    for (const part of lowStockParts) {
      if (part.stock <= part.minStock) {
        alerts.push({
          id: `stock_${part.id}`,
          vehicleId: part.vehicleId || 'shared',
          vehicleName: 'Almacén',
          type: 'low_stock',
          message: `Stock bajo: ${part.name} (${part.stock} ${part.unit} restantes, mínimo ${part.minStock})`,
          severity: part.stock === 0 ? 'red' : part.stock < part.minStock ? 'red' : 'yellow',
        })
      }
    }

    res.json(alerts)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// GET /maintenance
router.get('/', async (req: Request, res: Response) => {
  try {
    const where = req.query.vehicleId ? { vehicleId: req.query.vehicleId } : {}
    const records = await MaintenanceRecord.findAll({ where, order: [['date', 'DESC']] })
    res.json(records)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// POST /maintenance
router.post('/', async (req: Request, res: Response) => {
  try {
    const record = await MaintenanceRecord.create(req.body)
    res.status(201).json(record)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// PUT /maintenance/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const record = await MaintenanceRecord.findByPk(req.params.id)
    if (!record) return res.status(404).json({ error: 'Record not found' })
    await record.update(req.body)
    res.json(record)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// DELETE /maintenance/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const record = await MaintenanceRecord.findByPk(req.params.id)
    if (!record) return res.status(404).json({ error: 'Record not found' })
    await record.destroy()
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// GET /maintenance/parts
router.get('/parts', async (_req: Request, res: Response) => {
  try {
    const parts = await SparePart.findAll({ order: [['name', 'ASC']] })
    res.json(parts)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// POST /maintenance/parts
router.post('/parts', async (req: Request, res: Response) => {
  try {
    const part = await SparePart.create(req.body)
    // Check stock on creation
    if (part.stock <= part.minStock) {
      const recipients = await User.findAll({ where: { receiveEmails: true } })
      const emails = [...new Set(recipients.map((u: any) => u.email))]
      if (emails.length > 0) sendLowStockAlert(part, emails).catch(console.error)
    }
    res.status(201).json(part)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// PUT /maintenance/parts/:id
router.put('/parts/:id', async (req: Request, res: Response) => {
  try {
    const part = await SparePart.findByPk(req.params.id)
    if (!part) return res.status(404).json({ error: 'Part not found' })
    await part.update(req.body)
    // Send email notification if stock is at or below minimum
    if (part.stock <= part.minStock) {
      const recipients = await User.findAll({ where: { receiveEmails: true } })
      const emails = [...new Set(recipients.map((u: any) => u.email))]
      if (emails.length > 0) sendLowStockAlert(part, emails).catch(console.error)
    }
    res.json(part)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// DELETE /maintenance/parts/:id
router.delete('/parts/:id', async (req: Request, res: Response) => {
  try {
    const part = await SparePart.findByPk(req.params.id)
    if (!part) return res.status(404).json({ error: 'Part not found' })
    await part.destroy()
    res.status(204).send()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

export default router
