import { useState, useRef } from 'react'
import { Plus, Minus, X, GripVertical, Save, AlertCircle, User } from 'lucide-react'
import { Pilot, Vehicle, RaceEvent, RaceCategory, StintObjective } from '@/types'
import { Card, CardContent } from '@/components/ui/Card'
import { raceApi } from '@/services/api/race.api'
import { useQueryClient } from '@tanstack/react-query'
import { calcStintDurations } from '@/utils/recommendation'

interface ManualStrategyBuilderProps {
  race: RaceEvent
  vehicles: Vehicle[]
  pilots: Pilot[]
  category: RaceCategory  // passed from RaceDetail to support dual-category
  onSaved: () => void
}

interface StintSlot {
  durationMinutes: number
  pilotId: string | null
  objective: StintObjective
}

// vehicleId -> stints[]
type BoardState = Record<string, StintSlot[]>

const OBJECTIVE_LABELS: Record<StintObjective, string> = {
  CONSERVATIVE: 'Conservador',
  BALANCED: 'Equilibrado',
  AGGRESSIVE: 'Agresivo',
}
const OBJECTIVE_COLORS: Record<StintObjective, string> = {
  CONSERVATIVE: 'text-success border-success/30 bg-success/5',
  BALANCED: 'text-primary border-primary/30 bg-primary/5',
  AGGRESSIVE: 'text-danger border-danger/30 bg-danger/5',
}

