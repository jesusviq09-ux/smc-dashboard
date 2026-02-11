import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DollarSign, TrendingUp, TrendingDown, Scale, Plus,
  Pencil, Trash2, Save, ExternalLink
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { accountingApi, type Expense, type Income } from '@/services/api/accounting.api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

// ---- helpers ----
const fmt = (n: number) =>
  n.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 })

type Tab = 'gastos' | 'ingresos' | 'resumen'

// ---- Expense form ----
interface ExpenseFormData {
  name: string; pricePerUnit: string; units: string; date: string; productLink: string; payee: string
}
const emptyExpense = (): ExpenseFormData => ({ name: '', pricePerUnit: '', units: '', date: '', productLink: '', payee: '' })

// ---- Income form ----
interface IncomeFormData { amount: string; date: string; concept: string }
const emptyIncome = (): IncomeFormData => ({ amount: '', date: '', concept: '' })

export default function AccountingIndex() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<Tab>('gastos')

  // ---- Expenses state ----
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [editExpense, setEditExpense] = useState<Expense | null>(null)
  const [expenseForm, setExpenseForm] = useState<ExpenseFormData>(emptyExpense())
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null)

  // ---- Incomes state ----
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [editIncome, setEditIncome] = useState<Income | null>(null)
  const [incomeForm, setIncomeForm] = useState<IncomeFormData>(emptyIncome())
  const [deleteIncomeId, setDeleteIncomeId] = useState<string | null>(null)

  // ---- Summary state ----
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear())

  // ---- Queries ----
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: accountingApi.getExpenses })
  const { data: incomes = [] } = useQuery({ queryKey: ['incomes'], queryFn: accountingApi.getIncomes })
  const { data: summary } = useQuery({
    queryKey: ['accounting-summary', selectedYear],
    queryFn: () => accountingApi.getSummary(selectedYear),
  })

  // ---- Mutations ----
  const createExpenseMutation = useMutation({
    mutationFn: accountingApi.createExpense,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['accounting-summary'] }); setShowExpenseForm(false); setExpenseForm(emptyExpense()) },
  })
  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Expense> }) => accountingApi.updateExpense(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['accounting-summary'] }); setEditExpense(null) },
  })
  const deleteExpenseMutation = useMutation({
    mutationFn: accountingApi.deleteExpense,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); qc.invalidateQueries({ queryKey: ['accounting-summary'] }); setDeleteExpenseId(null) },
  })

  const createIncomeMutation = useMutation({
    mutationFn: accountingApi.createIncome,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['incomes'] }); qc.invalidateQueries({ queryKey: ['accounting-summary'] }); setShowIncomeForm(false); setIncomeForm(emptyIncome()) },
  })
  const updateIncomeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Income> }) => accountingApi.updateIncome(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['incomes'] }); qc.invalidateQueries({ queryKey: ['accounting-summary'] }); setEditIncome(null) },
  })
  const deleteIncomeMutation = useMutation({
    mutationFn: accountingApi.deleteIncome,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['incomes'] }); qc.invalidateQueries({ queryKey: ['accounting-summary'] }); setDeleteIncomeId(null) },
  })

  // ---- Computed ----
  const expenseTotal = (f: ExpenseFormData) => {
    const p = parseFloat(f.pricePerUnit) || 0
    const u = parseFloat(f.units) || 0
    return p * u
  }

  const openEditExpense = (e: Expense) => {
    setEditExpense(e)
    setExpenseForm({ name: e.name, pricePerUnit: String(e.pricePerUnit), units: String(e.units), date: e.date, productLink: e.productLink ?? '', payee: e.payee })
    setShowExpenseForm(false)
  }

  const openEditIncome = (i: Income) => {
    setEditIncome(i)
    setIncomeForm({ amount: String(i.amount), date: i.date, concept: i.concept })
    setShowIncomeForm(false)
  }

  const submitExpense = () => {
    const payload = {
      name: expenseForm.name,
      pricePerUnit: parseFloat(expenseForm.pricePerUnit),
      units: parseFloat(expenseForm.units),
      date: expenseForm.date,
      productLink: expenseForm.productLink || undefined,
      payee: expenseForm.payee,
    }
    if (editExpense) {
      updateExpenseMutation.mutate({ id: editExpense.id, data: payload })
    } else {
      createExpenseMutation.mutate(payload as any)
    }
  }

  const submitIncome = () => {
    const payload = { amount: parseFloat(incomeForm.amount), date: incomeForm.date, concept: incomeForm.concept }
    if (editIncome) {
      updateIncomeMutation.mutate({ id: editIncome.id, data: payload })
    } else {
      createIncomeMutation.mutate(payload)
    }
  }

  const expenseFormValid = expenseForm.name.trim() && expenseForm.pricePerUnit && expenseForm.units && expenseForm.date && expenseForm.payee.trim()
  const incomeFormValid = incomeForm.amount && incomeForm.date && incomeForm.concept.trim()

  // ---- Chart data ----
  const chartData = (summary?.byMonth ?? [])
    .filter(m => m.income > 0 || m.expenses > 0)
    .map(m => ({ name: m.month.slice(0, 3), Ingresos: m.income, Gastos: m.expenses }))

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <DollarSign className="w-6 h-6 text-primary" />
        <h1 className="section-title mb-0">Contabilidad</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-smc-border">
        {(['gastos', 'ingresos', 'resumen'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              tab === t ? 'border-primary text-white' : 'border-transparent text-smc-muted hover:text-smc-text'
            }`}
          >
            {t === 'gastos' ? 'Gastos' : t === 'ingresos' ? 'Ingresos' : 'Resumen'}
          </button>
        ))}
      </div>

      {/* ============================================================ */}
      {/* TAB GASTOS */}
      {/* ============================================================ */}
      {tab === 'gastos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-smc-muted">{expenses.length} gasto{expenses.length !== 1 ? 's' : ''} registrado{expenses.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => { setShowExpenseForm(true); setEditExpense(null); setExpenseForm(emptyExpense()) }}
              className="btn-primary text-sm flex items-center gap-1.5 py-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo gasto
            </button>
          </div>

          {/* Create/Edit Expense Form */}
          {(showExpenseForm || editExpense) && (
            <div className="bg-smc-card border border-smc-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">{editExpense ? 'Editar gasto' : 'Nuevo gasto'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="form-label text-xs">Nombre *</label>
                  <input className="input-field" placeholder="Ej: Batería LiPo" value={expenseForm.name} onChange={e => setExpenseForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label text-xs">A quién pagar *</label>
                  <input className="input-field" placeholder="Proveedor o persona" value={expenseForm.payee} onChange={e => setExpenseForm(f => ({ ...f, payee: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label text-xs">Precio/ud (€) *</label>
                  <input type="number" step="0.01" min="0" className="input-field" placeholder="0.00" value={expenseForm.pricePerUnit} onChange={e => setExpenseForm(f => ({ ...f, pricePerUnit: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label text-xs">Unidades *</label>
                  <input type="number" step="0.01" min="0" className="input-field" placeholder="1" value={expenseForm.units} onChange={e => setExpenseForm(f => ({ ...f, units: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label text-xs">Fecha *</label>
                  <input type="date" className="input-field" value={expenseForm.date} onChange={e => setExpenseForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label text-xs">Link producto (opcional)</label>
                  <input className="input-field" placeholder="https://..." value={expenseForm.productLink} onChange={e => setExpenseForm(f => ({ ...f, productLink: e.target.value }))} />
                </div>
              </div>
              {expenseForm.pricePerUnit && expenseForm.units && (
                <p className="text-sm text-smc-muted">
                  Total calculado: <span className="text-white font-semibold">{fmt(expenseTotal(expenseForm))}</span>
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowExpenseForm(false); setEditExpense(null) }} className="btn-secondary text-sm py-1.5">Cancelar</button>
                <button
                  onClick={submitExpense}
                  disabled={!expenseFormValid || createExpenseMutation.isPending || updateExpenseMutation.isPending}
                  className="btn-primary text-sm flex items-center gap-1.5 py-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {editExpense ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {/* Expenses Table */}
          {expenses.length === 0 ? (
            <div className="bg-smc-card border border-smc-border rounded-xl p-8 text-center text-smc-muted text-sm">
              No hay gastos registrados.
            </div>
          ) : (
            <div className="bg-smc-card border border-smc-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-smc-border">
                      <th className="text-left px-4 py-3 text-xs text-smc-muted font-medium">Nombre</th>
                      <th className="text-right px-4 py-3 text-xs text-smc-muted font-medium">Precio/ud</th>
                      <th className="text-right px-4 py-3 text-xs text-smc-muted font-medium">Uds</th>
                      <th className="text-right px-4 py-3 text-xs text-smc-muted font-medium">Total</th>
                      <th className="text-left px-4 py-3 text-xs text-smc-muted font-medium">Fecha</th>
                      <th className="text-left px-4 py-3 text-xs text-smc-muted font-medium">Pagado a</th>
                      <th className="text-center px-4 py-3 text-xs text-smc-muted font-medium">Link</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e, idx) => (
                      <tr key={e.id} className={`border-b border-smc-border/50 ${idx % 2 === 0 ? '' : 'bg-smc-darker/30'}`}>
                        <td className="px-4 py-3 text-white font-medium">{e.name}</td>
                        <td className="px-4 py-3 text-right text-smc-text">{fmt(e.pricePerUnit)}</td>
                        <td className="px-4 py-3 text-right text-smc-text">{e.units}</td>
                        <td className="px-4 py-3 text-right font-semibold text-danger">{fmt(e.total)}</td>
                        <td className="px-4 py-3 text-smc-muted">{new Date(e.date).toLocaleDateString('es-ES')}</td>
                        <td className="px-4 py-3 text-smc-text">{e.payee}</td>
                        <td className="px-4 py-3 text-center">
                          {e.productLink ? (
                            <a href={e.productLink} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                              <ExternalLink className="w-3.5 h-3.5 inline" />
                            </a>
                          ) : (
                            <span className="text-smc-muted text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => openEditExpense(e)} className="p-1.5 rounded-lg text-smc-muted hover:text-smc-text hover:bg-smc-border transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteExpenseId(e.id)} className="p-1.5 rounded-lg text-smc-muted hover:text-danger hover:bg-danger/10 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-smc-border bg-smc-darker/50">
                      <td colSpan={3} className="px-4 py-3 text-xs text-smc-muted font-medium">Total gastos</td>
                      <td className="px-4 py-3 text-right font-bold text-danger">
                        {fmt(expenses.reduce((s, e) => s + e.total, 0))}
                      </td>
                      <td colSpan={4} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB INGRESOS */}
      {/* ============================================================ */}
      {tab === 'ingresos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-smc-muted">{incomes.length} ingreso{incomes.length !== 1 ? 's' : ''} registrado{incomes.length !== 1 ? 's' : ''}</p>
            <button
              onClick={() => { setShowIncomeForm(true); setEditIncome(null); setIncomeForm(emptyIncome()) }}
              className="btn-primary text-sm flex items-center gap-1.5 py-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Nuevo ingreso
            </button>
          </div>

          {/* Create/Edit Income Form */}
          {(showIncomeForm || editIncome) && (
            <div className="bg-smc-card border border-smc-border rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">{editIncome ? 'Editar ingreso' : 'Nuevo ingreso'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="form-label text-xs">Cantidad (€) *</label>
                  <input type="number" step="0.01" min="0" className="input-field" placeholder="0.00" value={incomeForm.amount} onChange={e => setIncomeForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label text-xs">Fecha *</label>
                  <input type="date" className="input-field" value={incomeForm.date} onChange={e => setIncomeForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <label className="form-label text-xs">Concepto/Nombre *</label>
                  <input className="input-field" placeholder="Ej: Patrocinador Club" value={incomeForm.concept} onChange={e => setIncomeForm(f => ({ ...f, concept: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowIncomeForm(false); setEditIncome(null) }} className="btn-secondary text-sm py-1.5">Cancelar</button>
                <button
                  onClick={submitIncome}
                  disabled={!incomeFormValid || createIncomeMutation.isPending || updateIncomeMutation.isPending}
                  className="btn-primary text-sm flex items-center gap-1.5 py-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {editIncome ? 'Actualizar' : 'Guardar'}
                </button>
              </div>
            </div>
          )}

          {/* Incomes Table */}
          {incomes.length === 0 ? (
            <div className="bg-smc-card border border-smc-border rounded-xl p-8 text-center text-smc-muted text-sm">
              No hay ingresos registrados.
            </div>
          ) : (
            <div className="bg-smc-card border border-smc-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-smc-border">
                      <th className="text-left px-4 py-3 text-xs text-smc-muted font-medium">Concepto</th>
                      <th className="text-right px-4 py-3 text-xs text-smc-muted font-medium">Cantidad</th>
                      <th className="text-left px-4 py-3 text-xs text-smc-muted font-medium">Fecha</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {incomes.map((i, idx) => (
                      <tr key={i.id} className={`border-b border-smc-border/50 ${idx % 2 === 0 ? '' : 'bg-smc-darker/30'}`}>
                        <td className="px-4 py-3 text-white font-medium">{i.concept}</td>
                        <td className="px-4 py-3 text-right font-semibold text-success">{fmt(i.amount)}</td>
                        <td className="px-4 py-3 text-smc-muted">{new Date(i.date).toLocaleDateString('es-ES')}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-end">
                            <button onClick={() => openEditIncome(i)} className="p-1.5 rounded-lg text-smc-muted hover:text-smc-text hover:bg-smc-border transition-colors">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDeleteIncomeId(i.id)} className="p-1.5 rounded-lg text-smc-muted hover:text-danger hover:bg-danger/10 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-smc-border bg-smc-darker/50">
                      <td className="px-4 py-3 text-xs text-smc-muted font-medium">Total ingresos</td>
                      <td className="px-4 py-3 text-right font-bold text-success">
                        {fmt(incomes.reduce((s, i) => s + i.amount, 0))}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB RESUMEN */}
      {/* ============================================================ */}
      {tab === 'resumen' && (
        <div className="space-y-6">
          {/* Year selector */}
          <div className="flex items-center gap-3">
            <label className="text-sm text-smc-muted">Año:</label>
            <select
              className="input-field py-1 text-sm w-28"
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
            >
              {(summary?.availableYears ?? [new Date().getFullYear()]).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {/* Year totals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-smc-muted">Total ingresos {selectedYear}</p>
                    <p className="text-lg font-bold text-success">{fmt(summary?.yearTotal.income ?? 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-danger/10 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-danger" />
                  </div>
                  <div>
                    <p className="text-xs text-smc-muted">Total gastos {selectedYear}</p>
                    <p className="text-lg font-bold text-danger">{fmt(summary?.yearTotal.expenses ?? 0)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${(summary?.yearTotal.balance ?? 0) >= 0 ? 'bg-success/10' : 'bg-danger/10'}`}>
                    <Scale className={`w-5 h-5 ${(summary?.yearTotal.balance ?? 0) >= 0 ? 'text-success' : 'text-danger'}`} />
                  </div>
                  <div>
                    <p className="text-xs text-smc-muted">Balance {selectedYear}</p>
                    <p className={`text-lg font-bold ${(summary?.yearTotal.balance ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                      {fmt(summary?.yearTotal.balance ?? 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bar chart */}
          {chartData.length > 0 && (
            <Card title="Ingresos vs Gastos por mes">
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a2a3a" />
                    <XAxis dataKey="name" tick={{ fill: '#8888aa', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#8888aa', fontSize: 11 }} tickFormatter={v => `${v}€`} />
                    <Tooltip
                      contentStyle={{ background: '#1a1a2e', border: '1px solid #2a2a3a', borderRadius: 8 }}
                      labelStyle={{ color: '#ffffff' }}
                      formatter={(v: number) => fmt(v)}
                    />
                    <Legend wrapperStyle={{ color: '#8888aa', fontSize: 12 }} />
                    <Bar dataKey="Ingresos" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Gastos" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Monthly table */}
          <Card title={`Tabla mensual ${selectedYear}`}>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-smc-border">
                      <th className="text-left px-4 py-3 text-xs text-smc-muted font-medium">Mes</th>
                      <th className="text-right px-4 py-3 text-xs text-smc-muted font-medium">Ingresos</th>
                      <th className="text-right px-4 py-3 text-xs text-smc-muted font-medium">Gastos</th>
                      <th className="text-right px-4 py-3 text-xs text-smc-muted font-medium">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary?.byMonth ?? []).map((m, idx) => (
                      <tr key={m.monthKey} className={`border-b border-smc-border/50 ${idx % 2 === 0 ? '' : 'bg-smc-darker/30'}`}>
                        <td className="px-4 py-3 text-smc-text font-medium">{m.month}</td>
                        <td className={`px-4 py-3 text-right ${m.income > 0 ? 'text-success' : 'text-smc-muted'}`}>{m.income > 0 ? fmt(m.income) : '—'}</td>
                        <td className={`px-4 py-3 text-right ${m.expenses > 0 ? 'text-danger' : 'text-smc-muted'}`}>{m.expenses > 0 ? fmt(m.expenses) : '—'}</td>
                        <td className={`px-4 py-3 text-right font-semibold ${m.balance > 0 ? 'text-success' : m.balance < 0 ? 'text-danger' : 'text-smc-muted'}`}>
                          {m.income === 0 && m.expenses === 0 ? '—' : fmt(m.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-smc-border bg-smc-darker/50">
                      <td className="px-4 py-3 font-semibold text-white">Total {selectedYear}</td>
                      <td className="px-4 py-3 text-right font-bold text-success">{fmt(summary?.yearTotal.income ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-bold text-danger">{fmt(summary?.yearTotal.expenses ?? 0)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${(summary?.yearTotal.balance ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>
                        {fmt(summary?.yearTotal.balance ?? 0)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ============================================================ */}
      {/* DELETE MODALS */}
      {/* ============================================================ */}
      {deleteExpenseId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-smc-card border border-smc-border rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-white mb-2">¿Eliminar este gasto?</h3>
            <p className="text-sm text-smc-muted mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteExpenseId(null)} className="btn-secondary text-sm py-1.5">Cancelar</button>
              <button onClick={() => deleteExpenseMutation.mutate(deleteExpenseId!)} disabled={deleteExpenseMutation.isPending} className="btn-danger text-sm py-1.5">
                {deleteExpenseMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {deleteIncomeId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-smc-card border border-smc-border rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-white mb-2">¿Eliminar este ingreso?</h3>
            <p className="text-sm text-smc-muted mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteIncomeId(null)} className="btn-secondary text-sm py-1.5">Cancelar</button>
              <button onClick={() => deleteIncomeMutation.mutate(deleteIncomeId!)} disabled={deleteIncomeMutation.isPending} className="btn-danger text-sm py-1.5">
                {deleteIncomeMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
