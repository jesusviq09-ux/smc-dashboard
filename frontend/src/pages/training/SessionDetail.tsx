import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Plus, Activity, Clock, Zap, Thermometer, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { trainingApi } from '@/services/api/training.api'
import { Card, CardContent } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { calculateLapStats, formatLapTime } from '@/utils/lapStatistics'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function SessionDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [stintModal, setStintModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editForm, setEditForm] = useState({ date: '', locationId: '', vehicleId: '', durationMinutes: 0, notes: '' })
  const [lapInput, setLapInput] = useState('')
  const [telemetry, setTelemetry] = useState({
    voltageInitial: '', voltageFinal: '', currentAvg: '',
    motorTempMax: '', batteryConsumptionWh: '',
  })
  const [selectedPilotId, setSelectedPilotId] = useState('')
  const [stintNotes, setStintNotes] = useState('')

  const { data: session, isLoading } = useQuery({
    queryKey: ['training-session', id],
    queryFn: () => trainingApi.getSession(id!),
    enabled: !!id,
  })

  const addStintMutation = useMutation({
    mutationFn: (data: Parameters<typeof trainingApi.addStint>[1]) =>
      trainingApi.addStint(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-session', id] })
      setStintModal(false)
      setLapInput('')
    },
  })

  const completeMutation = useMutation({
    mutationFn: () => trainingApi.updateSession(id!, { status: 'completed' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['training-session', id] }),
  })

  const editMutation = useMutation({
    mutationFn: () => trainingApi.updateSession(id!, {
      date: editForm.date,
      locationId: editForm.locationId,
      vehicleId: editForm.vehicleId as 'smc01' | 'smc02',
      durationMinutes: Number(editForm.durationMinutes),
      notes: editForm.notes,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-session', id] })
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] })
      setEditModal(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => trainingApi.deleteSession(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] })
      navigate('/training')
    },
  })

  const openEdit = () => {
    if (!session) return
    setEditForm({
      date: session.date?.slice(0, 10) ?? '',
      locationId: session.locationId ?? '',
      vehicleId: session.vehicleId ?? 'smc01',
      durationMinutes: session.durationMinutes ?? 0,
      notes: (session as any).notes ?? '',
    })
    setEditModal(true)
  }

  if (isLoading) return <div className="skeleton h-96 rounded-xl" />
  if (!session) return <p className="text-smc-muted">Sesión no encontrada</p>

  const handleAddStint = () => {
    const rawTimes = lapInput.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean)
    const times = rawTimes.map((t, i) => ({
      id: crypto.randomUUID(),
      stintId: '',
      lapNumber: i + 1,
      timeSeconds: parseFloat(t.replace(':', '.')) || 0,
    }))

    addStintMutation.mutate({
      pilotId: selectedPilotId,
      lapTimes: times,
      telemetry: {
        voltageInitial: telemetry.voltageInitial ? +telemetry.voltageInitial : undefined,
        voltageFinal: telemetry.voltageFinal ? +telemetry.voltageFinal : undefined,
        currentAvg: telemetry.currentAvg ? +telemetry.currentAvg : undefined,
        motorTempMax: telemetry.motorTempMax ? +telemetry.motorTempMax : undefined,
        batteryConsumptionWh: telemetry.batteryConsumptionWh ? +telemetry.batteryConsumptionWh : undefined,
      },
      notes: stintNotes,
    })
  }

  // Build lap chart data
  const lapChartData = session.stints?.flatMap(stint =>
    (stint.lapTimes ?? []).map((lt, i) => ({
      lap: `V${lt.lapNumber}`,
      tiempo: lt.timeSeconds,
      pilot: stint.pilotId,
    }))
  ) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/training" className="p-2 rounded-lg hover:bg-smc-card text-smc-muted">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">
            Sesión – {format(new Date(session.date), "d 'de' MMMM yyyy", { locale: es })}
          </h1>
          <p className="text-smc-muted text-sm">{session.locationId} · {session.durationMinutes} min</p>
        </div>
        <div className="flex gap-2">
          {session.status !== 'completed' && (
            <button onClick={() => completeMutation.mutate()} className="btn-primary">
              Marcar completada
            </button>
          )}
          <button onClick={openEdit} className="btn-secondary flex items-center gap-2">
            <Pencil className="w-4 h-4" /> Editar
          </button>
          <button onClick={() => setDeleteConfirm(true)} className="btn-danger flex items-center gap-2">
            <Trash2 className="w-4 h-4" /> Eliminar
          </button>
        </div>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-smc-muted text-xs">
            <Activity className="w-3 h-3" /> Stints
          </div>
          <p className="stat-value">{session.stints?.length ?? 0}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-smc-muted text-xs">
            <Clock className="w-3 h-3" /> Total vueltas
          </div>
          <p className="stat-value">
            {session.stints?.reduce((sum, s) => sum + (s.lapTimes?.length ?? 0), 0) ?? 0}
          </p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-smc-muted text-xs">
            <Zap className="w-3 h-3" /> Consumo total
          </div>
          <p className="stat-value text-xl">
            {session.stints?.reduce((sum, s) => sum + (s.telemetry?.batteryConsumptionWh ?? 0), 0).toFixed(0) ?? 0} Wh
          </p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2 text-smc-muted text-xs">
            <Thermometer className="w-3 h-3" /> Temp. máx.
          </div>
          <p className="stat-value text-xl">
            {Math.max(...(session.stints?.map(s => s.telemetry?.motorTempMax ?? 0) ?? [0]))}°C
          </p>
        </div>
      </div>

      {/* Lap times chart */}
      {lapChartData.length > 0 && (
        <Card title="Tiempos por vuelta">
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={lapChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="lap" tick={{ fill: '#8b949e', fontSize: 11 }} />
                <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }}
                  formatter={(val: number) => [formatLapTime(val), 'Tiempo']}
                />
                <Line type="monotone" dataKey="tiempo" stroke="#00d4ff" strokeWidth={2} dot={{ fill: '#00d4ff', r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Stints list */}
      <Card
        title="Stints"
        action={
          <button onClick={() => setStintModal(true)} className="btn-primary flex items-center gap-1 text-sm py-1.5">
            <Plus className="w-3 h-3" /> Añadir stint
          </button>
        }
      >
        <CardContent className="pt-3">
          {!session.stints?.length ? (
            <p className="text-smc-muted text-sm text-center py-6">No hay stints registrados.</p>
          ) : (
            <div className="space-y-4">
              {session.stints.map((stint, idx) => {
                const times = stint.lapTimes?.map(l => l.timeSeconds) ?? []
                const stats = calculateLapStats(times)
                return (
                  <div key={stint.id} className="bg-smc-darker rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-white">Stint {idx + 1}</span>
                      <span className="badge-primary text-xs">{stint.pilotId}</span>
                    </div>

                    {times.length > 0 && (
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center">
                          <p className="text-xs text-smc-muted">Mejor vuelta</p>
                          <p className="font-mono text-success text-sm font-bold">{formatLapTime(stats.best)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-smc-muted">Media</p>
                          <p className="font-mono text-primary text-sm font-bold">{formatLapTime(stats.avg)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-smc-muted">Consistencia</p>
                          <p className="text-sm font-bold text-warning">{stats.consistency}/10</p>
                        </div>
                      </div>
                    )}

                    {stint.telemetry && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {stint.telemetry.voltageInitial && (
                          <div className="flex justify-between">
                            <span className="text-smc-muted">V inicial:</span>
                            <span className="text-smc-text">{stint.telemetry.voltageInitial}V</span>
                          </div>
                        )}
                        {stint.telemetry.batteryConsumptionWh && (
                          <div className="flex justify-between">
                            <span className="text-smc-muted">Consumo:</span>
                            <span className="text-smc-text">{stint.telemetry.batteryConsumptionWh}Wh</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit session modal */}
      {editModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-smc-card rounded-xl p-6 max-w-md w-full space-y-4 border border-smc-border">
            <h3 className="font-semibold text-smc-text">Editar sesión</h3>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Fecha</label>
                <input type="date" className="input-field" value={editForm.date}
                  onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <label className="label">Circuito / Ubicación</label>
                <input type="text" className="input-field" value={editForm.locationId}
                  onChange={e => setEditForm(f => ({ ...f, locationId: e.target.value }))} />
              </div>
              <div>
                <label className="label">Vehículo</label>
                <select className="input-field" value={editForm.vehicleId}
                  onChange={e => setEditForm(f => ({ ...f, vehicleId: e.target.value }))}>
                  <option value="smc01">SMC 01</option>
                  <option value="smc02">SMC 02 EVO</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Duración (minutos)</label>
                <input type="number" className="input-field" value={editForm.durationMinutes}
                  onChange={e => setEditForm(f => ({ ...f, durationMinutes: +e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="label">Notas</label>
                <textarea className="input-field resize-none" rows={2} value={editForm.notes}
                  onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={() => editMutation.mutate()} disabled={editMutation.isPending} className="btn-primary">
                {editMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-smc-card rounded-xl p-6 max-w-sm w-full space-y-4 border border-smc-border">
            <h3 className="font-semibold text-smc-text">¿Eliminar sesión?</h3>
            <p className="text-sm text-smc-muted">Se eliminarán esta sesión y todos sus stints. Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(false)} className="btn-secondary">Cancelar</button>
              <button onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="btn-danger flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Stint Modal */}
      <Modal
        isOpen={stintModal}
        onClose={() => setStintModal(false)}
        title="Añadir stint"
        size="lg"
        footer={
          <>
            <button onClick={() => setStintModal(false)} className="btn-secondary">Cancelar</button>
            <button
              onClick={handleAddStint}
              disabled={addStintMutation.isPending}
              className="btn-primary"
            >
              {addStintMutation.isPending ? 'Guardando...' : 'Guardar stint'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Tiempos por vuelta</label>
            <textarea
              className="input-field resize-none font-mono text-sm"
              rows={6}
              placeholder="Introduce los tiempos separados por líneas o comas:&#10;1:23.456&#10;1:24.123&#10;1:22.890"
              value={lapInput}
              onChange={e => setLapInput(e.target.value)}
            />
            <p className="text-xs text-smc-muted mt-1">Formato: MM:SS.mmm o SS.mmm</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Voltaje inicial (V)</label>
              <input type="number" step="0.1" className="input-field"
                value={telemetry.voltageInitial}
                onChange={e => setTelemetry(t => ({ ...t, voltageInitial: e.target.value }))} />
            </div>
            <div>
              <label className="label">Voltaje final (V)</label>
              <input type="number" step="0.1" className="input-field"
                value={telemetry.voltageFinal}
                onChange={e => setTelemetry(t => ({ ...t, voltageFinal: e.target.value }))} />
            </div>
            <div>
              <label className="label">Corriente media (A)</label>
              <input type="number" step="0.1" className="input-field"
                value={telemetry.currentAvg}
                onChange={e => setTelemetry(t => ({ ...t, currentAvg: e.target.value }))} />
            </div>
            <div>
              <label className="label">Temp. máx. motor (°C)</label>
              <input type="number" step="0.1" className="input-field"
                value={telemetry.motorTempMax}
                onChange={e => setTelemetry(t => ({ ...t, motorTempMax: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="label">Consumo batería (Wh)</label>
              <input type="number" step="0.1" className="input-field"
                value={telemetry.batteryConsumptionWh}
                onChange={e => setTelemetry(t => ({ ...t, batteryConsumptionWh: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Notas del stint</label>
            <textarea className="input-field resize-none" rows={2}
              value={stintNotes} onChange={e => setStintNotes(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