export default function ManualStrategyBuilder({ race, vehicles, pilots, category, onSaved }: ManualStrategyBuilderProps) {
  const queryClient = useQueryClient()

  // Total race duration depends on category
  const totalRaceMinutes = category === 'F24+' ? 60 : 90

  // Init board with 3 stints per vehicle, using real proportional durations
  const initBoard = (): BoardState => {
    const durations = calcStintDurations(totalRaceMinutes, 3)
    const board: BoardState = {}
    for (const v of vehicles) {
      board[v.id] = durations.map((d, idx) => ({
        durationMinutes: d,
        pilotId: null,
        objective: idx === 0 ? 'CONSERVATIVE' : idx === durations.length - 1 ? 'AGGRESSIVE' : 'BALANCED',
      }))
    }
    return board
  }

  const [board, setBoard] = useState<BoardState>(initBoard)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dragPilotId = useRef<string | null>(null)
  // Track source slot when dragging from a slot to swap
  const dragSource = useRef<{ vehicleId: string; stintIdx: number } | null>(null)

  const eligiblePilots = pilots.filter(p => {
    if (category === 'F24+' && p.age < 16) return false
    return p.availability !== false
  })

  // ── Board mutations ────────────────────────────────────────────────────────

  const addStint = (vehicleId: string) => {
    setBoard(prev => {
      const stints = prev[vehicleId]
      if (stints.length >= 8) return prev
      // Add a 5-min stint and subtract 5 from the last existing stint
      const newStints = [...stints]
      const lastIdx = newStints.length - 1
      if (newStints[lastIdx].durationMinutes > 5) {
        newStints[lastIdx] = { ...newStints[lastIdx], durationMinutes: newStints[lastIdx].durationMinutes - 5 }
      }
      newStints.push({ durationMinutes: 5, pilotId: null, objective: 'BALANCED' })
      return { ...prev, [vehicleId]: newStints }
    })
  }

  const removeStint = (vehicleId: string) => {
    setBoard(prev => {
      const stints = prev[vehicleId]
      if (stints.length <= 1) return prev
      // Remove last stint and redistribute its minutes to the new last stint
      const removedMinutes = stints[stints.length - 1].durationMinutes
      const newStints = stints.slice(0, -1).map((s, i) =>
        i === stints.length - 2
          ? { ...s, durationMinutes: s.durationMinutes + removedMinutes }
          : s
      )
      return { ...prev, [vehicleId]: newStints }
    })
  }

  // Adjust duration of one stint and redistribute the delta among other stints
  // so that the total always equals totalRaceMinutes.
  const setStintDuration = (vehicleId: string, idx: number, newVal: number) => {
    setBoard(prev => {
      const stints = [...prev[vehicleId]]
      const numStints = stints.length
      // Min: 5, Max: total - (numStints-1)*5  so others can each be at least 5
      const maxVal = totalRaceMinutes - (numStints - 1) * 5
      const clamped = Math.max(5, Math.min(maxVal, newVal))
      const delta = clamped - stints[idx].durationMinutes
      if (delta === 0) return prev

      // Distribute -delta among the other stints (last one absorbs remainder)
      const others = stints.map((_, i) => i).filter(i => i !== idx)
      const perOther = Math.floor(-delta / others.length)
      let remainder = -delta - perOther * others.length

      const newStints = stints.map((s, i) => {
        if (i === idx) return { ...s, durationMinutes: clamped }
        const isLast = i === others[others.length - 1]
        const adjust = perOther + (isLast ? remainder : 0)
        if (isLast) remainder = 0
        return { ...s, durationMinutes: Math.max(5, s.durationMinutes + adjust) }
      })

      return { ...prev, [vehicleId]: newStints }
    })
  }

  const setStintObjective = (vehicleId: string, idx: number, obj: StintObjective) => {
    setBoard(prev => {
      const stints = [...prev[vehicleId]]
      stints[idx] = { ...stints[idx], objective: obj }
      return { ...prev, [vehicleId]: stints }
    })
  }

  const assignPilot = (vehicleId: string, idx: number, pilotId: string | null) => {
    setBoard(prev => {
      const stints = [...prev[vehicleId]]
      stints[idx] = { ...stints[idx], pilotId }
      return { ...prev, [vehicleId]: stints }
    })
  }

  const clearSlot = (vehicleId: string, idx: number) => assignPilot(vehicleId, idx, null)

  // ── Drag & Drop (HTML5 native) ─────────────────────────────────────────────

  const handlePilotDragStart = (e: React.DragEvent, pilotId: string) => {
    dragPilotId.current = pilotId
    dragSource.current = null
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleSlotDragStart = (e: React.DragEvent, vehicleId: string, idx: number) => {
    dragPilotId.current = board[vehicleId][idx].pilotId
    dragSource.current = { vehicleId, stintIdx: idx }
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = dragSource.current ? 'move' : 'copy'
  }

  const handleDrop = (e: React.DragEvent, vehicleId: string, idx: number) => {
    e.preventDefault()
    const pilotId = dragPilotId.current
    if (!pilotId) return

    // If dragging from a slot, swap
    if (dragSource.current) {
      const src = dragSource.current
      const destPilotId = board[vehicleId][idx].pilotId
      setBoard(prev => {
        const newBoard = { ...prev }
        // Clone both vehicle arrays
        newBoard[src.vehicleId] = [...prev[src.vehicleId]]
        if (src.vehicleId !== vehicleId) {
          newBoard[vehicleId] = [...prev[vehicleId]]
        }
        // Swap
        const srcSlot = { ...newBoard[src.vehicleId][src.stintIdx] }
        const destSlot = { ...newBoard[vehicleId][idx] }
        newBoard[src.vehicleId][src.stintIdx] = { ...srcSlot, pilotId: destPilotId }
        newBoard[vehicleId][idx] = { ...destSlot, pilotId }
        return newBoard
      })
    } else {
      assignPilot(vehicleId, idx, pilotId)
    }
    dragPilotId.current = null
    dragSource.current = null
  }

  // ── Validation & Save ──────────────────────────────────────────────────────

  const validate = (): string | null => {
    for (const v of vehicles) {
      const stints = board[v.id]
      if (stints.length === 0) return `${v.name} no tiene stints.`
      for (let i = 0; i < stints.length; i++) {
        if (!stints[i].pilotId) return `${v.name} · Stint ${i + 1} sin piloto asignado.`
      }
    }
    return null
  }

  const handleSave = async () => {
    setError(null)
    const validationError = validate()
    if (validationError) { setError(validationError); return }

    setSaving(true)
    try {
      for (const vehicle of vehicles) {
        const stints = board[vehicle.id]
        await raceApi.saveStrategy({
          raceId: race.id,
          vehicleId: vehicle.id,
          category,
          priorityMode: 'FINISH',  // manual = user decides
          stints: stints.map((s, idx) => ({
            id: crypto.randomUUID(),
            strategyId: '',
            stintNumber: idx + 1,
            pilotId: s.pilotId!,
            plannedDurationMinutes: s.durationMinutes,
            objective: s.objective,
            pilotChangeTimeSeconds: 60,
            justification: 'Estrategia manual',
          })),
          totalEnergyEstimateWh: stints.length * 200,
          finishProbability: 0.85,
          isActive: true,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['race-strategies', race.id] })
      onSaved()
    } catch (err: any) {
      setError(`Error al guardar: ${err?.message ?? 'Comprueba el servidor.'}`)
    } finally {
      setSaving(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getPilot = (id: string | null) => id ? pilots.find(p => p.id === id) : null

  const usedPilotIds = (): Record<string, { vehicleName: string; stintNumbers: number[] }[]> => {
    const usage: Record<string, { vehicleName: string; stintNumbers: number[] }[]> = {}
    for (const v of vehicles) {
      board[v.id].forEach((s, idx) => {
        if (!s.pilotId) return
        if (!usage[s.pilotId]) usage[s.pilotId] = []
        const existing = usage[s.pilotId].find(u => u.vehicleName === v.name)
        if (existing) { existing.stintNumbers.push(idx + 1) }
        else { usage[s.pilotId].push({ vehicleName: v.name, stintNumbers: [idx + 1] }) }
      })
    }
    return usage
  }
  const pilotUsage = usedPilotIds()

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-4 items-start">

        {/* ── Pilot list (left) ────────────────────────────────────────────── */}
        <div className="w-full lg:w-48 flex-shrink-0">
          <Card title="Pilotos">
            <CardContent className="space-y-2 pt-2">
              {eligiblePilots.length === 0 && (
                <p className="text-xs text-smc-muted">No hay pilotos elegibles para {category}.</p>
              )}
              {eligiblePilots.map(pilot => {
                const usage = pilotUsage[pilot.id]
                const isUsed = !!usage && usage.length > 0
                const stintCount = usage?.reduce((s, u) => s + u.stintNumbers.length, 0) ?? 0
                return (
                  <div
                    key={pilot.id}
                    draggable
                    onDragStart={e => handlePilotDragStart(e, pilot.id)}
                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab active:cursor-grabbing select-none transition-colors ${
                      isUsed
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-smc-border hover:border-primary/30 bg-smc-darker'
                    }`}
                  >
                    <GripVertical className="w-3 h-3 text-smc-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{pilot.fullName}</p>
                      <p className="text-xs text-smc-muted">{pilot.weightedScore.toFixed(1)}/10</p>
                    </div>
                    {isUsed && (
                      <span className="text-xs text-primary font-bold flex-shrink-0">×{stintCount}</span>
                    )}
                  </div>
                )
              })}
              <p className="text-xs text-smc-muted pt-1">Arrastra a un stint</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Vehicle boards (right) ───────────────────────────────────────── */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {vehicles.map(vehicle => {
            const stints = board[vehicle.id] ?? []
            const totalDuration = stints.reduce((s, st) => s + st.durationMinutes, 0)
            const totalOk = totalDuration === totalRaceMinutes
            return (
              <div key={vehicle.id} className="border border-smc-border rounded-xl overflow-hidden">
                {/* Header */}
                <div className="bg-smc-darker px-4 py-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white text-sm">{vehicle.name}</h3>
                    <p className={`text-xs ${totalOk ? 'text-smc-muted' : 'text-warning font-medium'}`}>
                      {stints.length} stints · {totalDuration} / {totalRaceMinutes} min
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => removeStint(vehicle.id)}
                      disabled={stints.length <= 1}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-smc-card text-smc-muted hover:text-white disabled:opacity-30"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs text-smc-muted w-4 text-center">{stints.length}</span>
                    <button
                      onClick={() => addStint(vehicle.id)}
                      disabled={stints.length >= 8}
                      className="w-6 h-6 rounded flex items-center justify-center hover:bg-smc-card text-smc-muted hover:text-white disabled:opacity-30"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Stints */}
                <div className="divide-y divide-smc-border">
                  {stints.map((stint, idx) => {
                    const assignedPilot = getPilot(stint.pilotId)
                    return (
                      <div
                        key={idx}
                        onDragOver={handleDragOver}
                        onDrop={e => handleDrop(e, vehicle.id, idx)}
                        className={`p-3 transition-colors ${
                          assignedPilot ? 'bg-smc-bg' : 'bg-smc-bg/50 border-dashed'
                        }`}
                      >
                        {/* Stint header */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-smc-muted font-medium">Stint {idx + 1}</span>
                          <div className="flex items-center gap-1">
                            {/* Duration */}
                            <button
                              onClick={() => setStintDuration(vehicle.id, idx, stint.durationMinutes - 5)}
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-smc-card text-smc-muted hover:text-white"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="text-xs text-white w-10 text-center font-mono">{stint.durationMinutes}min</span>
                            <button
                              onClick={() => setStintDuration(vehicle.id, idx, stint.durationMinutes + 5)}
                              className="w-5 h-5 rounded flex items-center justify-center hover:bg-smc-card text-smc-muted hover:text-white"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>

                        {/* Pilot drop zone */}
                        {assignedPilot ? (
                          <div
                            draggable
                            onDragStart={e => handleSlotDragStart(e, vehicle.id, idx)}
                            className="flex items-center gap-2 bg-smc-card rounded-lg px-3 py-2 cursor-grab active:cursor-grabbing"
                          >
                            <User className="w-4 h-4 text-primary flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-white truncate">{assignedPilot.fullName}</p>
                              <p className="text-xs text-smc-muted">{assignedPilot.weightedScore.toFixed(1)}/10 · {assignedPilot.weightKg}kg</p>
                            </div>
                            <button
                              onClick={() => clearSlot(vehicle.id, idx)}
                              className="text-smc-muted hover:text-danger flex-shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-12 rounded-lg border-2 border-dashed border-smc-border text-smc-muted text-xs">
                            Suelta piloto aquí
                          </div>
                        )}

                        {/* Objective selector */}
                        <div className="flex gap-1 mt-2">
                          {(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'] as StintObjective[]).map(obj => (
                            <button
                              key={obj}
                              onClick={() => setStintObjective(vehicle.id, idx, obj)}
                              className={`flex-1 text-xs py-1 rounded border transition-colors ${
                                stint.objective === obj
                                  ? OBJECTIVE_COLORS[obj]
                                  : 'border-smc-border text-smc-muted hover:border-smc-text/30'
                              }`}
                            >
                              {obj === 'CONSERVATIVE' ? 'Cons.' : obj === 'BALANCED' ? 'Equil.' : 'Agres.'}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Pilot usage summary */}
      {Object.keys(pilotUsage).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(pilotUsage).map(([pilotId, usages]) => {
            const pilot = pilots.find(p => p.id === pilotId)
            if (!pilot) return null
            const total = usages.reduce((s, u) => s + u.stintNumbers.length, 0)
            return (
              <span key={pilotId} className={`text-xs px-2 py-1 rounded-full border ${
                total > 1 ? 'badge-yellow' : 'badge-green'
              }`}>
                {pilot.fullName}: {usages.map(u => `${u.vehicleName} s${u.stintNumbers.join(',')}`).join(' · ')}
              </span>
            )
          })}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Guardando...' : 'Guardar estrategia manual'}
        </button>
      </div>
    </div>
  )
}
