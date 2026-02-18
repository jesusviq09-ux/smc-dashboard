import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle2, Clock, Minus, Plus, Wand2 } from 'lucide-react'
import { trainingApi } from '@/services/api/training.api'
import { TrainingObjective } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduleBlock {
  id: string
  objective: TrainingObjective
  label: string
  startMinute: number   // minutes from session startTime
  durationMinutes: number
  color: string
}

interface Props {
  sessionId: string
  startTime: string               // HH:MM
  endTime: string                 // HH:MM
  objectives: TrainingObjective[]
  importances: Record<string, number>
  onDone: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const OBJECTIVE_META: Record<TrainingObjective, { label: string; color: string; sortOrder: number }> = {
  technical_setup:    { label: 'Pruebas técnicas / setup',            color: '#a855f7', sortOrder: 0 },
  conditions:         { label: 'Adaptación climática',                 color: '#eab308', sortOrder: 1 },
  speed:              { label: 'Mejorar velocidad pura',               color: '#ef4444', sortOrder: 2 },
  pilot_changes:      { label: 'Cambios de piloto',                    color: '#3b82f6', sortOrder: 3 },
  energy_management:  { label: 'Gestión energética',                   color: '#22c55e', sortOrder: 4 },
  junior_development: { label: 'Desarrollo pilotos jóvenes',           color: '#f97316', sortOrder: 5 },
  other:              { label: 'Otro',                                  color: '#6b7280', sortOrder: 6 },
}

const MIN_BLOCK_MINUTES = 10
const STEP = 5

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function minutesToTime(sessionStartMinutes: number, offsetMinutes: number): string {
  const total = sessionStartMinutes + offsetMinutes
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function generateBlocks(
  objectives: TrainingObjective[],
  importances: Record<string, number>,
  totalMinutes: number,
): ScheduleBlock[] {
  if (objectives.length === 0 || totalMinutes <= 0) return []

  // Sort objectives by sortOrder
  const sorted = [...objectives].sort(
    (a, b) => (OBJECTIVE_META[a]?.sortOrder ?? 99) - (OBJECTIVE_META[b]?.sortOrder ?? 99)
  )

  // Compute proportional durations
  const totalImportance = sorted.reduce((sum, obj) => sum + (importances[obj] ?? 5), 0)
  let remaining = totalMinutes
  const rawDurations = sorted.map((obj, i) => {
    if (i === sorted.length - 1) return remaining  // last block absorbs remainder
    const imp = importances[obj] ?? 5
    const dur = Math.max(MIN_BLOCK_MINUTES, Math.round(totalMinutes * (imp / totalImportance)))
    remaining -= dur
    return dur
  })

  // Recalc startMinutes
  let startMinute = 0
  return sorted.map((obj, i) => {
    const meta = OBJECTIVE_META[obj] ?? { label: obj, color: '#6b7280' }
    const block: ScheduleBlock = {
      id: `block_${i}`,
      objective: obj,
      label: meta.label,
      startMinute,
      durationMinutes: Math.max(MIN_BLOCK_MINUTES, rawDurations[i]),
      color: meta.color,
    }
    startMinute += block.durationMinutes
    return block
  })
}

function recomputeStarts(blocks: ScheduleBlock[]): ScheduleBlock[] {
  let start = 0
  return blocks.map(b => {
    const updated = { ...b, startMinute: start }
    start += b.durationMinutes
    return updated
  })
}

// ─── Hour markers ─────────────────────────────────────────────────────────────

function buildHourMarkers(sessionStartMin: number, totalMinutes: number): { label: string; offsetMin: number }[] {
  const markers: { label: string; offsetMin: number }[] = []
  const sessionEndMin = sessionStartMin + totalMinutes
  // Find first full hour after session start
  const firstHour = Math.ceil(sessionStartMin / 60) * 60
  for (let t = firstHour; t < sessionEndMin; t += 60) {
    markers.push({
      label: `${String(Math.floor(t / 60)).padStart(2, '0')}:00`,
      offsetMin: t - sessionStartMin,
    })
  }
  return markers
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrainingScheduleBuilder({ sessionId, startTime, endTime, objectives, importances, onDone }: Props) {
  const sessionStartMin = timeToMinutes(startTime)
  const totalMinutes = Math.max(0, timeToMinutes(endTime) - sessionStartMin)

  const [blocks, setBlocks] = useState<ScheduleBlock[]>(() =>
    generateBlocks(objectives, importances, totalMinutes)
  )

  const [saved, setSaved] = useState(false)

  const totalUsed = blocks.reduce((s, b) => s + b.durationMinutes, 0)
  const hourMarkers = buildHourMarkers(sessionStartMin, totalMinutes)

  // ─── Adjust block duration ────────────────────────────────────────────────

  const adjustBlock = useCallback((blockId: string, delta: number) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === blockId)
      if (idx < 0) return prev

      const current = prev[idx].durationMinutes
      const newDur = Math.max(MIN_BLOCK_MINUTES, current + delta)
      const actualDelta = newDur - current
      if (actualDelta === 0) return prev

      // Distribute -actualDelta among other blocks
      const others = prev.map((_, i) => i).filter(i => i !== idx)
      if (others.length === 0) return prev

      const perOther = Math.floor(-actualDelta / others.length)
      let remainder = -actualDelta - perOther * others.length

      const next = prev.map((b, i) => {
        if (i === idx) return { ...b, durationMinutes: newDur }
        const isLast = i === others[others.length - 1]
        const adjust = perOther + (isLast ? remainder : 0)
        if (isLast) remainder = 0
        return { ...b, durationMinutes: Math.max(MIN_BLOCK_MINUTES, b.durationMinutes + adjust) }
      })

      return recomputeStarts(next)
    })
  }, [])

  // ─── Reset ────────────────────────────────────────────────────────────────

  const resetBlocks = () => {
    setBlocks(generateBlocks(objectives, importances, totalMinutes))
  }

  // ─── Save ─────────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async () => {
      const schedulePayload = blocks.map(b => ({
        objective: b.objective,
        label: b.label,
        startMinute: b.startMinute,
        durationMinutes: b.durationMinutes,
        color: b.color,
      }))
      // Fetch current session to merge existing notes (importances) with schedule
      const current = await trainingApi.getSession(sessionId)
      let existingNotes: any = {}
      if (current?.notes) {
        try { existingNotes = JSON.parse(current.notes) } catch { /* plain text notes */ }
      }
      const merged = { ...existingNotes, schedule: schedulePayload }
      return trainingApi.updateSession(sessionId, { notes: JSON.stringify(merged) })
    },
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => onDone(), 1200)
    },
  })

  // ─── Render ───────────────────────────────────────────────────────────────

  if (blocks.length === 0) {
    return (
      <div className="space-y-6 max-w-2xl">
        <h2 className="text-xl font-bold text-white">Horario de la sesión</h2>
        <p className="text-smc-muted text-sm">No hay objetivos seleccionados. El horario no puede generarse.</p>
        <button onClick={onDone} className="btn-primary">Ir a la sesión</button>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-primary" />
            Horario generado
          </h2>
          <p className="text-sm text-smc-muted mt-0.5">
            {startTime} → {endTime} · {totalMinutes} min totales
          </p>
        </div>
        <button
          onClick={resetBlocks}
          className="text-xs text-smc-muted hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-smc-border hover:border-primary/40"
        >
          ↺ Regenerar
        </button>
      </div>

      {/* Total used indicator */}
      {totalUsed !== totalMinutes && (
        <div className="text-xs text-yellow-400 flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2">
          <Clock className="w-3.5 h-3.5" />
          Total: {totalUsed} min (ajustando — objetivo: {totalMinutes} min)
        </div>
      )}

      {/* Timeline */}
      <div className="flex gap-3">
        {/* Left: hour markers */}
        <div className="relative flex-shrink-0 w-12" style={{ height: `${Math.max(300, totalMinutes * 1.2)}px` }}>
          {/* Session start */}
          <div className="absolute top-0 left-0 right-0">
            <span className="text-xs text-smc-muted font-mono">{startTime}</span>
          </div>
          {hourMarkers.map(marker => {
            const topPct = (marker.offsetMin / totalMinutes) * 100
            return (
              <div
                key={marker.label}
                className="absolute left-0 right-0"
                style={{ top: `${topPct}%` }}
              >
                <span className="text-xs text-smc-muted font-mono">{marker.label}</span>
              </div>
            )
          })}
          {/* Session end */}
          <div className="absolute bottom-0 left-0 right-0">
            <span className="text-xs text-smc-muted font-mono">{endTime}</span>
          </div>
        </div>

        {/* Vertical line */}
        <div className="flex-shrink-0 w-px bg-smc-border relative" style={{ height: `${Math.max(300, totalMinutes * 1.2)}px` }}>
          {hourMarkers.map(marker => {
            const topPct = (marker.offsetMin / totalMinutes) * 100
            return (
              <div
                key={marker.label}
                className="absolute left-0 w-2 h-px bg-smc-border"
                style={{ top: `${topPct}%` }}
              />
            )
          })}
        </div>

        {/* Right: blocks */}
        <div className="flex-1 relative" style={{ height: `${Math.max(300, totalMinutes * 1.2)}px` }}>
          {blocks.map(block => {
            const topPct  = (block.startMinute / totalMinutes) * 100
            const heightPct = (block.durationMinutes / totalMinutes) * 100
            const blockStartTime = minutesToTime(sessionStartMin, block.startMinute)
            const blockEndTime   = minutesToTime(sessionStartMin, block.startMinute + block.durationMinutes)

            return (
              <div
                key={block.id}
                className="absolute left-0 right-2 rounded-lg border overflow-hidden flex flex-col"
                style={{
                  top: `${topPct}%`,
                  height: `${heightPct}%`,
                  minHeight: '40px',
                  borderColor: block.color + '60',
                  backgroundColor: block.color + '20',
                }}
              >
                {/* Block content */}
                <div className="flex items-start justify-between px-3 pt-2 pb-1 flex-1 min-h-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: block.color }} />
                      <span className="text-xs font-semibold text-white truncate">{block.label}</span>
                    </div>
                    <div className="text-xs text-smc-muted font-mono">
                      {blockStartTime} – {blockEndTime} · <span className="text-white">{block.durationMinutes} min</span>
                    </div>
                  </div>

                  {/* ±5 controls */}
                  <div className="flex flex-col gap-0.5 ml-2 flex-shrink-0">
                    <button
                      onClick={() => adjustBlock(block.id, +STEP)}
                      className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 transition-colors"
                      title={`+${STEP} min`}
                    >
                      <Plus className="w-3 h-3 text-smc-muted hover:text-white" />
                    </button>
                    <button
                      onClick={() => adjustBlock(block.id, -STEP)}
                      disabled={block.durationMinutes <= MIN_BLOCK_MINUTES}
                      className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 transition-colors disabled:opacity-30"
                      title={`-${STEP} min`}
                    >
                      <Minus className="w-3 h-3 text-smc-muted hover:text-white" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 pt-1">
        {blocks.map(block => (
          <div key={block.id} className="flex items-center gap-1.5 text-xs text-smc-muted">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: block.color }} />
            {block.label}: <span className="text-white font-medium">{block.durationMinutes} min</span>
            <span className="text-smc-muted/50">({Math.round((block.durationMinutes / totalMinutes) * 100)}%)</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3 justify-end pt-2 border-t border-smc-border">
        <button
          onClick={onDone}
          className="btn-secondary"
        >
          Saltar
        </button>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || saved}
          className="btn-primary flex items-center gap-2"
        >
          {saved ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Guardado
            </>
          ) : saveMutation.isPending ? (
            'Guardando...'
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Guardar horario
            </>
          )}
        </button>
      </div>
    </div>
  )
}
