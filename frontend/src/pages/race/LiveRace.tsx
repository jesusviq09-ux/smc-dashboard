import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, Play, Pause, RefreshCw, AlertTriangle, Plus, CheckCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { raceApi } from '@/services/api/race.api'
import { pilotsApi } from '@/services/api/pilots.api'
import { useRaceTimer } from '@/hooks/useRaceTimer'
import { useRaceStore } from '@/store/raceStore'
import { Card, CardContent } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { db } from '@/services/indexeddb/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'

export default function LiveRace() {
  const { id } = useParams<{ id: string }>()
  const [incidentModal, setIncidentModal] = useState(false)
  const [incidentDesc, setIncidentDesc] = useState('')
  const [incidentType, setIncidentType] = useState<'technical' | 'strategic' | 'pilot' | 'other'>('technical')
  const [selectedVehicleForIncident, setSelectedVehicleForIncident] = useState('')

  const { data: race } = useQuery({ queryKey: ['race', id], queryFn: () => raceApi.getEvent(id!) })
  const { data: strategies = [] } = useQuery({ queryKey: ['race-strategies', id], queryFn: () => raceApi.getStrategies(id!), enabled: !!id })
  const { data: pilots = [] } = useQuery({ queryKey: ['pilots'], queryFn: pilotsApi.getAll })
  const vehicles = useLiveQuery(() => db.vehicles.toArray(), [])

  const { liveRace, startRace, pauseRace, resumeRace, stopRace, addIncident, resolveIncident, advanceStint, getElapsed } = useRaceStore()
  const category = race?.categories?.includes('F24') ? 'F24' : 'F24+'
  const durationSeconds = category === 'F24+' ? 60 * 60 : 90 * 60

  // Calculate stint alert times from strategies
  const stintAlertTimes = strategies.flatMap(s =>
    s.stints.reduce((acc: number[], stint: any, idx: number) => {
      const elapsed = s.stints.slice(0, idx).reduce((sum: number, prev: any) => sum + prev.plannedDurationMinutes * 60, 0)
      return [...acc, elapsed]
    }, [])
  )

  const handleStintAlert = (elapsed: number) => {
    // Play audio alert
    try {
      const audioCtx = new AudioContext()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()
      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      oscillator.frequency.value = 880
      gainNode.gain.value = 0.3
      oscillator.start()
      setTimeout(() => oscillator.stop(), 500)
    } catch {}
  }

  const timer = useRaceTimer({
    durationSeconds,
    onStintAlert: handleStintAlert,
    stintAlertTimes,
  })

  const isRaceForThisEvent = liveRace.raceId === id

  const handleStart = () => {
    if (isRaceForThisEvent && liveRace.isPaused) {
      resumeRace()
      timer.start(getElapsed())
    } else {
      startRace(id!)
      timer.start()
    }
  }

  const handlePause = () => {
    pauseRace()
    timer.pause()
  }

  const handleAddIncident = () => {
    if (!incidentDesc.trim()) return
    addIncident({
      raceId: id!,
      vehicleId: selectedVehicleForIncident || undefined,
      timestamp: new Date().toISOString(),
      elapsed: timer.elapsed,
      type: incidentType,
      description: incidentDesc,
      resolved: false,
    })
    setIncidentModal(false)
    setIncidentDesc('')
  }

  const getPilotName = (pilotId: string) => pilots.find(p => p.id === pilotId)?.fullName ?? pilotId
  const getVehicleName = (vehicleId: string) => vehicles?.find(v => v.id === vehicleId)?.name ?? vehicleId

  const getCurrentStint = (strategyId: string, vehicleId: string) => {
    const strategy = strategies.find(s => s.id === strategyId)
    if (!strategy) return null
    const currentStintNum = (liveRace.currentStintByVehicle[vehicleId] ?? 0) + 1
    return strategy.stints[currentStintNum - 1]
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to={`/races/${id}`} className="p-2 rounded-lg hover:bg-smc-card text-smc-muted">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{race?.name ?? 'Carrera en vivo'}</h1>
          <p className="text-xs text-smc-muted">{category} · {category === 'F24+' ? '60' : '90'} minutos</p>
        </div>
        <button
          onClick={() => setIncidentModal(true)}
          className="btn-danger flex items-center gap-1 text-sm py-1.5"
        >
          <AlertTriangle className="w-3 h-3" /> Incidencia
        </button>
      </div>

      {/* Main Timer */}
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-xs text-smc-muted uppercase tracking-wider mb-2">
            {timer.isFinished ? '¡CARRERA FINALIZADA!' : timer.isRunning ? 'TIEMPO RESTANTE' : 'INICIO'}
          </p>
          <div className={`timer-display text-6xl font-mono mb-6 ${
            timer.remaining <= 300 && timer.isRunning
              ? 'text-danger animate-pulse'
              : timer.remaining <= 600 ? 'text-warning' : 'text-primary'
          }`}>
            {timer.formattedRemaining}
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-smc-darker rounded-full overflow-hidden mb-6">
            <div
              className="h-full bg-primary transition-all duration-1000 rounded-full"
              style={{ width: `${timer.progressPct}%` }}
            />
          </div>

          <div className="flex justify-center gap-3">
            {!timer.isFinished && (
              <>
                {timer.isRunning ? (
                  <button onClick={handlePause} className="btn-secondary flex items-center gap-2 px-8">
                    <Pause className="w-5 h-5" /> Pausar
                  </button>
                ) : (
                  <button onClick={handleStart} className="btn-primary flex items-center gap-2 px-8 text-lg">
                    <Play className="w-5 h-5" />
                    {liveRace.isLive ? 'Reanudar' : 'Iniciar carrera'}
                  </button>
                )}
                <button onClick={() => { stopRace(); timer.reset() }} className="btn-secondary flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" /> Reiniciar
                </button>
              </>
            )}
          </div>

          <p className="text-xs text-smc-muted mt-4">
            Transcurrido: <span className="font-mono text-smc-text">{timer.formattedElapsed}</span>
          </p>
        </CardContent>
      </Card>

      {/* Vehicle Dashboards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {strategies.map(strategy => {
          const vehicle = vehicles?.find(v => v.id === strategy.vehicleId)
          const currentStintIdx = liveRace.currentStintByVehicle[strategy.vehicleId] ?? 0
          const currentStint = strategy.stints[currentStintIdx]
          const nextStint = strategy.stints[currentStintIdx + 1]

          const stintElapsedPct = currentStint
            ? Math.min(100, (timer.elapsed / (currentStint.plannedDurationMinutes * 60)) * 100)
            : 0

          return (
            <Card key={strategy.id}>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white text-lg">{vehicle?.name ?? strategy.vehicleId}</h3>
                  <span className="badge-primary text-xs">Stint {currentStintIdx + 1}/{strategy.stints.length}</span>
                </div>

                {currentStint && (
                  <div className="space-y-3">
                    <div className="bg-smc-darker rounded-xl p-3">
                      <p className="text-xs text-smc-muted">Piloto actual</p>
                      <p className="font-bold text-white text-lg">{getPilotName(currentStint.pilotId)}</p>
                      <p className="text-xs text-smc-muted mt-1">
                        Objetivo: <span className={`font-medium ${
                          currentStint.objective === 'CONSERVATIVE' ? 'text-success' :
                          currentStint.objective === 'AGGRESSIVE' ? 'text-danger' : 'text-primary'
                        }`}>{currentStint.objective}</span>
                      </p>
                    </div>

                    {/* Stint progress */}
                    <div>
                      <div className="flex justify-between text-xs text-smc-muted mb-1">
                        <span>Stint {currentStintIdx + 1}</span>
                        <span>{currentStint.plannedDurationMinutes} min</span>
                      </div>
                      <div className="h-1.5 bg-smc-darker rounded-full overflow-hidden">
                        <div
                          className="h-full bg-warning transition-all duration-1000 rounded-full"
                          style={{ width: `${stintElapsedPct}%` }}
                        />
                      </div>
                    </div>

                    {nextStint && (
                      <div className="text-xs text-smc-muted border border-smc-border rounded-lg p-2">
                        Próximo: <span className="text-smc-text font-medium">{getPilotName(nextStint.pilotId)}</span>
                      </div>
                    )}

                    <button
                      onClick={() => advanceStint(strategy.vehicleId)}
                      className="w-full btn-secondary text-sm py-1.5 flex items-center justify-center gap-1"
                    >
                      <CheckCircle className="w-4 h-4 text-success" /> Confirmar cambio de piloto
                    </button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Incidents */}
      {liveRace.incidents.length > 0 && (
        <Card title="Incidencias">
          <CardContent className="space-y-2 pt-3">
            {liveRace.incidents.map(incident => (
              <div key={incident.id} className={`flex items-start gap-3 p-3 rounded-lg ${
                incident.resolved ? 'bg-smc-darker opacity-50' : 'bg-danger/10 border border-danger/20'
              }`}>
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${incident.resolved ? 'text-smc-muted' : 'text-danger'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-smc-text">{incident.description}</p>
                  <p className="text-xs text-smc-muted mt-0.5">
                    T+{Math.floor(incident.elapsed / 60)}:{String(incident.elapsed % 60).padStart(2, '0')}
                    {incident.vehicleId && ` · ${getVehicleName(incident.vehicleId)}`}
                  </p>
                </div>
                {!incident.resolved && (
                  <button
                    onClick={() => resolveIncident(incident.id)}
                    className="text-xs text-success hover:underline flex-shrink-0"
                  >
                    Resolver
                  </button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Incident Modal */}
      <Modal
        isOpen={incidentModal}
        onClose={() => setIncidentModal(false)}
        title="Registrar incidencia"
        footer={
          <>
            <button onClick={() => setIncidentModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={handleAddIncident} disabled={!incidentDesc.trim()} className="btn-danger">
              Registrar
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Tipo</label>
            <select value={incidentType} onChange={e => setIncidentType(e.target.value as any)} className="input-field">
              <option value="technical">Técnica</option>
              <option value="strategic">Estratégica</option>
              <option value="pilot">Piloto</option>
              <option value="other">Otra</option>
            </select>
          </div>
          <div>
            <label className="label">Vehículo</label>
            <select value={selectedVehicleForIncident} onChange={e => setSelectedVehicleForIncident(e.target.value)} className="input-field">
              <option value="">General</option>
              {vehicles?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Descripción *</label>
            <textarea
              className="input-field resize-none"
              rows={3}
              placeholder="Describe la incidencia..."
              value={incidentDesc}
              onChange={e => setIncidentDesc(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
