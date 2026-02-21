import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, X, Trash2, Download, Settings2 } from 'lucide-react'
import { calendarApi, CalendarEventItem } from '@/services/api/calendar.api'
import { raceApi } from '@/services/api/race.api'
import { trainingApi } from '@/services/api/training.api'
import { maintenanceApi } from '@/services/api/maintenance.api'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO, isToday, startOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Types ────────────────────────────────────────────────────────────────────

type UnifiedEvent = {
  id: string
  title: string
  date: string
  endDate?: string
  type: string   // 'race' | 'training' | 'maintenance' | 'custom' | category.id
}

interface CalendarCategory {
  id: string
  name: string
  emoji: string
  color: string
  isDefault?: boolean
}

// ─── Default categories ───────────────────────────────────────────────────────

const DEFAULT_CATEGORIES: CalendarCategory[] = [
  { id: 'event',    name: 'Evento',        emoji: '📅', color: '#3b82f6', isDefault: true },
  { id: 'reminder', name: 'Recordatorio',  emoji: '🔔', color: '#f59e0b', isDefault: true },
  { id: 'meeting',  name: 'Reunión',       emoji: '🤝', color: '#a855f7', isDefault: true },
]

const SYSTEM_TYPE_STYLES: Record<string, string> = {
  race:        'bg-primary/20 text-primary',
  training:    'bg-success/20 text-success',
  maintenance: 'bg-warning/20 text-warning',
}
const SYSTEM_TYPE_LABELS: Record<string, string> = {
  race:        '🏁',
  training:    '🏋️',
  maintenance: '🔧',
}
const SYSTEM_TYPE_NAMES: Record<string, string> = {
  race:        'Carreras',
  training:    'Entrenamientos',
  maintenance: 'Mantenimiento',
}

const PALETTE = ['#3b82f6', '#22c55e', '#ef4444', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#6b7280']

const LS_KEY = 'smc_calendar_categories'

function loadCategories(): CalendarCategory[] {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return JSON.parse(raw) as CalendarCategory[]
  } catch { /* ignore */ }
  return DEFAULT_CATEGORIES
}

function saveCategories(cats: CalendarCategory[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(cats))
}

