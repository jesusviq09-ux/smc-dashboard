import { useForm, Controller } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Save, AlertTriangle } from 'lucide-react'
import { trainingApi } from '@/services/api/training.api'
import { pilotsApi } from '@/services/api/pilots.api'
import { db } from '@/services/indexeddb/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { Card, CardContent } from '@/components/ui/Card'
import { TrainingObjective } from '@/types'

const OBJECTIVES: { value: TrainingObjective; label: string }[] = [
  { value: 'speed', label: 'Mejorar velocidad pura' },
  { value: 'energy_management', label: 'Optimizar gestión energética' },
  { value: 'pilot_changes', label: 'Practicar cambios de piloto' },
  { value: 'conditions', label: 'Adaptación a condiciones climáticas' },
  { value: 'technical_setup', label: 'Pruebas técnicas / setup' },
  { value: 'other', label: 'Otro' },
]

export default function NewSession() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const locations = useLiveQuery(() => db.trainingLocations.toArray(), [])
  const vehicles = useLiveQuery(() => db.vehicles.toArray(), [])

  const { data: pilots = [] } = useQuery({
    queryKey: ['pilots'],
    queryFn: pilotsApi.getAll,
  })

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      locationId: '',
      vehicleId: '',
      pilotIds: [] as string[],
      durationMinutes: 60,
      objectives: [] as TrainingObjective[],
      objectivesOther: '',
      notes: '',
    },
  })

  const selectedLocation = watch('locationId')
  const selectedVehicle = watch('vehicleId')

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
      navigate(`/training/${session.id}`)
    },
  })

  const handleObjectiveToggle = (value: TrainingObjective, current: TrainingObjective[]) => {
    return current.includes(value)
      ? current.filter(o => o !== value)
      : [...current, value]
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link to="/training" className="p-2 rounded-lg hover:bg-smc-card text-smc-muted">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Nueva sesión de entrenamiento</h1>
      </div>

      <form onSubmit={handleSubmit(data => mutation.mutate(data as any))} className="space-y-6">
        <Card title="Información de la sesión">
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Fecha *</label>
              <Controller name="date" control={control} render={({ field }) => (
                <input type="date" {...field} className="input-field" />
              )} />
            </div>
            <div>
              <label className="label">Duración (minutos) *</label>
              <Controller name="durationMinutes" control={control} render={({ field }) => (
                <input type="number" {...field} className="input-field" min={15} max={480}
                  onChange={e => field.onChange(+e.target.value)} />
              )} />
            </div>
            <div>
              <label className="label">Localización *</label>
              <Controller name="locationId" control={control} render={({ field }) => (
                <select {...field} className="input-field">
                  <option value="">Seleccionar...</option>
                  {locations?.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )} />
              {selectedLocation === 'karting_rivas' && (
                <p className="text-xs text-info mt-1">Horario: 9:30 - 16:30</p>
              )}
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
          </CardContent>
        </Card>

        {/* Pilots */}
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

        {/* Objectives */}
        <Card title="Objetivos de la sesión">
          <CardContent>
            <Controller
              name="objectives"
              control={control}
              render={({ field }) => (
                <div className="space-y-2">
                  {OBJECTIVES.map(obj => (
                    <label key={obj.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      field.value.includes(obj.value)
                        ? 'border-primary bg-primary/10'
                        : 'border-smc-border hover:border-primary/30'
                    }`}>
                      <input
                        type="checkbox"
                        checked={field.value.includes(obj.value)}
                        onChange={() => field.onChange(handleObjectiveToggle(obj.value, field.value))}
                        className="w-4 h-4 accent-primary"
                      />
                      <span className="text-sm text-smc-text">{obj.label}</span>
                    </label>
                  ))}
                </div>
              )}
            />
          </CardContent>
        </Card>

        {/* Notes */}
        <Card title="Notas">
          <CardContent>
            <Controller name="notes" control={control} render={({ field }) => (
              <textarea {...field} className="input-field resize-none" rows={3}
                placeholder="Observaciones previas, condiciones climáticas, etc." />
            )} />
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Link to="/training" className="btn-secondary">Cancelar</Link>
          <button
            type="submit"
            disabled={mutation.isPending || showRestrictionWarning}
            className="btn-primary flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Creando...' : 'Crear sesión'}
          </button>
        </div>
      </form>
    </div>
  )
}
