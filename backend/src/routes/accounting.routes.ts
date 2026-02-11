import { Router, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { Expense, Income } from '../models/index'
import { Op } from 'sequelize'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'smc-dashboard-secret-change-in-prod'

// Middleware: require valid JWT
function requireAuth(req: Request, res: Response, next: Function) {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No autenticado' })
    const token = authHeader.slice(7)
    const decoded = jwt.verify(token, JWT_SECRET) as any
    ;(req as any).user = decoded
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

// ============================================================
// EXPENSES
// ============================================================

// GET /api/accounting/expenses
router.get('/expenses', requireAuth, async (_req: Request, res: Response) => {
  try {
    const expenses = await Expense.findAll({ order: [['date', 'DESC']] })
    res.json(expenses)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// POST /api/accounting/expenses
router.post('/expenses', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name, pricePerUnit, units, date, productLink, payee } = req.body
    const total = Number(pricePerUnit) * Number(units)
    const expense = await Expense.create({ name, pricePerUnit: Number(pricePerUnit), units: Number(units), total, date, productLink: productLink || null, payee })
    res.status(201).json(expense)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// PUT /api/accounting/expenses/:id
router.put('/expenses/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findByPk(req.params.id)
    if (!expense) return res.status(404).json({ error: 'Gasto no encontrado' })
    const { name, pricePerUnit, units, date, productLink, payee } = req.body
    const total = Number(pricePerUnit) * Number(units)
    await expense.update({ name, pricePerUnit: Number(pricePerUnit), units: Number(units), total, date, productLink: productLink || null, payee })
    res.json(expense)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// DELETE /api/accounting/expenses/:id
router.delete('/expenses/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const expense = await Expense.findByPk(req.params.id)
    if (!expense) return res.status(404).json({ error: 'Gasto no encontrado' })
    await expense.destroy()
    res.status(204).end()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// ============================================================
// INCOMES
// ============================================================

// GET /api/accounting/incomes
router.get('/incomes', requireAuth, async (_req: Request, res: Response) => {
  try {
    const incomes = await Income.findAll({ order: [['date', 'DESC']] })
    res.json(incomes)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// POST /api/accounting/incomes
router.post('/incomes', requireAuth, async (req: Request, res: Response) => {
  try {
    const { amount, date, concept } = req.body
    const income = await Income.create({ amount: Number(amount), date, concept })
    res.status(201).json(income)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// PUT /api/accounting/incomes/:id
router.put('/incomes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const income = await Income.findByPk(req.params.id)
    if (!income) return res.status(404).json({ error: 'Ingreso no encontrado' })
    const { amount, date, concept } = req.body
    await income.update({ amount: Number(amount), date, concept })
    res.json(income)
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// DELETE /api/accounting/incomes/:id
router.delete('/incomes/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const income = await Income.findByPk(req.params.id)
    if (!income) return res.status(404).json({ error: 'Ingreso no encontrado' })
    await income.destroy()
    res.status(204).end()
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

// ============================================================
// SUMMARY
// ============================================================

// GET /api/accounting/summary?year=2025
router.get('/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear()

    const expenses = await Expense.findAll({
      where: {
        date: {
          [Op.gte]: `${year}-01-01`,
          [Op.lte]: `${year}-12-31`,
        },
      },
      order: [['date', 'ASC']],
    })
    const incomes = await Income.findAll({
      where: {
        date: {
          [Op.gte]: `${year}-01-01`,
          [Op.lte]: `${year}-12-31`,
        },
      },
      order: [['date', 'ASC']],
    })

    // Build monthly summary
    const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const byMonth = months.map((monthName, idx) => {
      const m = String(idx + 1).padStart(2, '0')
      const monthExpenses = expenses
        .filter(e => e.date.startsWith(`${year}-${m}`))
        .reduce((sum, e) => sum + e.total, 0)
      const monthIncome = incomes
        .filter(i => i.date.startsWith(`${year}-${m}`))
        .reduce((sum, i) => sum + i.amount, 0)
      return {
        month: monthName,
        monthKey: `${year}-${m}`,
        expenses: Math.round(monthExpenses * 100) / 100,
        income: Math.round(monthIncome * 100) / 100,
        balance: Math.round((monthIncome - monthExpenses) * 100) / 100,
      }
    })

    const totalExpenses = expenses.reduce((sum, e) => sum + e.total, 0)
    const totalIncome = incomes.reduce((sum, i) => sum + i.amount, 0)

    // Available years from data
    const allExpenses = await Expense.findAll({ attributes: ['date'] })
    const allIncomes = await Income.findAll({ attributes: ['date'] })
    const yearsSet = new Set<number>()
    allExpenses.forEach(e => yearsSet.add(Number(e.date.substring(0, 4))))
    allIncomes.forEach(i => yearsSet.add(Number(i.date.substring(0, 4))))
    yearsSet.add(new Date().getFullYear())
    const availableYears = Array.from(yearsSet).sort((a, b) => b - a)

    res.json({
      year,
      byMonth,
      yearTotal: {
        expenses: Math.round(totalExpenses * 100) / 100,
        income: Math.round(totalIncome * 100) / 100,
        balance: Math.round((totalIncome - totalExpenses) * 100) / 100,
      },
      availableYears,
    })
  } catch (err: any) {
    console.error(err)
    res.status(500).json({ error: err.message || 'Error interno' })
  }
})

export default router
