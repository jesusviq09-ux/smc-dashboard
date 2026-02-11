import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Target, CheckCircle2, Clock, AlertCircle, Trash2, Pencil } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { goalsApi } from '@/services/api/goals.api'
import type { Goal, GoalStatus } from '@/types'

const VEHICLES = [
  { id: '', label: 'Todos los coches' },
  { id: 'smc01', label: 'SMC 01' },
  { id: 'smc02', label: 'SMC 02 EVO' },
]

type GoalStatusExt = GoalStatus | 'pending'

const STATUS_CONFIG: Record<GoalStatusExt, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; badge: string }> = {
  pending: { label: 'Pendiente', icon: Clock, color: 'text-smc-muted', badge: 'badge-gray' },
  in_progress: { label: 'En curso', icon: AlertCircle, color: 'text-warning', badge: 'badge-yellow' },
  completed: { label: 'Completado', icon: CheckCircle2, color: 'text-success', badge: 'badge-green' },
  overdue: { label: 'Vencido', icon: AlertCircle, color: 'text-danger', badge: 'badge-red' },
}

const TYPE_COLORS: Record<string, string> = {
  pilot: '#00d4ff',
  team: '#a855f7',
}

export default function GoalsIndex() {
  const qc = useQueryClient()
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter] = useState<'all' | GoalStatus>('all')
  const [vehicleFilter, setVehicleFilter] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [form, setForm] = useState({ title: '', description: '', type: 'team' as 'pilot' | 'team', deadline: '', pilotId: '', vehicleId: '' })
  const [editGoal, setEditGoal] = useState<Goal | null>(null)
  const [editForm, setEditForm] = useState({ title: '', description: '', type: 'team' as 'pilot' | 'team', deadline: '', vehicleId: '' })
  const [editError, setEditError] = useState<string | null>(null)

  const { data: goals = [], isLoading } = useQuery({ queryKey: ['goals'], queryFn: goalsApi.getAll })

  const saveMutation = useMutation({
    mutationFn: goalsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setShowNew(false); resetForm(); setSaveError(null) },
    onError: (err: any) => setSaveError(err?.response?.data?.error || err?.message || 'Error al guardar el objetivo'),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Goal> }) => goalsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); setEditGoal(null); setEditError(null) },
    onError: (err: any) => setEditError(err?.response?.data?.error || err?.message || 'Error al actualizar el objetivo'),
  })
  const deleteMutation = useMutation({
    mutationFn: goalsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  })

  const resetForm = () => setForm({ title: '', description: '', type: 'team', deadline: '', pilotId: '', vehicleId: '' })

  const openEditGoal = (goal: Goal) => {
    setEditForm({
      title: goal.title,
      description: goal.description ?? '',
      type: goal.type as 'pilot' | 'team',
      deadline: goal.deadline?.slice(0, 10) ?? '',
      vehicleId: (goal as any).vehicleId ?? '',
    })
    setEditError(null)
    setEditGoal(goal)
  }

  const filtered = goals
    .filter(g => filter === 'all' || g.status === filter)
    .filter(g => !vehicleFilter || (g as any).vehicleId === vehicleFilter)
  const counts = {
    all: goals.length,
    in_progress: goals.filter(g => g.status === 'in_progress').length,
    completed: goals.filter(g => g.status === 'completed').length,
    overdue: goals.filter(g => g.status === 'overdue').length,
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="section-title mb-0">Objetivos del equipo</h1>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo objetivo
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap items-center">
        {([['all', 'Todos'], ['in_progress', 'En curso'], ['completed', 'Completado'], ['overdue', 'Vencido']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filter === val ? 'bg-primary text-smc-dark' : 'bg-smc-card text-smc-muted border border-smc-border hover:text-smc-text'}`}>
            {label} ({counts[val as keyof typeof counts] ?? 0})
          </button>
        ))}
        <div className="ml-auto">
          <select className="input-field py-1 text-xs" value={vehicleFilter} onChange={e => setVehicleFilter(e.target.value)}>
            {VEHICLES.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
      </div>

      {showNew && (
        <Card title="Nuevo objetivo">
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="form-label">Título *</label>
                <input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Ej: Reducir tiempo de vuelta 5%" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Tipo</label>
                  <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as 'pilot' | 'team' }))}>
                    <option value="team">Equipo</option>
                    <option value="pilot">Piloto</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Coche (opcional)</label>
                  <select className="input-field" value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                    <option value="">Sin coche específico</option>
                    <option value="smc01">SMC 01</option>
                    <option value="smc02">SMC 02 EVO</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="form-label">Fecha límite *</label>
                  <input type="date" className="input-field" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="form-label">Descripción</label>
                <textarea className="input-field min-h-[70px]" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              {saveError && (
                <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {saveError}
                </div>
              )}
              <div className="flex gap-2 justify-end">
                <button onClick={() => { setShowNew(false); resetForm(); setSaveError(null) }} className="btn-secondary">Cancelar</button>
                <button onClick={() => saveMutation.mutate({
                  ...form,
                  status: 'in_progress',
                  progress: 0,
                  metric: '',
                  currentValue: 0,
                  targetValue: 100,
                  unit: '',
                } as any)}
                  disabled={!form.title || !form.deadline || saveMutation.isPending} className="btn-primary">
                  {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-smc-muted">
          <Target className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Sin objetivos {filter !== 'all' ? `con estado "${STATUS_CONFIG[filter as GoalStatusExt]?.label}"` : 'registrados'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(goal => {
            const statusKey = (goal.status as GoalStatusExt) in STATUS_CONFIG ? (goal.status as GoalStatusExt) : 'in_progress'
            const cfg = STATUS_CONFIG[statusKey]
            const Icon = cfg.icon
            const typeColor = TYPE_COLORS[goal.type] ?? '#8b949e'
            return (
              <div key={goal.id} className="bg-smc-card border border-smc-border rounded-xl p-4 hover:border-smc-border/60 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-1 self-stretch rounded-full flex-shrink-0" style={{ backgroundColor: typeColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-semibold text-smc-text">{goal.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full bg-smc-dark border border-smc-border ${cfg.color}`}>
                        <Icon className="w-3 h-3 inline mr-1" />{cfg.label}
                      </span>
                    </div>
                    {goal.description && <p className="text-sm text-smc-muted mb-2">{goal.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-smc-muted">
                      <span className="capitalize">{goal.type}</span>
                      {goal.deadline && <span>Límite: {goal.deadline.slice(0, 10)}</span>}
                    </div>
                    {goal.progress !== undefined && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-smc-muted mb-1">
                          <span>Progreso</span><span>{goal.progress}%</span>
                        </div>
                        <div className="h-1.5 bg-smc-dark rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${goal.progress}%`, backgroundColor: typeColor }} />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {goal.status !== 'completed' && (
                      <button onClick={() => updateMutation.mutate({ id: goal.id, data: { status: 'completed', progress: 100 } })}
                        className="text-smc-muted hover:text-success p-1 rounded" title="Marcar completado">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => openEditGoal(goal)} className="text-smc-muted hover:text-primary p-1 rounded" title="Editar">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(goal.id)} className="text-smc-muted hover:text-danger p-1 rounded">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit goal modal */}
      {editGoal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-smc-card rounded-xl p-6 max-w-md w-full space-y-4 border border-smc-border">
            <h3 className="font-semibold text-smc-text">Editar objetivo</h3>

            <div>
              <label className="form-label">Título *</label>
              <input type="text" className="input-field" value={editForm.title}
                onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Tipo</label>
                <select className="input-field" value={editForm.type}
                  onChange={e => setEditForm(f => ({ ...f, type: e.target.value as 'pilot' | 'team' }))}>
                  <option value="team">Equipo</option>
                  <option value="pilot">Piloto</option>
                </select>
              </div>
              <div>
                <label className="form-label">Coche (opcional)</label>
                <select className="input-field" value={editForm.vehicleId}
                  onChange={e => setEditForm(f => ({ ...f, vehicleId: e.target.value }))}>
                  <option value="">Sin coche específico</option>
                  <option value="smc01">SMC 01</option>
                  <option value="smc02">SMC 02 EVO</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="form-label">Fecha límite *</label>
                <input type="date" className="input-field" value={editForm.deadline}
                  onChange={e => setEditForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="form-label">Descripción</label>
              <textarea className="input-field min-h-[70px]" value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
            </div>

            {editError && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {editError}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => { setEditGoal(null); setEditError(null) }} className="btn-secondary">Cancelar</button>
              <button
                onClick={() => updateMutation.mutate({ id: editGoal.id, data: editForm })}
                disabled={!editForm.title || !editForm.deadline || updateMutation.isPending}
                className="btn-primary"
              >
                {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
