import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Zap, AlertCircle } from 'lucide-react'
import { raceApi } from '@/services/api/race.api'
import { pilotsApi } from '@/services/api/pilots.api'
import { Card, CardContent } from '@/components/ui/Card'
import { generateRecommendation } from '@/utils/recommendation'
import { db } from '@/services/indexeddb/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { RacePriorityMode } from '@/types'

export default function Simulator() {
  const { id } = useParams<{ id: string }>()
  const [priorityMode, setPriorityMode] = useState<RacePriorityMode>('FINISH')
  const [incidentPenaltyPct, setIncidentPenaltyPct] = useState(0)
  const [result, setResult] = useState<ReturnType<typeof generateRecommendation> | null>(null)

  const { data: race } = useQuery({ queryKey: ['race', id], queryFn: () => raceApi.getEvent(id!) })
  const { data: pilots = [] } = useQuery({ queryKey: ['pilots'], queryFn: pilotsApi.getAll })
  const vehicles = useLiveQuery(() => db.vehicles.toArray(), [])

  const runSimulation = () => {
    if (!vehicles || !race) return
    const category = race.categories.includes('F24') ? 'F24' : 'F24+'
    const sim = generateRecommendation({
      category,
      durationMinutes: category === 'F24+' ? 60 : 90,
      vehicles,
      pilots,
      priorityMode,
    })

    // Apply incident penalty
    if (incidentPenaltyPct > 0) {
      sim.vehicleAssignments.forEach(a => {
        a.finishProbability = Math.max(0, a.finishProbability * (1 - incidentPenaltyPct / 100))
        a.totalEnergyEstimateWh = Math.round(a.totalEnergyEstimateWh * (1 + incidentPenaltyPct / 200))
      })
    }

    setResult(sim)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="section-title">Simulador "¿Qué pasa si?"</h1>

      <Card title="Parámetros de simulación">
        <CardContent className="space-y-4">
          <div>
            <label className="label">Modo de prioridad</label>
            <select value={priorityMode} onChange={e => setPriorityMode(e.target.value as RacePriorityMode)} className="input-field">
              <option value="WIN">Ganar carrera</option>
              <option value="FINISH">Terminar carrera</option>
              <option value="DEVELOP_JUNIORS">Desarrollar juniors</option>
            </select>
          </div>
          <div>
            <label className="label">Penalización por incidencia (%): {incidentPenaltyPct}%</label>
            <input type="range" min={0} max={50} step={5} value={incidentPenaltyPct}
              onChange={e => setIncidentPenaltyPct(+e.target.value)}
              className="w-full h-2 accent-primary" />
            <p className="text-xs text-smc-muted mt-1">Simula problemas técnicos o retrasos</p>
          </div>
          <button onClick={runSimulation} className="btn-primary flex items-center gap-2">
            <Zap className="w-4 h-4" /> Ejecutar simulación
          </button>
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-4">
          {result.warnings.length > 0 && (
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 space-y-1">
              {result.warnings.map((w, i) => (
                <p key={i} className="text-warning text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> {w}
                </p>
              ))}
            </div>
          )}

          {result.vehicleAssignments.map(a => (
            <Card key={a.vehicle.id} title={a.vehicle.name}>
              <CardContent>
                <div className="flex gap-4 mb-4 text-sm">
                  <div className="stat-card flex-1">
                    <p className="text-xs text-smc-muted">Energía estimada</p>
                    <p className="text-xl font-bold text-white">{a.totalEnergyEstimateWh} Wh</p>
                  </div>
                  <div className="stat-card flex-1">
                    <p className="text-xs text-smc-muted">Probabilidad finalizar</p>
                    <p className={`text-xl font-bold ${a.finishProbability >= 0.8 ? 'text-success' : a.finishProbability >= 0.6 ? 'text-warning' : 'text-danger'}`}>
                      {(a.finishProbability * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {a.stints.map(s => (
                    <div key={s.stintNumber} className="bg-smc-darker rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <span className="text-xs text-smc-muted">Stint {s.stintNumber} · </span>
                        <span className="font-medium text-white">{s.pilot.fullName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-smc-muted">{s.plannedDurationMinutes} min</span>
                        <span className={`badge ${
                          s.objective === 'CONSERVATIVE' ? 'badge-green' :
                          s.objective === 'AGGRESSIVE' ? 'badge-red' : 'badge-primary'
                        }`}>{s.objective}</span>
                        <span className="text-warning">{s.estimatedEnergyWh} Wh</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