const EMPTY_FORM = {
  title: '', date: '', endDate: '', type: 'event',
  description: '', color: '',
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalendarIndex() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  // Overflow day modal
  const [overflowDay, setOverflowDay] = useState<Date | null>(null)

  // Categories state (localStorage)
  const [categories, setCategories] = useState<CalendarCategory[]>(loadCategories)
  const [showCatManager, setShowCatManager] = useState(false)
  const [newCatForm, setNewCatForm] = useState({ name: '', emoji: '📌', color: PALETTE[0] })
  const [editingCat, setEditingCat] = useState<CalendarCategory | null>(null)
  const [addingCat, setAddingCat] = useState(false)

  const qc = useQueryClient()

  const { data: customEvents = [] } = useQuery({ queryKey: ['calendar-events'], queryFn: calendarApi.getEvents })
  const { data: races = [] } = useQuery({ queryKey: ['race-events'], queryFn: raceApi.getEvents })
  const { data: trainings = [] } = useQuery({ queryKey: ['training-sessions'], queryFn: trainingApi.getSessions })
  const { data: maintenanceRecords = [] } = useQuery({ queryKey: ['maintenance'], queryFn: () => maintenanceApi.getRecords() })

  const createMutation = useMutation({
    mutationFn: calendarApi.createEvent,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar-events'] }); closeModal() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CalendarEventItem> }) => calendarApi.updateEvent(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar-events'] }); closeModal() },
  })

  const deleteMutation = useMutation({
    mutationFn: calendarApi.deleteEvent,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['calendar-events'] }); setDeleteConfirmId(null) },
  })

  // ─── Category helpers ─────────────────────────────────────────────────────

  const persistCategories = (cats: CalendarCategory[]) => {
    setCategories(cats)
    saveCategories(cats)
  }

  const getCategoryById = (typeId: string): CalendarCategory | undefined =>
    categories.find(c => c.id === typeId)

  const getEventLabel = (typeId: string): string => {
    if (SYSTEM_TYPE_LABELS[typeId]) return SYSTEM_TYPE_LABELS[typeId]
    return getCategoryById(typeId)?.emoji ?? '📅'
  }

  const getEventBgStyle = (typeId: string): React.CSSProperties => {
    if (SYSTEM_TYPE_STYLES[typeId]) return {}
    const cat = getCategoryById(typeId)
    if (cat) return { backgroundColor: cat.color + '25', color: cat.color }
    return {}
  }

  // ─── Unified events ───────────────────────────────────────────────────────

  const allEvents: UnifiedEvent[] = useMemo(() => [
    ...races.map(r => ({ id: r.id, title: r.name, date: r.date.slice(0, 10), type: 'race' })),
    ...trainings.map(t => ({ id: t.id, title: 'Entrenamiento', date: (t.date as string).slice(0, 10), type: 'training' })),
    ...(maintenanceRecords as any[]).map(m => ({ id: m.id, title: m.description || 'Mantenimiento', date: (m.date as string).slice(0, 10), type: 'maintenance' })),
    ...customEvents.map(e => ({ id: e.id, title: e.title, date: e.date, endDate: e.endDate, type: e.type })),
  ], [races, trainings, maintenanceRecords, customEvents])

  // ─── Calendar grid ────────────────────────────────────────────────────────

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let d = gridStart
  while (d <= gridEnd) { days.push(d); d = addDays(d, 1) }

  const getEventsForDay = (day: Date) =>
    allEvents.filter(e => {
      const start = startOfDay(parseISO(e.date))
      if (!e.endDate) return isSameDay(start, day)
      const end = startOfDay(parseISO(e.endDate))
      const dd = startOfDay(day)
      return dd >= start && dd <= end
    })

  const isEventStart = (ev: UnifiedEvent, day: Date) => isSameDay(parseISO(ev.date), day)
  const isEventEnd = (ev: UnifiedEvent, day: Date) =>
    ev.endDate ? isSameDay(parseISO(ev.endDate), day) : isSameDay(parseISO(ev.date), day)
  const isMultiDay = (ev: UnifiedEvent) => !!ev.endDate && ev.date !== ev.endDate

  // ─── Modal helpers ────────────────────────────────────────────────────────

  const openCreateModal = (day: Date) => {
    setEditingEvent(null)
    setForm({ ...EMPTY_FORM, date: format(day, 'yyyy-MM-dd') })
    setShowModal(true)
  }

  const openEditModal = (event: CalendarEventItem) => {
    setEditingEvent(event)
    setForm({
      title: event.title,
      date: event.date,
      endDate: event.endDate ?? '',
      type: event.type,
      description: event.description ?? '',
      color: event.color ?? '',
    })
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditingEvent(null); setForm(EMPTY_FORM) }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title || !form.date) return
    const payload: Omit<CalendarEventItem, 'id'> = {
      title: form.title,
      date: form.date,
      type: form.type as CalendarEventItem['type'],
      endDate: form.endDate || undefined,
      description: form.description || undefined,
      color: form.color || undefined,
    }
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  // ─── Category management ──────────────────────────────────────────────────

  const handleAddCategory = () => {
    if (!newCatForm.name.trim()) return
    const cat: CalendarCategory = {
      id: `cat_${Date.now()}`,
      name: newCatForm.name.trim(),
      emoji: newCatForm.emoji || '📌',
      color: newCatForm.color,
    }
    persistCategories([...categories, cat])
    setNewCatForm({ name: '', emoji: '📌', color: PALETTE[0] })
    setAddingCat(false)
    // Auto-select the new category in the event form
    setForm(f => ({ ...f, type: cat.id }))
  }

  const handleUpdateCategory = () => {
    if (!editingCat) return
    persistCategories(categories.map(c => c.id === editingCat.id ? editingCat : c))
    setEditingCat(null)
  }

  const handleDeleteCategory = (id: string) => {
    persistCategories(categories.filter(c => c.id !== id))
  }

  // ─── PDF export ───────────────────────────────────────────────────────────

  const exportCalendarPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' })
    const monthLabel = format(currentMonth, 'MMMM yyyy', { locale: es })

    // Cabecera — sin emojis (jsPDF/Helvetica no los soporta)
    doc.setFontSize(16)
    doc.setTextColor(0, 180, 220)
    doc.text(`SMC Greenpower - Calendario: ${monthLabel}`, 14, 16)
    doc.setFontSize(8)
    doc.setTextColor(130, 130, 130)
    doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 14, 22)

    // Etiquetas de tipo en texto plano (sin emoji)
    const getTypeText = (type: string): string => {
      const map: Record<string, string> = {
        race:        'Carrera',
        training:    'Entreno',
        maintenance: 'Mant.',
      }
      return map[type] ?? (getCategoryById(type)?.name ?? 'Evento')
    }

    // Construir cuadricula del mes (semanas × 7 dias)
    const monthStart = startOfMonth(currentMonth)
    const monthEnd   = endOfMonth(currentMonth)
    const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 })
    const calEnd     = endOfWeek(monthEnd,   { weekStartsOn: 1 })

    const weeks: Date[][] = []
    let cur = calStart
    while (cur <= calEnd) {
      const week: Date[] = []
      for (let i = 0; i < 7; i++) { week.push(cur); cur = addDays(cur, 1) }
      weeks.push(week)
    }

    const todayDate = new Date()

    const tableBody = weeks.map(week =>
      week.map(day => {
        const inMonth      = isSameMonth(day, currentMonth)
        const isCurrentDay = isSameDay(day, todayDate)
        const dayEvents    = allEvents.filter(e => isSameDay(parseISO(e.date), day))

        const lines = [format(day, 'd')]
        dayEvents.slice(0, 3).forEach(ev => {
          const label = getTypeText(ev.type)
          const title = ev.title.length > 18 ? ev.title.substring(0, 17) + '...' : ev.title
          lines.push(`[${label}] ${title}`)
        })
        if (dayEvents.length > 3) lines.push(`+${dayEvents.length - 3} mas`)

        return {
          content: lines.join('\n'),
          styles: {
            textColor: inMonth ? [210, 210, 210] : [70, 70, 70],
            fillColor: isCurrentDay ? [20, 55, 80] : [22, 27, 34],
            fontStyle: isCurrentDay ? 'bold' : 'normal',
          } as Record<string, unknown>,
        }
      })
    )

    autoTable(doc, {
      startY: 27,
      head: [['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom']],
      body: tableBody,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 100, 130],
        textColor: [255, 255, 255],
        halign: 'center',
        fontSize: 9,
        fontStyle: 'bold',
      },
      styles: {
        fontSize: 7,
        fillColor: [22, 27, 34],
        textColor: [210, 210, 210],
        cellPadding: 2,
        valign: 'top',
        minCellHeight: 28,
        lineColor: [50, 60, 70],
        lineWidth: 0.3,
      },
      alternateRowStyles: {},
      columnStyles: {
        0: { cellWidth: 38 }, 1: { cellWidth: 38 }, 2: { cellWidth: 38 },
        3: { cellWidth: 38 }, 4: { cellWidth: 38 }, 5: { cellWidth: 38 },
        6: { cellWidth: 38 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.cell.raw && typeof data.cell.raw === 'object') {
          const raw = data.cell.raw as { content: string; styles?: Record<string, unknown> }
          if (raw.styles) Object.assign(data.cell.styles, raw.styles)
        }
      },
    })

    doc.save(`SMC-calendario-${format(currentMonth, 'yyyy-MM')}.pdf`)
  }

  const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-2 rounded-lg hover:bg-smc-card text-smc-muted">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-white capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: es })}
          </h1>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-2 rounded-lg hover:bg-smc-card text-smc-muted">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentMonth(new Date())} className="btn-secondary text-sm py-1.5">Hoy</button>
          <button onClick={exportCalendarPDF} className="btn-secondary text-sm flex items-center gap-1 py-1.5" title="Exportar PDF del mes">
            <Download className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => setShowCatManager(true)} className="btn-secondary text-sm flex items-center gap-1 py-1.5" title="Gestionar categorías">
            <Settings2 className="w-4 h-4" />
          </button>
          <button onClick={() => openCreateModal(new Date())} className="btn-primary text-sm flex items-center gap-1 py-1.5">
            <Plus className="w-4 h-4" /> Evento
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 text-xs">
        {(Object.entries(SYSTEM_TYPE_LABELS) as [string, string][]).map(([type, icon]) => (
          <span key={type} className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${SYSTEM_TYPE_STYLES[type]}`}>
            {icon} {SYSTEM_TYPE_NAMES[type]}
          </span>
        ))}
        {categories.map(cat => (
          <span key={cat.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: cat.color + '30', color: cat.color }}>
            {cat.emoji} {cat.name}
          </span>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="bg-smc-card border border-smc-border rounded-xl overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-smc-border">
          {DAY_NAMES.map(name => (
            <div key={name} className="py-2 text-center text-xs font-medium text-smc-muted">{name}</div>
          ))}
        </div>
        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const events = getEventsForDay(day)
            const inCurrentMonth = isSameMonth(day, currentMonth)
            const today = isToday(day)

            return (
              <div
                key={i}
                onClick={() => openCreateModal(day)}
                className={`min-h-[80px] p-1.5 border-r border-b border-smc-border cursor-pointer hover:bg-smc-darker transition-colors ${
                  !inCurrentMonth ? 'opacity-30' : ''
                } ${i % 7 === 6 ? 'border-r-0' : ''}`}
              >
                <div className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full mb-1 ${
                  today ? 'bg-primary text-white' : 'text-smc-muted'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {events.slice(0, 3).map(ev => {
                    const multi = isMultiDay(ev)
                    const start = isEventStart(ev, day)
                    const end = isEventEnd(ev, day)
                    const middle = multi && !start && !end
                    const radius = !multi ? 'rounded' : start ? 'rounded-l rounded-r-none' : end ? 'rounded-r rounded-l-none' : 'rounded-none'
                    const px = middle || (multi && end) ? 'px-0' : 'px-1'
                    const showTitle = !multi || start
                    const sysStyle = SYSTEM_TYPE_STYLES[ev.type]

                    return (
                      <div
                        key={ev.id}
                        onClick={e => {
                          e.stopPropagation()
                          if (ev.type !== 'race' && ev.type !== 'training' && ev.type !== 'maintenance') {
                            const full = customEvents.find(c => c.id === ev.id)
                            if (full) openEditModal(full)
                          }
                        }}
                        className={`text-xs py-0.5 truncate ${radius} ${px} ${sysStyle ?? ''} ${ev.type !== 'race' && ev.type !== 'training' && ev.type !== 'maintenance' ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                        style={!sysStyle ? getEventBgStyle(ev.type) : undefined}
                        title={ev.title}
                      >
                        {showTitle ? <>{getEventLabel(ev.type)} {ev.title}</> : <>&nbsp;</>}
                      </div>
                    )
                  })}
                  {events.length > 3 && (
                    <button
                      onClick={e => { e.stopPropagation(); setOverflowDay(day) }}
                      className="text-xs text-primary px-1 hover:underline w-full text-left"
                    >
                      +{events.length - 3} más
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-smc-card border border-smc-border rounded-xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">{editingEvent ? 'Editar evento' : 'Nuevo evento'}</h3>
              <button onClick={closeModal} className="text-smc-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label">Título *</label>
                <input className="input-field" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Nombre del evento" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Fecha inicio *</label>
                  <input type="date" className="input-field" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Fecha fin</label>
                  <input type="date" className="input-field" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>
              {/* Category selector */}
              <div>
                <label className="label">Categoría</label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, type: cat.id }))}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                        form.type === cat.id
                          ? 'border-2 font-semibold'
                          : 'border-smc-border text-smc-muted hover:border-smc-text/40'
                      }`}
                      style={form.type === cat.id ? { borderColor: cat.color, color: cat.color, backgroundColor: cat.color + '18' } : {}}
                    >
                      {cat.emoji} {cat.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setAddingCat(true); setShowCatManager(false) }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border border-dashed border-smc-border text-smc-muted hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Nueva
                  </button>
                </div>
                {/* Inline new-category form */}
                {addingCat && (
                  <div className="mt-2 p-3 bg-smc-darker rounded-lg border border-smc-border space-y-2">
                    <p className="text-xs text-smc-muted font-semibold">Nueva categoría</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={2}
                        value={newCatForm.emoji}
                        onChange={e => setNewCatForm(f => ({ ...f, emoji: e.target.value }))}
                        placeholder="🏷"
                        className="input-field w-12 text-center px-1"
                      />
                      <input
                        type="text"
                        value={newCatForm.name}
                        onChange={e => setNewCatForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Nombre..."
                        className="input-field flex-1"
                      />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {PALETTE.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewCatForm(f => ({ ...f, color: c }))}
                          className={`w-6 h-6 rounded-full border-2 transition-transform ${newCatForm.color === c ? 'scale-125 border-white' : 'border-transparent'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button type="button" onClick={() => setAddingCat(false)} className="btn-secondary text-xs py-1">Cancelar</button>
                      <button type="button" onClick={handleAddCategory} className="btn-primary text-xs py-1">Añadir</button>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea className="input-field resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Detalles del evento..." />
              </div>
              <div className="flex justify-between items-center pt-2">
                {editingEvent ? (
                  <button type="button" onClick={() => setDeleteConfirmId(editingEvent.id)} className="text-danger text-sm flex items-center gap-1 hover:underline">
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
                  </button>
                ) : <div />}
                <div className="flex gap-2">
                  <button type="button" onClick={closeModal} className="btn-secondary text-sm py-1.5">Cancelar</button>
                  <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="btn-primary text-sm py-1.5">
                    {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Overflow day modal */}
      {overflowDay && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-smc-card border border-smc-border rounded-xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white capitalize">
                {format(overflowDay, "EEEE d 'de' MMMM", { locale: es })}
              </h3>
              <button onClick={() => setOverflowDay(null)} className="text-smc-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {getEventsForDay(overflowDay).map(ev => {
                const sysStyle = SYSTEM_TYPE_STYLES[ev.type]
                const isEditable = ev.type !== 'race' && ev.type !== 'training' && ev.type !== 'maintenance'
                return (
                  <div
                    key={ev.id}
                    onClick={() => {
                      if (isEditable) {
                        const full = customEvents.find(c => c.id === ev.id)
                        if (full) { setOverflowDay(null); openEditModal(full) }
                      }
                    }}
                    className={`text-xs px-2.5 py-2 rounded-lg flex items-center gap-2 ${sysStyle ?? ''} ${isEditable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                    style={!sysStyle ? getEventBgStyle(ev.type) : undefined}
                  >
                    <span className="flex-shrink-0">{getEventLabel(ev.type)}</span>
                    <span className="flex-1 font-medium truncate">{ev.title}</span>
                    {isEditable && <span className="text-smc-muted/60 flex-shrink-0">Editar →</span>}
                  </div>
                )
              })}
            </div>
            <button
              onClick={() => { setOverflowDay(null); openCreateModal(overflowDay) }}
              className="btn-primary w-full mt-3 text-sm py-1.5 flex items-center justify-center gap-1"
            >
              <Plus className="w-4 h-4" /> Nuevo evento este día
            </button>
          </div>
        </div>
      )}

      {/* Category manager modal */}
      {showCatManager && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-smc-card border border-smc-border rounded-xl p-5 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Gestionar categorías</h3>
              <button onClick={() => setShowCatManager(false)} className="text-smc-muted hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 p-2 rounded-lg bg-smc-darker">
                  {editingCat?.id === cat.id ? (
                    <>
                      <input
                        type="text"
                        maxLength={2}
                        value={editingCat.emoji}
                        onChange={e => setEditingCat(c => c ? { ...c, emoji: e.target.value } : c)}
                        className="input-field w-10 text-center px-1 text-sm py-1"
                      />
                      <input
                        type="text"
                        value={editingCat.name}
                        onChange={e => setEditingCat(c => c ? { ...c, name: e.target.value } : c)}
                        className="input-field flex-1 text-sm py-1"
                      />
                      <div className="flex gap-1">
                        {PALETTE.map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditingCat(ec => ec ? { ...ec, color: c } : ec)}
                            className={`w-4 h-4 rounded-full border ${editingCat.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </div>
                      <button onClick={handleUpdateCategory} className="text-xs text-success hover:underline">✓</button>
                      <button onClick={() => setEditingCat(null)} className="text-xs text-smc-muted hover:underline">✕</button>
                    </>
                  ) : (
                    <>
                      <span className="text-base">{cat.emoji}</span>
                      <span className="flex-1 text-sm font-medium" style={{ color: cat.color }}>{cat.name}</span>
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      {!cat.isDefault && (
                        <>
                          <button onClick={() => setEditingCat(cat)} className="text-xs text-smc-muted hover:text-white px-1">✏</button>
                          <button onClick={() => handleDeleteCategory(cat.id)} className="text-xs text-danger hover:text-red-400 px-1">✕</button>
                        </>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            {/* Add new category from manager */}
            {addingCat ? (
              <div className="mt-3 p-3 bg-smc-darker rounded-lg border border-smc-border space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={2}
                    value={newCatForm.emoji}
                    onChange={e => setNewCatForm(f => ({ ...f, emoji: e.target.value }))}
                    placeholder="🏷"
                    className="input-field w-12 text-center px-1"
                  />
                  <input
                    type="text"
                    value={newCatForm.name}
                    onChange={e => setNewCatForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Nombre de categoría..."
                    className="input-field flex-1"
                  />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {PALETTE.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewCatForm(f => ({ ...f, color: c }))}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${newCatForm.color === c ? 'scale-125 border-white' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setAddingCat(false)} className="btn-secondary text-xs py-1">Cancelar</button>
                  <button type="button" onClick={handleAddCategory} className="btn-primary text-xs py-1">Añadir</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingCat(true)}
                className="w-full mt-3 flex items-center justify-center gap-1 text-sm text-smc-muted hover:text-white border border-dashed border-smc-border hover:border-primary/40 rounded-lg py-2 transition-colors"
              >
                <Plus className="w-4 h-4" /> Nueva categoría
              </button>
            )}

            <button onClick={() => setShowCatManager(false)} className="btn-secondary w-full mt-3 text-sm py-1.5">
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-smc-card border border-smc-border rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-white mb-2">¿Eliminar este evento?</h3>
            <p className="text-sm text-smc-muted mb-4">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirmId(null)} className="btn-secondary text-sm py-1.5">Cancelar</button>
              <button onClick={() => deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending} className="btn-danger text-sm py-1.5">
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
