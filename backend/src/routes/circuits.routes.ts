import { Router, Request, Response } from 'express'
import { Circuit } from '../models/index'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  const circuits = await Circuit.findAll({ order: [['name', 'ASC']] })
  res.json(circuits)
})

router.get('/:id', async (req: Request, res: Response) => {
  const circuit = await Circuit.findByPk(req.params.id)
  if (!circuit) return res.status(404).json({ error: 'Circuit not found' })
  res.json(circuit)
})

router.post('/', async (req: Request, res: Response) => {
  const circuit = await Circuit.create(req.body)
  res.status(201).json(circuit)
})

router.put('/:id', async (req: Request, res: Response) => {
  const circuit = await Circuit.findByPk(req.params.id)
  if (!circuit) return res.status(404).json({ error: 'Circuit not found' })
  await circuit.update(req.body)
  res.json(circuit)
})

router.delete('/:id', async (req: Request, res: Response) => {
  const circuit = await Circuit.findByPk(req.params.id)
  if (!circuit) return res.status(404).json({ error: 'Circuit not found' })
  await circuit.destroy()
  res.status(204).send()
})

router.get('/:id/records', async (req: Request, res: Response) => {
  res.json([]) // To be implemented with CircuitRecord model
})

router.get('/:id/predict/:vehicleId', async (req: Request, res: Response) => {
  // Simple prediction: return average of last 3 records
  res.json({ predictedTimeSeconds: null, confidence: 'low', message: 'No hay suficientes datos para predicción' })
})

export default router
