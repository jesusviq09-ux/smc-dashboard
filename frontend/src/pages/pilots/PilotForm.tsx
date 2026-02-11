import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ChevronLeft, Save } from 'lucide-react'
import { pilotsApi } from '@/services/api/pilots.api'
import { Card, CardContent } from '@/components/ui/Card'
import ScoreRing from '@/components/ui/ScoreRing'
import { RATING_LABELS, RATING_WEIGHTS, calculateWeightedScore } from '@/utils/pilotScore'
import { useEffect } from 'react'
import { PilotRatings } from '@/types'

const pilotSchema = z.object({
  fullName: z.string().min(2, 'Mínimo 2 caracteres'),
  dni: z.string().min(5, 'DNI requerido'),
  age: z.number().min(10).max(100),
  weightKg: z.number().min(20).max(200),
  heightCm: z.number().min(100).max(250),
  availability: z.boolean(),
  joinDate: z.string().min(1, 'Fecha requerida'),
  notes: z.string().optional(),
  ratings: z.object({
    experience: z.number().min(1).max(10),
    driving: z.number().min(1).max(10),
    energyManagement: z.number().min(1).max(10),
    teamwork: z.number().min(1).max(10),
    consistency: z.number().min(1).max(10),
    adaptation: z.number().min(1).max(10),
  }),
})

type PilotFormData = z.infer<typeof pilotSchema>

export default function PilotForm() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: existingPilot } = useQuery({
    queryKey: ['pilot', id],
    queryFn: () => pilotsApi.getById(id!),
    enabled: isEditing,
  })

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<PilotFormData>({
    resolver: zodResolver(pilotSchema),
    defaultValues: {
      fullName: '',
      dni: '',
      age: 16,
      weightKg: 60,
      heightCm: 170,
      availability: true,
      joinDate: new Date().toISOString().split('T')[0],
      notes: '',
      ratings: { experience: 5, driving: 5, energyManagement: 5, teamwork: 5, consistency: 5, adaptation: 5 },
    },
  })

  useEffect(() => {
    if (existingPilot) {
      setValue('fullName', existingPilot.fullName)
      setValue('dni', existingPilot.dni)
      setValue('age', existingPilot.age)
      setValue('weightKg', existingPilot.weightKg)
      setValue('heightCm', existingPilot.heightCm)
      setValue('availability', existingPilot.availability)
      setValue('joinDate', existingPilot.joinDate.split('T')[0])
      setValue('notes', existingPilot.notes ?? '')
      setValue('ratings', existingPilot.ratings)
    }
  }, [existingPilot, setValue])

  const mutation = useMutation({
    mutationFn: (data: PilotFormData) =>
      isEditing
        ? pilotsApi.update(id!, data)
        : pilotsApi.create(data),
    onSuccess: (pilot) => {
      queryClient.invalidateQueries({ queryKey: ['pilots'] })
      navigate(`/pilots/${pilot.id}`)
    },
  })

  const watchedRatings = watch('ratings')
  const watchedWeight = watch('weightKg')
  const currentScore = calculateWeightedScore(
    watchedRatings as PilotRatings,
    watchedWeight
  )
  const weightPenalty = Math.max(0, Math.floor((watchedWeight - 50) / 10)) * 0.2

  const onSubmit = (data: PilotFormData) => mutation.mutate(data)

  const RATING_KEYS = ['experience', 'driving', 'energyManagement', 'teamwork', 'consistency', 'adaptation'] as const

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/pilots" className="text-smc-muted hover:text-smc-text">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="section-title mb-0">{isEditing ? 'Editar piloto' : 'Nuevo piloto'}</h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Personal info */}
        <Card title="Datos personales">
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="form-label">Nombre completo *</label>
                <Controller name="fullName" control={control} render={({ field }) => (
                  <input {...field} className="input-field" placeholder="Nombre y apellidos" />
                )} />
                {errors.fullName && <p className="text-xs text-danger mt-1">{errors.fullName.message}</p>}
              </div>
              <div>
                <label className="form-label">DNI / Licencia *</label>
                <Controller name="dni" control={control} render={({ field }) => (
                  <input {...field} className="input-field" placeholder="12345678A" />
                )} />
              </div>
              <div>
                <label className="form-label">Fecha de alta *</label>
                <Controller name="joinDate" control={control} render={({ field }) => (
                  <input type="date" {...field} className="input-field" />
                )} />
              </div>
              <div>
                <label className="form-label">Edad</label>
                <Controller name="age" control={control} render={({ field }) => (
                  <input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} className="input-field" />
                )} />
              </div>
              <div>
                <label className="form-label">Peso (kg)</label>
                <Controller name="weightKg" control={control} render={({ field }) => (
                  <input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} className="input-field" />
                )} />
                {watchedWeight > 50 && (
                  <p className="text-xs text-warning mt-1">
                    Penalización: -{weightPenalty.toFixed(1)} pts (por cada 10kg sobre 50kg)
                  </p>
                )}
              </div>
              <div>
                <label className="form-label">Altura (cm)</label>
                <Controller name="heightCm" control={control} render={({ field }) => (
                  <input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} className="input-field" />
                )} />
              </div>
              <div className="col-span-2">
                <label className="form-label">Notas</label>
                <Controller name="notes" control={control} render={({ field }) => (
                  <textarea {...field} className="input-field min-h-[70px]" placeholder="Observaciones del equipo técnico..." />
                )} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Ratings */}
        <Card title="Valoraciones técnicas">
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-smc-muted">Puntuación en tiempo real:</p>
              <ScoreRing score={currentScore} size={60} />
            </div>
            <div className="space-y-4">
              {RATING_KEYS.map(key => (
                <Controller key={key} name={`ratings.${key}`} control={control} render={({ field }) => (
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-sm text-smc-text">
                        {RATING_LABELS[key]} <span className="text-xs text-smc-muted">({Math.round(RATING_WEIGHTS[key] * 100)}%)</span>
                      </label>
                      <span className="text-sm font-semibold text-primary">{field.value}</span>
                    </div>
                    <input
                      type="range" min={1} max={10} step={1}
                      value={field.value}
                      onChange={e => field.onChange(Number(e.target.value))}
                      className="w-full accent-primary"
                    />
                    <div className="flex justify-between text-xs text-smc-muted mt-0.5">
                      <span>1</span><span>10</span>
                    </div>
                  </div>
                )} />
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Link to="/pilots" className="btn-secondary">Cancelar</Link>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear piloto'}
          </button>
        </div>
      </form>
    </div>
  )
}
