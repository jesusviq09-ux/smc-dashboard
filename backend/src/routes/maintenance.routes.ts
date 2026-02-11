import { Router, Request, Response } from 'express'
import { MaintenanceRecord, SparePart, Vehicle } from '../models/index'

const router = Router()

// GET /maintenance/alerts
router.get('/alerts', async (_req: Request, res: Response) => {
  const vehicles = await Vehicle.findAll()
  const alerts: object[] = []

  for (const vehicle of vehicles) {
    // Check overdue maintenance
    const overdueRecords = await MaintenanceRecord.findAll({
      where: {
        vehicleId: vehicle.id,
        completed: false,
      },
    })

    for (const record of overdueRecords) {
      if (record.nextServiceDate && new Date(record.nextServiceDate) <= new Date()) {
        alerts.push({
          id: record.id,
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          type: 'overdue',
          message: `${vehicle.name}: ${record.description} (vencido el ${record.nextServiceDate})`,
          severity: 'red',
        })
      } else if (record.nextServiceDate) {
        const daysUntil = Math.floor((new Date(record.nextServiceDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        if (daysUntil <= 7) {
          alerts.push({
            id: record.id,
            vehicleId: vehicle.id,
            vehicleName: vehicle.name,
            type: 'upcoming',
            message: `${vehicle.name}: ${record.description} en ${daysUntil} días`,
            severity: 'yellow',
          })
        }
      }
    }
  }

  // Check low stock parts
  const lowStockParts = await SparePart.findAll()
  for (const part of lowStockParts) {
    if (part.stock <= part.minStock) {
      alerts.push({
        id: `stock_${part.id}`,
        vehicleId: part.vehicleId || 'shared',
        vehicleName: 'Almacén',
        type: 'low_stock',
        message: `Stock bajo: ${part.name} (${part.stock} ${part.unit} restantes, mínimo ${part.minStock})`,
        severity: part.stock === 0 ? 'red' : 'yellow',
      })
    }
  }

  res.json(alerts)
})

// GET /maintenance
router.get('/', async (req: Request, res: Response) => {
  const where = req.query.vehicleId ? { vehicleId: req.query.vehicleId } : {}
  const records = await MaintenanceRecord.findAll({ where, order: [['date', 'DESC']] })
  res.json(records)
})

// POST /maintenance
router.post('/', async (req: Request, res: Response) => {
  const record = await MaintenanceRecord.create(req.body)
  res.status(201).json(record)
})

// PUT /maintenance/:id
router.put('/:id', async (req: Request, res: Response) => {
  const record = await MaintenanceRecord.findByPk(req.params.id)
  if (!record) return res.status(404).json({ error: 'Record not found' })
  await record.update(req.body)
  res.json(record)
})

// DELETE /maintenance/:id
router.delete('/:id', async (req: Request, res: Response) => {
  const record = await MaintenanceRecord.findByPk(req.params.id)
  if (!record) return res.status(404).json({ error: 'Record not found' })
  await record.destroy()
  res.status(204).send()
})

// GET /maintenance/parts
router.get('/parts', async (_req: Request, res: Response) => {
  const parts = await SparePart.findAll({ order: [['name', 'ASC']] })
  res.json(parts)
})

// POST /maintenance/parts
router.post('/parts', async (req: Request, res: Response) => {
  const part = await SparePart.create(req.body)
  res.status(201).json(part)
})

// PUT /maintenance/parts/:id
router.put('/parts/:id', async (req: Request, res: Response) => {
  const part = await SparePart.findByPk(req.params.id)
  if (!part) return res.status(404).json({ error: 'Part not found' })
  await part.update(req.body)
  res.json(part)
})

export default router
