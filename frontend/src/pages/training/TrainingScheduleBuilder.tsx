import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { CheckCircle2, Clock, Minus, Plus, Wand2, GripVertical, UtensilsCrossed, PlusCircle, X } from 'lucide-react'
import { trainingApi } from '@/services/api/training.api'
import { TrainingObjective } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScheduleBlock {
  id: string
  objective: TrainingObjective | 'lunch' | 'custom'
  label: string
  startMinute: number
  durationMinutes: number
  color: string
  isFixed?: boolean   // true → lunch, not redistributable
}

interface Props {
  sessionId: string
  startTime: string
  endTime: string
  objectives: TrainingObjective[]
  importances: Record<string, number>
  onDone: () => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const OBJECTIVE_META: Record<string, { label: string; color: string; sortOrder: number }> = {
  technical_setup:    { label: 'Pruebas técnicas / setup',            color: '#a855f7', sortOrder: 0 },
  conditions:         { label: 'Adaptación climática',                 color: '#eab308', sortOrder: 1 },
  speed:              { label: 'Mejorar velocidad pura',               color: '#ef4444', sortOrder: 2 },
  pilot_changes:      { label: 'Cambios de piloto',                    color: '#3b82f6', sortOrder: 3 },
  energy_management:  { label: 'Gestión energética',                   color: '#22c55e', sortOrder: 4 },
  junior_development: { label: 'Desarrollo pilotos jóvenes',           color: '#f97316', sortOrder: 5 },
  other:              { label: 'Otro',                                  color: '#6b7280', sortOrder: 6 },
  lunch:              { label: 'Comida',                                color: '#f59e0b', sortOrder: -1 },
  custom:             { label: 'Personalizado',                         color: '#6b7280', sortOrder: 99 },
}

const MIN_BLOCK_MINUTES = 10
const STEP = 5
const LUNCH_DURATION = 45
const LUNCH_WINDOW_START = 13 * 60   // 13:00 in minutes
const LUNCH_WINDOW_END   = 14 * 60   // 14:00 in minutes

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

function recomputeStarts(blocks: ScheduleBlock[]): ScheduleBlock[] {
  let start = 0
  return blocks.map(b => {
    const updated = { ...b, startMinute: start }
    start += b.durationMinutes
    return updated
  })
}

function buildHourMarkers(sessionStartMin: number, totalMinutes: number): { label: string; offsetMin: number }[] {
  const markers: { label: string; offsetMin: number }[] = []
  const sessionEndMin = sessionStartMin + totalMinutes
  const firstHour = Math.ceil(sessionStartMin / 60) * 60
  for (let t = firstHour; t < sessionEndMin; t += 60) {
    markers.push({
      label: `${String(Math.floor(t / 60)).padStart(2, '0')}:00`,
      offsetMin: t - sessionStartMin,
    })
  }
  return markers
}

function generateBlocks(
  objectives: TrainingObjective[],
  importances: Record<string, number>,
  totalMinutes: number,
  sessionStartMin: number,
): ScheduleBlock[] {
  if (objectives.length === 0 || totalMinutes <= 0) return []

  const sessionEndMin = sessionStartMin + totalMinutes

  // Determine if lunch should be inserted
  const needsLunch = sessionStartMin < LUNCH_WINDOW_END && sessionEndMin > LUNCH_WINDOW_START

  // Sort objectives by sortOrder
  const sorted = [...objectives].sort(
    (a, b) => (OBJECTIVE_META[a]?.sortOrder ?? 99) - (OBJECTIVE_META[b]?.sortOrder ?? 99)
  )

  if (!needsLunch) {
    // Simple proportional distribution
    return buildProportionalBlocks(sorted, importances, totalMinutes, 0)
  }

  // Calculate the lunch start offset (relative to session start)
  const lunchStartOffset = Math.max(0, LUNCH_WINDOW_START - sessionStartMin)
  const lunchEndOffset   = lunchStartOffset + LUNCH_DURATION

  // Time available before and after lunch
  const beforeMinutes = lunchStartOffset
  const afterMinutes  = Math.max(0, totalMinutes - lunchEndOffset)

  // Split objectives proportionally between before/after
  const totalActivity = beforeMinutes + afterMinutes
  const totalImportance = sorted.reduce((s, o) => s + (importances[o] ?? 5), 0)

  // Distribute objectives: first half before, rest after (by importance weight)
  let cumulativeImportance = 0
  const halfImportance = totalImportance / 2

  const beforeObjs: TrainingObjective[] = []
  const afterObjs: TrainingObjective[] = []

  for (const obj of sorted) {
    cumulativeImportance += importances[obj] ?? 5
    if (cumulativeImportance <= halfImportance + 0.01) {
      beforeObjs.push(obj)
    } else {
      afterObjs.push(obj)
    }
  }

  // Fallback: if all in one side
  if (beforeObjs.length === 0 && beforeMinutes > 0) beforeObjs.push(afterObjs.shift()!)
  if (afterObjs.length === 0 && afterMinutes > 0)   afterObjs.push(beforeObjs.pop()!)

  const beforeBlocks = beforeMinutes > 0 && beforeObjs.length > 0
    ? buildProportionalBlocks(beforeObjs, importances, beforeMinutes, 0)
    : []

  const lunchBlock: ScheduleBlock = {
    id: 'lunch',
    objective: 'lunch' as any,
    label: 'Comida',
    startMinute: lunchStartOffset,
    durationMinutes: LUNCH_DURATION,
    color: OBJECTIVE_META['lunch'].color,
    isFixed: true,
  }

  const afterBlocks = afterMinutes > 0 && afterObjs.length > 0
    ? buildProportionalBlocks(afterObjs, importances, afterMinutes, lunchEndOffset)
    : []

  return [...beforeBlocks, lunchBlock, ...afterBlocks]
}

function buildProportionalBlocks(
  objectives: TrainingObjective[],
  importances: Record<string, number>,
  totalMinutes: number,
  startOffset: number,
): ScheduleBlock[] {
  if (objectives.length === 0 || totalMinutes <= 0) return []

  const totalImportance = objectives.reduce((s, o) => s + (importances[o] ?? 5), 0)
  let remaining = totalMinutes
  const durations = objectives.map((obj, i) => {
    if (i === objectives.length - 1) return Math.max(MIN_BLOCK_MINUTES, remaining)
    const imp = importances[obj] ?? 5
    const dur = Math.max(MIN_BLOCK_MINUTES, Math.round(totalMinutes * (imp / totalImportance)))
    remaining -= dur
    return dur
  })

  let start = startOffset
  return objectives.map((obj, i) => {
    const meta = OBJECTIVE_META[obj] ?? { label: obj, color: '#6b7280' }
    const block: ScheduleBlock = {
      id: `block_${obj}_${i}`,
      objective: obj,
      label: meta.label,
      startMinute: start,
      durationMinutes: durations[i],
      color: meta.color,
    }
    start += durations[i]
    return block
  })
}

// ─── Draggable panel item ─────────────────────────────────────────────────────

function DraggablePanelBlock({ id, label, color, durationMinutes }: {
  id: string; label: string; color: string; durationMinutes: number
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? 'opacity-40' : 'opacity-100'
      }`}
      style={{ borderColor: color + '60', backgroundColor: color + '15' }}
    >
      <GripVertical className="w-3.5 h-3.5 text-smc-muted flex-shrink-0" />
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-xs text-smc-text truncate flex-1">{label}</span>
      <span className="text-xs text-smc-muted flex-shrink-0">{durationMinutes}m</span>
    </div>
  )
}

// ─── Droppable timeline slot ──────────────────────────────────────────────────

function DroppableSlot({ index, children }: { index: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot_${index}` })
  return (
    <div ref={setNodeRef} className={`transition-all ${isOver ? 'ring-2 ring-primary/60 ring-inset rounded-lg' : ''}`}>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TrainingScheduleBuilder({ sessionId, startTime, endTime, objectives, importances, onDone }: Props) {
  const sessionStartMin = timeToMinutes(startTime)
  const totalMinutes = Math.max(0, timeToMinutes(endTime) - sessionStartMin)

  const [blocks, setBlocks] = useState<ScheduleBlock[]>(() =>
    generateBlocks(objectives, importances, totalMinutes, sessionStartMin)
  )
  const [saved, setSaved] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [customLabel, setCustomLabel] = useState('')

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const totalUsed = blocks.reduce((s, b) => s + b.durationMinutes, 0)
  const hourMarkers = buildHourMarkers(sessionStartMin, totalMinutes)

  // ─── Panel blocks (for drag source) ────────────────────────────────────────

  // Panel shows existing blocks + lunch if not present + custom option
  const hasLunch = blocks.some(b => b.id === 'lunch')

  const panelItems: ScheduleBlock[] = [
    ...blocks,
    ...(!hasLunch ? [{
      id: 'panel_lunch',
      objective: 'lunch' as any,
      label: 'Comida',
      startMinute: 0,
      durationMinutes: LUNCH_DURATION,
      color: OBJECTIVE_META['lunch'].color,
      isFixed: true,
    }] : []),
  ]

  // ─── Adjust block duration ────────────────────────────────────────────────

  const adjustBlock = useCallback((blockId: string, delta: number) => {
    setBlocks(prev => {
      const idx = prev.findIndex(b => b.id === blockId)
      if (idx < 0) return prev

      const current = prev[idx].durationMinutes
      const newDur = Math.max(MIN_BLOCK_MINUTES, current + delta)
      const actualDelta = newDur - current
      if (actualDelta === 0) return prev

      // Only redistribute among non-fixed blocks
      const others = prev.map((_, i) => i).filter(i => i !== idx && !prev[i].isFixed)
      if (others.length === 0) return prev

      const perOther = Math.floor(-actualDelta / others.length)
      let remainder = -actualDelta - perOther * others.length

      const next = prev.map((b, i) => {
        if (i === idx) return { ...b, durationMinutes: newDur }
        if (b.isFixed) return b
        const isLast = i === others[others.length - 1]
        const adjust = perOther + (isLast ? remainder : 0)
        if (isLast) remainder = 0
        return { ...b, durationMinutes: Math.max(MIN_BLOCK_MINUTES, b.durationMinutes + adjust) }
      })

      return recomputeStarts(next)
    })
  }, [])

  // ─── Drag & drop handlers ─────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const draggedId = String(active.id)
    const overSlotId = String(over.id)

    if (!overSlotId.startsWith('slot_')) return
    const targetIdx = parseInt(overSlotId.replace('slot_', ''), 10)

    setBlocks(prev => {
      const fromIdx = prev.findIndex(b => b.id === draggedId)

      if (fromIdx >= 0) {
        // Reorder existing block
        if (fromIdx === targetIdx) return prev
        const next = [...prev]
        const [moved] = next.splice(fromIdx, 1)
        const insertAt = targetIdx > fromIdx ? targetIdx - 1 : targetIdx
        next.splice(insertAt, 0, moved)
        return recomputeStarts(next)
      }

      // Adding panel_lunch from the side panel
      if (draggedId === 'panel_lunch') {
        const lunchBlock: ScheduleBlock = {
          id: 'lunch',
          objective: 'lunch' as any,
          label: 'Comida',
          startMinute: 0,
          durationMinutes: LUNCH_DURATION,
          color: OBJECTIVE_META['lunch'].color,
          isFixed: true,
        }
        const next = [...prev]
        next.splice(targetIdx, 0, lunchBlock)
        // Redistribute: remove 45 min from non-fixed blocks
        const nonFixed = next.filter(b => !b.isFixed && b.id !== 'lunch')
        if (nonFixed.length > 0) {
          const perBlock = Math.floor(LUNCH_DURATION / nonFixed.length)
          let rem = LUNCH_DURATION - perBlock * nonFixed.length
          nonFixed.forEach((b, i) => {
            b.durationMinutes = Math.max(MIN_BLOCK_MINUTES, b.durationMinutes - perBlock - (i === nonFixed.length - 1 ? rem : 0))
            if (i === nonFixed.length - 1) rem = 0
          })
        }
        return recomputeStarts(next)
      }

      return prev
    })
  }

  // ─── Add custom block ─────────────────────────────────────────────────────

  const addCustomBlock = () => {
    const label = customLabel.trim() || 'Personalizado'
    const dur = 30
    const newBlock: ScheduleBlock = {
      id: `custom_${Date.now()}`,
      objective: 'custom' as any,
      label,
      startMinute: 0,
      durationMinutes: dur,
      color: '#6b7280',
    }
    setBlocks(prev => {
      const next = [...prev, newBlock]
      // Redistribute time from non-fixed to accommodate new block
      const nonFixed = next.filter(b => !b.isFixed && b.id !== newBlock.id)
      if (nonFixed.length > 0 && totalUsed + dur > totalMinutes) {
        const excess = (totalUsed + dur) - totalMinutes
        const perBlock = Math.floor(excess / nonFixed.length)
        let rem = excess - perBlock * nonFixed.length
        nonFixed.forEach((b, i) => {
          b.durationMinutes = Math.max(MIN_BLOCK_MINUTES, b.durationMinutes - perBlock - (i === nonFixed.length - 1 ? rem : 0))
          if (i === nonFixed.length - 1) rem = 0
        })
      }
      return recomputeStarts(next)
    })
    setCustomLabel('')
  }

  // ─── Remove block ─────────────────────────────────────────────────────────

  const removeBlock = (blockId: string) => {
    setBlocks(prev => {
      const removed = prev.find(b => b.id === blockId)
      if (!removed) return prev
      const next = prev.filter(b => b.id !== blockId)
      // Redistribute freed time to last non-fixed block
      const nonFixed = next.filter(b => !b.isFixed)
      if (nonFixed.length > 0) {
        nonFixed[nonFixed.length - 1].durationMinutes += removed.durationMinutes
      }
      return recomputeStarts(next)
    })
  }

  // ─── Reset ────────────────────────────────────────────────────────────────

  const resetBlocks = () => {
    setBlocks(generateBlocks(objectives, importances, totalMinutes, sessionStartMin))
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
        isFixed: b.isFixed,
      }))
      const current = await trainingApi.getSession(sessionId)
      let existingNotes: any = {}
      if (current?.notes) {
        try { existingNotes = JSON.parse(current.notes) } catch { /* plain text */ }
      }
      const merged = { ...existingNotes, schedule: schedulePayload, startTime, endTime }
      return trainingApi.updateSession(sessionId, { notes: JSON.stringify(merged) })
    },
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => onDone(), 1200)
    },
  })

  // ─── Active drag overlay item ─────────────────────────────────────────────

  const activeBlock = activeId
    ? (blocks.find(b => b.id === activeId) ?? panelItems.find(p => p.id === activeId))
    : null

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

  const timelineHeight = Math.max(360, totalMinutes * 1.4)

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-5 max-w-3xl">

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

        {/* Balance indicator */}
        {totalUsed !== totalMinutes && (
          <div className="text-xs text-yellow-400 flex items-center gap-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-lg px-3 py-2">
            <Clock className="w-3.5 h-3.5" />
            Total bloques: {totalUsed} min · Sesión: {totalMinutes} min
          </div>
        )}

        {/* Main layout: timeline + side panel */}
        <div className="flex gap-4">

          {/* Timeline */}
          <div className="flex-1 flex gap-3">
            {/* Hour labels */}
            <div className="relative flex-shrink-0 w-12" style={{ height: `${timelineHeight}px` }}>
              <div className="absolute top-0"><span className="text-xs text-smc-muted font-mono">{startTime}</span></div>
              {hourMarkers.map(m => (
                <div key={m.label} className="absolute" style={{ top: `${(m.offsetMin / totalMinutes) * 100}%` }}>
                  <span className="text-xs text-smc-muted font-mono">{m.label}</span>
                </div>
              ))}
              <div className="absolute bottom-0"><span className="text-xs text-smc-muted font-mono">{endTime}</span></div>
            </div>

            {/* Vertical rule */}
            <div className="flex-shrink-0 w-px bg-smc-border relative" style={{ height: `${timelineHeight}px` }}>
              {hourMarkers.map(m => (
                <div key={m.label} className="absolute left-0 w-2 h-px bg-smc-border" style={{ top: `${(m.offsetMin / totalMinutes) * 100}%` }} />
              ))}
            </div>

            {/* Blocks */}
            <div className="flex-1 relative" style={{ height: `${timelineHeight}px` }}>
              {blocks.map((block, idx) => {
                const topPct    = (block.startMinute / totalMinutes) * 100
                const heightPct = (block.durationMinutes / totalMinutes) * 100
                const blockStart = minutesToTime(sessionStartMin, block.startMinute)
                const blockEnd   = minutesToTime(sessionStartMin, block.startMinute + block.durationMinutes)

                return (
                  <DroppableSlot key={block.id} index={idx}>
                    <div
                      className="absolute left-0 right-2 rounded-lg border overflow-hidden flex flex-col"
                      style={{
                        top: `${topPct}%`,
                        height: `${heightPct}%`,
                        minHeight: '38px',
                        borderColor: block.color + '60',
                        backgroundColor: block.color + '20',
                      }}
                    >
                      <div className="flex items-start justify-between px-2.5 pt-1.5 pb-1 flex-1 min-h-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {!block.isFixed && (
                              <GripVertical className="w-3 h-3 text-smc-muted/50 flex-shrink-0 cursor-grab" />
                            )}
                            {block.id === 'lunch' && <UtensilsCrossed className="w-3 h-3 flex-shrink-0" style={{ color: block.color }} />}
                            <span className="text-xs font-semibold text-white truncate">{block.label}</span>
                          </div>
                          <div className="text-xs text-smc-muted font-mono">
                            {blockStart} – {blockEnd} · <span className="text-white">{block.durationMinutes} min</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          {/* ±5 only for non-fixed */}
                          {!block.isFixed && (
                            <>
                              <button onClick={() => adjustBlock(block.id, +STEP)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10">
                                <Plus className="w-3 h-3 text-smc-muted" />
                              </button>
                              <button onClick={() => adjustBlock(block.id, -STEP)} disabled={block.durationMinutes <= MIN_BLOCK_MINUTES} className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 disabled:opacity-30">
                                <Minus className="w-3 h-3 text-smc-muted" />
                              </button>
                            </>
                          )}
                          {/* Remove non-lunch custom or re-added lunch */}
                          {(block.objective === 'custom' as any || block.id === 'lunch') && (
                            <button onClick={() => removeBlock(block.id)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 ml-0.5">
                              <X className="w-3 h-3 text-smc-muted" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </DroppableSlot>
                )
              })}
              {/* Drop zone at end */}
              <DroppableSlot index={blocks.length}>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 2, height: '20px' }} />
              </DroppableSlot>
            </div>
          </div>

          {/* Side panel */}
          <div className="w-44 flex-shrink-0 space-y-3">
            <p className="text-xs font-semibold text-smc-muted uppercase tracking-wide">Bloques</p>

            {/* Existing blocks (for reordering) */}
            <div className="space-y-1.5">
              {blocks.map(block => (
                <DraggablePanelBlock
                  key={`panel_${block.id}`}
                  id={block.id}
                  label={block.label}
                  color={block.color}
                  durationMinutes={block.durationMinutes}
                />
              ))}
            </div>

            {/* Add lunch if not present */}
            {!hasLunch && (
              <>
                <div className="border-t border-smc-border pt-2">
                  <p className="text-xs text-smc-muted mb-1.5">Añadir</p>
                  <DraggablePanelBlock
                    id="panel_lunch"
                    label="Comida"
                    color={OBJECTIVE_META['lunch'].color}
                    durationMinutes={LUNCH_DURATION}
                  />
                </div>
              </>
            )}

            {/* Custom block */}
            <div className="border-t border-smc-border pt-2 space-y-1.5">
              <p className="text-xs text-smc-muted">Bloque personalizado</p>
              <input
                type="text"
                value={customLabel}
                onChange={e => setCustomLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomBlock()}
                placeholder="Nombre..."
                className="input-field text-xs py-1.5 px-2"
              />
              <button
                onClick={addCustomBlock}
                className="w-full flex items-center justify-center gap-1 text-xs text-smc-muted hover:text-white border border-smc-border hover:border-primary/40 rounded-lg py-1.5 transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Añadir (30 min)
              </button>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          {blocks.map(block => (
            <div key={block.id} className="flex items-center gap-1.5 text-xs text-smc-muted">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: block.color }} />
              {block.label}: <span className="text-white font-medium">{block.durationMinutes} min</span>
              <span className="text-smc-muted/50">({Math.round((block.durationMinutes / totalMinutes) * 100)}%)</span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end pt-2 border-t border-smc-border">
          <button onClick={onDone} className="btn-secondary">Saltar</button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || saved}
            className="btn-primary flex items-center gap-2"
          >
            {saved ? (
              <><CheckCircle2 className="w-4 h-4 text-emerald-400" />Guardado</>
            ) : saveMutation.isPending ? 'Guardando...' : (
              <><CheckCircle2 className="w-4 h-4" />Guardar horario</>
            )}
          </button>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeBlock && (
          <div
            className="px-3 py-2 rounded-lg border shadow-xl opacity-90 cursor-grabbing"
            style={{ borderColor: activeBlock.color + '60', backgroundColor: activeBlock.color + '30', minWidth: '130px' }}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeBlock.color }} />
              <span className="text-xs font-semibold text-white">{activeBlock.label}</span>
              <span className="text-xs text-smc-muted ml-auto">{activeBlock.durationMinutes}m</span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
