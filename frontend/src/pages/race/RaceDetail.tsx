import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ChevronLeft, Play, Settings, Zap, AlertCircle, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { raceApi } from '@/services/api/race.api'
import { pilotsApi } from '@/services/api/pilots.api'
import { Card, CardContent } from '@/components/ui/Card'
import { generateRecommendation } from '@/utils/recommendation'
import { db } from '@/services/indexeddb/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { RacePriorityMode } from '@/types'

const PRIORITY_MODES: { value: RacePriorityMode; label: string; desc: string }[] = [
  { value: 'WIN', label: 'Ganar carrera', desc: 'Mejores pilotos en stints clave' },
  { value: 'FINISH', label: 'Terminar carrera', desc: 'Pilotos consistentes, mínimo riesgo' },
  { value: 'DEVELOP_JUNIORS', label: 'Desarrollar juniors', desc: 'Incluir pilotos novatos en stint intermedio' },
]

export default function RaceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [priorityMode, setPriorityMode] = useState<RacePriorityMode>('FINISH')
  const [recommendation, setRecommendation] = useState<ReturnType<typeof generateRecommendation> | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const queryClient = useQueryClient()

  const { data: race, isLoading } = useQuery({
    queryKey: ['race', id],
    queryFn: () => raceApi.getEvent(id!),
    enabled: !!id,
  })

  const { data: strategies = [] } = useQuery({
    queryKey: ['race-strategies', id],
    queryFn: () => raceApi.getStrategies(id!),
    enabled: !!id,
  })

  const { data: pilots = [] } = useQuery({
    queryKey: ['pilots'],
    queryFn: pilotsApi.getAll,
  })

  const vehicles = useLiveQuery(() => db.vehicles.toArray(), [])

  const deleteMutation = useMutation({
    mutationFn: () => raceApi.deleteEvent(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['race-events'] })
      navigate('/races')
    },
  })

  if (isLoading) return <div className="skeleton h-96 rounded-xl" />
  if (!race) return <p className="text-smc-muted">Carrera no encontrada</p>

  const handleGenerateStrategy = () => {
    if (!vehicles || !pilots.length) return

    const category = race.categories.includes('F24') ? 'F24' : 'F24+'
    const durationMinutes = category === 'F24+' ? 60 : 90

    const result = generateRecommendation({
      category,
      durationMinutes,
      vehicles,
      pilots,
      priorityMode,
    })

    setRecommendation(result)
  }

  const handleSaveStrategy = async () => {
    if (!recommendation || !id) return
    setSaving(true)
    try {
      for (const assignment of recommendation.vehicleAssignments) {
        await raceApi.saveStrategy({
          raceId: id,
          vehicleId: assignment.vehicle.id,
          category: race.categories[0],
          priorityMode,
          stints: assignment.stints.map(s => ({
            id: crypto.randomUUID(),
            strategyId: '',
            stintNumber: s.stintNumber,
            pilotId: s.pilot.id,
            plannedDurationMinutes: s.plannedDurationMinutes,
            objective: s.objective,
            pilotChangeTimeSeconds: 60,
            justification: s.justification,
          })),
          totalEnergyEstimateWh: assignment.totalEnergyEstimateWh,
          finishProbability: assignment.finishProbability,
          isActive: true,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['race-strategies', id] })
    } finally {
      setSaving(false)
    }
  }

  const objectiveColors = { CONSERVATIVE: 'badge-green', BALANCED: 'badge-primary', AGGRESSIVE: 'badge-red' }
  const objectiveLabels = { CONSERVATIVE: 'Conservador', BALANCED: 'Equilibrado', AGGRESSIVE: 'Agresivo' }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/races" className="p-2 rounded-lg hover:bg-smc-card text-smc-muted">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{race.name}</h1>
          <p className="text-smc-muted text-sm">
            {format(new Date(race.date), "d 'de' MMMM yyyy · HH:mm", { locale: es })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDeleteConfirm(true)}
            className="p-2 rounded-lg hover:bg-danger/10 text-smc-muted hover:text-danger transition-colors"
            title="Eliminar carrera"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <Link to={`/races/${id}/live`} className="btn-primary flex items-center gap-2">
            <Play className="w-4 h-4" /> Modo carrera en vivo
          </Link>
        </div>
      </div>

      {/* Race info */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {race.categories.map(cat => (
          <div key={cat} className="stat-card">
            <p className="text-xs text-smc-muted">Categoría</p>
            <p className="stat-value text-2xl">{cat}</p>
            <p className="text-xs text-smc-muted">{cat === 'F24+' ? '60 min' : '90 min'}</p>
          </div>
        ))}
        {race.weatherConditions && (
          <div className="stat-card">
            <p className="text-xs text-smc-muted">Clima</p>
            <p className="font-medium text-white">{race.weatherConditions}</p>
          </div>
        )}
      </div>

      {/* Strategy Generator */}
      <Card title="Generador de estrategia" subtitle="Basado en puntuaciones y disponibilidad de pilotos">
        <CardContent className="space-y-4">
          <div>
            <label className="label">Modo de prioridad</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {PRIORITY_MODES.map(mode => (
                <button
                  key={mode.value}
                  onClick={() => setPriorityMode(mode.value)}
                  type="button"
                  className={`p-3 rounded-xl border text-left transition-colors ${
                    priorityMode === mode.value
                      ? 'border-primary bg-primary/10'
                      : 'border-smc-border hover:border-primary/30'
                  }`}
                >
                  <p className="font-medium text-white text-sm">{mode.label}</p>
                  <p className="text-xs text-smc-muted mt-0.5">{mode.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={handleGenerateStrategy} className="btn-primary flex items-center gap-2">
              <Zap className="w-4 h-4" /> Generar estrategia óptima
            </button>
            {recommendation && (
              <button onClick={handleSaveStrategy} disabled={saving} className="btn-secondary">
                {saving ? 'Guardando...' : 'Guardar estrategia'}
              </button>
            )}
          </div>

          {/* Recommendation output */}
          {recommendation && (
            <div className="space-y-4">
              {recommendation.warnings.length > 0 && (
                <div className="bg-warning/10 border border-warning/30 rounded-lg p-3">
                  {recommendation.warnings.map((w, i) => (
                    <p key={i} className="text-warning text-sm flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" /> {w}
                    </p>
                  ))}
                </div>
              )}

              {recommendation.vehicleAssignments.map(assignment => (
                <div key={assignment.vehicle.id} className="border border-smc-border rounded-xl overflow-hidden">
                  <div className="bg-smc-darker px-4 py-3 flex items-center justify-between">
                    <h3 className="font-bold text-white">{assignment.vehicle.name}</h3>
                    <div className="flex items-center gap-3 text-xs text-smc-muted">
                      <span>{assignment.totalEnergyEstimateWh} Wh estimados</span>
                      <span className={`badge ${assignment.finishProbability >= 0.8 ? 'badge-green' : assignment.finishProbability >= 0.6 ? 'badge-yellow' : 'badge-red'}`}>
                        {(assignment.finishProbability * 100).toFixed(0)}% prob. finalizar
                      </span>
                    </div>
                  </div>

                  <div className="divide-y divide-smc-border">
                    {assignment.stints.map(stint => (
                      <div key={stint.stintNumber} className="px-4 py-3">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-smc-muted">Stint {stint.stintNumber}</span>
                            <span className={`badge text-xs ${objectiveColors[stint.objective]}`}>
                              {objectiveLabels[stint.objective]}
                            </span>
                          </div>
                          <span className="text-xs text-smc-muted">{stint.plannedDurationMinutes} min</span>
                        </div>
                        <p className="font-semibold text-white">{stint.pilot.fullName}</p>
                        <p className="text-xs text-smc-muted mt-0.5">{stint.justification}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Saved strategies */}
      {strategies.length > 0 && (
        <Card title="Estrategia guardada">
          <CardContent className="space-y-4">
            {strategies.map(strategy => (
              <div key={strategy.id} className="border border-smc-border rounded-xl overflow-hidden">
                <div className="bg-smc-darker px-4 py-3 flex items-center justify-between">
                  <h3 className="font-bold text-white">
                    {vehicles?.find(v => v.id === strategy.vehicleId)?.name ?? strategy.vehicleId}
                  </h3>
                  <span className="badge-primary text-xs">{strategy.priorityMode}</span>
                </div>
                <div className="divide-y divide-smc-border">
                  {strategy.stints.map((stint: any) => (
                    <div key={stint.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-smc-muted">Stint {stint.stintNumber} · </span>
                        <span className="font-medium text-white">{pilots.find(p => p.id === stint.pilotId)?.fullName ?? stint.pilotId}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`badge text-xs ${objectiveColors[stint.objective as keyof typeof objectiveColors]}`}>
                          {objectiveLabels[stint.objective as keyof typeof objectiveLabels]}
                        </span>
                        <span className="text-xs text-smc-muted">{stint.plannedDurationMinutes} min</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-smc-card border border-smc-border rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-white mb-2">¿Eliminar esta carrera?</h3>
            <p className="text-sm text-smc-muted mb-4">
              Se eliminarán también todas las estrategias asociadas. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirm(false)} className="btn-secondary text-sm py-1.5">
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="btn-danger text-sm py-1.5"
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
