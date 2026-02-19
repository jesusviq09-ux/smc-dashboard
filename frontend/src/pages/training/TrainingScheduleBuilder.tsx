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
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

// px per minute — determines visual height of each block
const PX_PER_MIN = 2.2

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

// ─── Sortable block (draggable within timeline) ────────────────────────────────

function SortableBlock({
  block,
  sessionStartMin,
  onAdjust,
  onRemove,
}: {
  block: ScheduleBlock
  sessionStartMin: number
  onAdjust: (delta: number) => void
  onRemove: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id, disabled: !!block.isFixed })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    height: `${Math.max(44, block.durationMinutes * PX_PER_MIN)}px`,
  }

  const blockStart = minutesToTime(sessionStartMin, block.startMinute)
  const blockEnd   = minutesToTime(sessionStartMin, block.startMinute + block.durationMinutes)
  const tall = block.durationMinutes * PX_PER_MIN >= 60

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderColor: block.color + '60',
        backgroundColor: block.color + '20',
      }}
      className="rounded-lg border overflow-hidden flex flex-col touch-none"
    >
      <div className="flex items-start justify-between px-2.5 pt-1.5 pb-1 flex-1 min-h-0">
        <div className="min-w-0 flex-1 flex items-start gap-1.5">
          {/* Drag handle — only for non-fixed blocks */}
          {!block.isFixed ? (
            <button
              {...listeners}
              {...attributes}
              className="mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
              tabIndex={-1}
            >
              <GripVertical className="w-3 h-3 text-smc-muted/60 hover:text-smc-muted" />
            </button>
          ) : (
            <UtensilsCrossed className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: block.color }} />
          )}
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate leading-tight">{block.label}</p>
            {tall && (
              <p className="text-xs text-smc-muted font-mono mt-0.5">
                {blockStart} – {blockEnd} · <span className="text-white">{block.durationMinutes} min</span>
              </p>
            )}
            {!tall && (
              <p className="text-xs text-smc-muted">{block.durationMinutes} min</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-0.5 ml-1 flex-shrink-0">
          {!block.isFixed && (
            <>
              <button
                onClick={() => onAdjust(+STEP)}
                className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10"
              >
                <Plus className="w-3 h-3 text-smc-muted" />
              </button>
              <button
                onClick={() => onAdjust(-STEP)}
                disabled={block.durationMinutes <= MIN_BLOCK_MINUTES}
                className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 disabled:opacity-30"
              >
                <Minus className="w-3 h-3 text-smc-muted" />
              </button>
            </>
          )}
          {(block.objective === 'custom' as any || block.id === 'lunch') && (
            <button
              onClick={onRemove}
              className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 ml-0.5"
            >
              <X className="w-3 h-3 text-smc-muted" />
            </button>
          )}
        </div>
      </div>
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
  const hasLunch = blocks.some(b => b.id === 'lunch')

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

  // ─── Drag handlers ────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    setBlocks(prev => {
      const oldIdx = prev.findIndex(b => b.id === active.id)
      const newIdx = prev.findIndex(b => b.id === over.id)
      if (oldIdx < 0 || newIdx < 0) return prev
      return recomputeStarts(arrayMove(prev, oldIdx, newIdx))
    })
  }

  // ─── Add lunch ────────────────────────────────────────────────────────────

  const addLunch = () => {
    setBlocks(prev => {
      const lunchBlock: ScheduleBlock = {
        id: 'lunch',
        objective: 'lunch' as any,
        label: 'Comida',
        startMinute: 0,
        durationMinutes: LUNCH_DURATION,
        color: OBJECTIVE_META['lunch'].color,
        isFixed: true,
      }
      // Insert after first half of blocks
      const insertAt = Math.floor(prev.length / 2)
      const next = [...prev]
      next.splice(insertAt, 0, lunchBlock)
      // Redistribute: remove 45 min from non-fixed blocks
      const nonFixed = next.filter(b => !b.isFixed)
      if (nonFixed.length > 0) {
        const perBlock = Math.floor(LUNCH_DURATION / nonFixed.length)
        let rem = LUNCH_DURATION - perBlock * nonFixed.length
        nonFixed.forEach((b, i) => {
          b.durationMinutes = Math.max(MIN_BLOCK_MINUTES, b.durationMinutes - perBlock - (i === nonFixed.length - 1 ? rem : 0))
          if (i === nonFixed.length - 1) rem = 0
        })
      }
      return recomputeStarts(next)
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

  // ─── Active drag overlay ──────────────────────────────────────────────────

  const activeBlock = activeId ? blocks.find(b => b.id === activeId) : null

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
            {/* Hour labels column */}
            <div className="flex-shrink-0 w-12 relative">
              {/* We'll overlay hour labels by using absolute within a relative wrapper that matches the timeline */}
              <div className="absolute top-0 left-0 w-full">
                <span className="text-xs text-smc-muted font-mono">{startTime}</span>
              </div>
              {hourMarkers.map(m => {
                // Calculate the px offset based on cumulative block heights up to this offsetMin
                const pxOffset = m.offsetMin * PX_PER_MIN
                return (
                  <div key={m.label} className="absolute left-0 w-full" style={{ top: `${pxOffset}px` }}>
                    <span className="text-xs text-smc-muted font-mono">{m.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Vertical rule */}
            <div
              className="flex-shrink-0 w-px bg-smc-border relative"
              style={{ minHeight: `${totalMinutes * PX_PER_MIN}px` }}
            >
              {hourMarkers.map(m => (
                <div
                  key={m.label}
                  className="absolute left-0 w-2 h-px bg-smc-border"
                  style={{ top: `${m.offsetMin * PX_PER_MIN}px` }}
                />
              ))}
            </div>

            {/* Sortable blocks */}
            <div className="flex-1 flex flex-col gap-0.5">
              <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
                {blocks.map(block => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    sessionStartMin={sessionStartMin}
                    onAdjust={delta => adjustBlock(block.id, delta)}
                    onRemove={() => removeBlock(block.id)}
                  />
                ))}
              </SortableContext>
            </div>
          </div>

          {/* Side panel — add blocks */}
          <div className="w-44 flex-shrink-0 space-y-3">
            <p className="text-xs font-semibold text-smc-muted uppercase tracking-wide">Añadir</p>

            {/* Add lunch if not present */}
            {!hasLunch && (
              <button
                onClick={addLunch}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors hover:border-yellow-500/60 hover:bg-yellow-500/10"
                style={{ borderColor: OBJECTIVE_META['lunch'].color + '40', backgroundColor: OBJECTIVE_META['lunch'].color + '10' }}
              >
                <UtensilsCrossed className="w-3.5 h-3.5 flex-shrink-0" style={{ color: OBJECTIVE_META['lunch'].color }} />
                <span className="text-xs text-smc-text flex-1 text-left">Comida</span>
                <span className="text-xs text-smc-muted flex-shrink-0">{LUNCH_DURATION}m</span>
              </button>
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

            {/* Hint */}
            <p className="text-xs text-smc-muted/60 pt-1 leading-snug">
              Arrastra el grip <GripVertical className="inline w-3 h-3" /> para reordenar bloques
            </p>
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
              <GripVertical className="w-3.5 h-3.5 text-smc-muted" />
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
