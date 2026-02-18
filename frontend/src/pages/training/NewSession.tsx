import { useForm, Controller } from 'react-hook-form'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, AlertTriangle } from 'lucide-react'
import { trainingApi } from '@/services/api/training.api'
import { pilotsApi } from '@/services/api/pilots.api'
import { db } from '@/services/indexeddb/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, CardContent } from '@/components/ui/Card'
import { TrainingObjective } from '@/types'
import TrainingScheduleBuilder from './TrainingScheduleBuilder'

// ─── Objectives config ────────────────────────────────────────────────────────

const OBJECTIVES: { value: TrainingObjective; label: string; color: string }[] = [
  { value: 'speed',              label: 'Mejorar velocidad pura',           color: '#ef4444' },
  { value: 'energy_management',  label: 'Optimizar gestión energética',      color: '#22c55e' },
  { value: 'pilot_changes',      label: 'Practicar cambios de piloto',        color: '#3b82f6' },
  { value: 'technical_setup',    label: 'Pruebas técnicas / setup',           color: '#a855f7' },
  { value: 'conditions',         label: 'Adaptación a condiciones climáticas',color: '#eab308' },
  { value: 'junior_development', label: 'Desarrollo de pilotos jóvenes',      color: '#f97316' },
  { value: 'other',              label: 'Otro',                               color: '#6b7280' },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormValues {
  date: string
  startTime: string
  endTime: string
  locationId: string
  vehicleId: string
  pilotIds: string[]
  objectives: TrainingObjective[]
  objectivesOther: string
  objectiveImportances: Record<string, number>
  notes: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

export default function NewSession() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string | null>(null)
  // Step 2: after session is created, show the schedule builder
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null)

  const locations = useLiveQuery(() => db.trainingLocations.toArray(), [])
  const vehicles  = useLiveQuery(() => db.vehicles.toArray(), [])

  const { data: pilots = [] } = useQuery({
    queryKey: ['pilots'],
    queryFn: pilotsApi.getAll,
  })

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      startTime: '09:30',
      endTime: '16:30',
      locationId: '',
      vehicleId: '',
      pilotIds: [],
      objectives: [],
      objectivesOther: '',
      objectiveImportances: {},
      notes: '',
    },
  })

  const selectedLocation   = watch('locationId')
  const selectedVehicle    = watch('vehicleId')
  const selectedObjectives = watch('objectives')
  const importances        = watch('objectiveImportances')
  const startTime          = watch('startTime')
  const endTime            = watch('endTime')

  // Auto-fill times when Karting de Rivas is selected
  const handleLocationChange = (locationId: string, onChange: (v: string) => void) => {
    onChange(locationId)
    const loc = locations?.find(l => l.id === locationId)
    if (loc?.scheduleStart) setValue('startTime', loc.scheduleStart)
    if (loc?.scheduleEnd)   setValue('endTime',   loc.scheduleEnd)
  }

  // Computed duration
  const durationMinutes = Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime))

  // Filter vehicles based on location
  const availableVehicles = vehicles?.filter(v => {
    if (!selectedLocation) return true
    const location = locations?.find(l => l.id === selectedLocation)
    if (!location) return true
    return location.allowedVehicleIds.includes(v.id)
  })

  // Warning if SMC 02 selected at Karting de Rivas
  const showRestrictionWarning = selectedLocation === 'karting_rivas' && selectedVehicle === 'smc02'

  const mutation = useMutation({
    mutationFn: trainingApi.createSession,
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['training-sessions'] })
      setCreatedSessionId(session.id)
    },
    onError: (error: any) => {
      setSaveError(`Error al guardar. Comprueba que el servidor está disponible.${error?.message ? ` (${error.message})` : ''}`)
    },
  })

  const handleObjectiveToggle = (value: TrainingObjective, current: TrainingObjective[]) => {
    const next = current.includes(value)
      ? current.filter(o => o !== value)
      : [...current, value]
    // Set default importance 5 if newly added
    if (!current.includes(value)) {
      const curr = importances ?? {}
      if (!(value in curr)) {
        setValue('objectiveImportances', { ...curr, [value]: 5 })
      }
    }
    return next
  }

  const onSubmit = (data: FormValues) => {
    setSaveError(null)
    // Serialize importances + other into notes
    const importancesData = selectedObjectives.reduce((acc, obj) => {
      acc[obj] = data.objectiveImportances?.[obj] ?? 5
      return acc
    }, {} as Record<string, number>)

    const notesData: any = { importances: importancesData }
    if (data.notes?.trim()) notesData.userNotes = data.notes.trim()

    mutation.mutate({
      ...data,
      durationMinutes,
      notes: JSON.stringify(notesData),
    } as any)
  }

  // ─── Step 2: show schedule builder ──────────────────────────────────────────
  if (createdSessionId) {
    return (
      <TrainingScheduleBuilder
        sessionId={createdSessionId}
        startTime={startTime}
        endTime={endTime}
        objectives={selectedObjectives}
        importances={importances ?? {}}
        onDone={() => navigate(`/training/${createdSessionId}`)}
      />
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link to="/training" className="p-2 rounded-lg hover:bg-smc-card text-smc-muted">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Nueva sesión de entrenamiento</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* ─── Session info ─────────────────────────────────────────────────── */}
        <Card title="Información de la sesión">
          <CardContent className="space-y-4">
            {/* Date */}
            <div>
              <label className="label">Fecha *</label>
              <Controller name="date" control={control} render={({ field }) => (
                <input type="date" {...field} className="input-field" />
              )} />
            </div>

            {/* Time range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Hora inicio *</label>
                <Controller name="startTime" control={control} render={({ field }) => (
                  <input type="time" {...field} className="input-field" />
                )} />
              </div>
              <div>
                <label className="label">Hora fin *</label>
                <Controller name="endTime" control={control} render={({ field }) => (
                  <input type="time" {...field} className="input-field" />
                )} />
              </div>
            </div>
            {durationMinutes > 0 && (
              <p className="text-xs text-smc-muted -mt-2">
                Duración total: <span className="text-white font-semibold">{durationMinutes} min</span>
                {' '}({Math.floor(durationMinutes / 60)}h {durationMinutes % 60}min)
              </p>
            )}

            {/* Location + Vehicle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Localización *</label>
                <Controller name="locationId" control={control} render={({ field }) => (
                  <select
                    value={field.value}
                    onChange={e => handleLocationChange(e.target.value, field.onChange)}
                    className="input-field"
                  >
                    <option value="">Seleccionar...</option>
                    {locations?.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                )} />
              </div>
              <div>
                <label className="label">Vehículo *</label>
                <Controller name="vehicleId" control={control} render={({ field }) => (
                  <select {...field} className="input-field">
                    <option value="">Seleccionar...</option>
                    {availableVehicles?.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                )} />
                {showRestrictionWarning && (
                  <p className="text-xs text-danger mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    SMC 02 EVO no puede entrenar en Karting de Rivas
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ─── Pilots ───────────────────────────────────────────────────────── */}
        <Card title="Pilotos participantes">
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {pilots.filter(p => p.availability).map(pilot => (
                <Controller
                  key={pilot.id}
                  name="pilotIds"
                  control={control}
                  render={({ field }) => (
                    <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                      field.value.includes(pilot.id)
                        ? 'border-primary bg-primary/10'
                        : 'border-smc-border bg-smc-darker hover:border-primary/40'
                    }`}>
                      <input
                        type="checkbox"
                        checked={field.value.includes(pilot.id)}
                        onChange={e => {
                          const updated = e.target.checked
                            ? [...field.value, pilot.id]
                            : field.value.filter((id: string) => id !== pilot.id)
                          field.onChange(updated)
                        }}
                        className="sr-only"
                      />
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {pilot.fullName.charAt(0)}
                      </div>
                      <span className="text-sm text-smc-text truncate">{pilot.fullName}</span>
                    </label>
                  )}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ─── Objectives + importances ─────────────────────────────────────── */}
        <Card title="Objetivos de la sesión">
          <CardContent>
            <Controller
              name="objectives"
              control={control}
              render={({ field }) => (
                <div className="space-y-3">
                  {OBJECTIVES.map(obj => {
                    const isSelected = field.value.includes(obj.value)
                    const importance = importances?.[obj.value] ?? 5
                    return (
                      <div key={obj.value}>
                        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/10'
                            : 'border-smc-border hover:border-primary/30'
                        }`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => field.onChange(handleObjectiveToggle(obj.value, field.value))}
                            className="w-4 h-4 accent-primary"
                          />
                          {/* Color dot */}
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: obj.color }} />
                          <span className="text-sm text-smc-text flex-1">{obj.label}</span>
                          {isSelected && (
                            <span className="text-xs text-smc-muted">Importancia: <span className="text-white font-semibold">{importance}</span></span>
                          )}
                        </label>

                        {/* Importance slider — shown inline when selected */}
                        {isSelected && (
                          <div className="mx-3 mt-1 mb-1">
                            <Controller
                              name={`objectiveImportances.${obj.value}` as any}
                              control={control}
                              defaultValue={5}
                              render={({ field: impField }) => (
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-smc-muted w-4">1</span>
                                  <input
                                    type="range"
                                    min={1}
                                    max={10}
                                    step={1}
                                    value={impField.value ?? 5}
                                    onChange={e => impField.onChange(+e.target.value)}
                                    className="flex-1 accent-primary h-1.5"
                                    style={{ accentColor: obj.color }}
                                  />
                                  <span className="text-xs text-smc-muted w-4 text-right">10</span>
                                </div>
                              )}
                            />
                          </div>
                        )}

                        {/* Textarea for "other" objective */}
                        {isSelected && obj.value === 'other' && (
                          <div className="mx-3 mt-2">
                            <Controller
                              name="objectivesOther"
                              control={control}
                              render={({ field: otherField }) => (
                                <textarea
                                  {...otherField}
                                  className="input-field resize-none text-sm"
                                  rows={2}
                                  placeholder="Describe el objetivo específico..."
                                />
                              )}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            />
          </CardContent>
        </Card>

        {/* ─── Notes ────────────────────────────────────────────────────────── */}
        <Card title="Notas">
          <CardContent>
            <Controller name="notes" control={control} render={({ field }) => (
              <textarea {...field} className="input-field resize-none" rows={3}
                placeholder="Observaciones previas, condiciones climáticas, etc." />
            )} />
          </CardContent>
        </Card>

        {saveError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {saveError}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link to="/training" className="btn-secondary">Cancelar</Link>
          <button
            type="submit"
            disabled={mutation.isPending || showRestrictionWarning || durationMinutes <= 0}
            className="btn-primary flex items-center gap-2"
          >
            {mutation.isPending ? 'Creando...' : (
              <>
                Crear sesión
                {selectedObjectives.length > 0 && <span className="text-xs opacity-75">→ generar horario</span>}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
