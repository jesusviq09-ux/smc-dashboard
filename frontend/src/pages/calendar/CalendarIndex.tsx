import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, X, Pencil, Trash2 } from 'lucide-react'
import { calendarApi, CalendarEventItem } from '@/services/api/calendar.api'
import { raceApi } from '@/services/api/race.api'
import { trainingApi } from '@/services/api/training.api'
import { maintenanceApi } from '@/services/api/maintenance.api'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO, isToday } from 'date-fns'
import { es } from 'date-fns/locale'

type UnifiedEvent = {
  id: string
  title: string
  date: string
  type: 'race' | 'training' | 'maintenance' | 'custom'
}

const TYPE_STYLES = {
  race: 'bg-primary/20 text-primary',
  training: 'bg-success/20 text-success',
  maintenance: 'bg-warning/20 text-warning',
  custom: 'bg-blue-500/20 text-blue-400',
}

const TYPE_LABELS = {
  race: '🏁',
  training: '🏋️',
  maintenance: '🔧',
  custom: '📅',
}

const EMPTY_FORM = { title: '', date: '', endDate: '', type: 'event' as CalendarEventItem['type'], description: '', color: '' }

export default function CalendarIndex() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [editingEvent, setEditingEvent] = useState<CalendarEventItem | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

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

  const allEvents: UnifiedEvent[] = useMemo(() => [
    ...races.map(r => ({ id: r.id, title: r.name, date: r.date, type: 'race' as const })),
    ...trainings.map(t => ({ id: t.id, title: `Entrenamiento`, date: t.date, type: 'training' as const })),
    ...(maintenanceRecords as any[]).map(m => ({ id: m.id, title: m.description || 'Mantenimiento', date: m.date, type: 'maintenance' as const })),
    ...customEvents.map(e => ({ id: e.id, title: e.title, date: e.date, type: 'custom' as const })),
  ], [races, trainings, maintenanceRecords, customEvents])

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let d = gridStart
  while (d <= gridEnd) { days.push(d); d = addDays(d, 1) }

  const getEventsForDay = (day: Date) =>
    allEvents.filter(e => isSameDay(parseISO(e.date), day))

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
    const payload = {
      title: form.title,
      date: form.date,
      type: form.type,
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

  const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

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
          <button onClick={() => openCreateModal(new Date())} className="btn-primary text-sm flex items-center gap-1 py-1.5">
            <Plus className="w-4 h-4" /> Evento
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {(Object.entries(TYPE_LABELS) as [keyof typeof TYPE_LABELS, string][]).map(([type, icon]) => (
          <span key={type} className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${TYPE_STYLES[type]}`}>
            {icon} {type === 'race' ? 'Carreras' : type === 'training' ? 'Entrenamientos' : type === 'maintenance' ? 'Mantenimiento' : 'Eventos propios'}
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
                  {events.slice(0, 3).map(ev => (
                    <div
                      key={ev.id}
                      onClick={e => {
                        e.stopPropagation()
                        if (ev.type === 'custom') {
                          const full = customEvents.find(c => c.id === ev.id)
                          if (full) openEditModal(full)
                        }
                      }}
                      className={`text-xs px-1 py-0.5 rounded truncate ${TYPE_STYLES[ev.type]} ${ev.type === 'custom' ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
                    >
                      {TYPE_LABELS[ev.type]} {ev.title}
                    </div>
                  ))}
                  {events.length > 3 && (
                    <div className="text-xs text-smc-muted px-1">+{events.length - 3} más</div>
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
              <div>
                <label className="label">Tipo</label>
                <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as CalendarEventItem['type'] }))}>
                  <option value="event">Evento</option>
                  <option value="reminder">Recordatorio</option>
                  <option value="meeting">Reunión</option>
                </select>
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
