import { useForm, Controller } from 'react-hook-form'
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { ChevronLeft, Save } from 'lucide-react'
import { raceApi } from '@/services/api/race.api'
import { Card, CardContent } from '@/components/ui/Card'
import { RaceCategory } from '@/types'

export default function NewRace() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [saveError, setSaveError] = useState<string | null>(null)

  const { control, handleSubmit, watch } = useForm({
    defaultValues: {
      name: '',
      circuitId: '',
      date: '',
      categories: [] as RaceCategory[],
      weatherConditions: '',
      circuitNotes: '',
    },
  })

  const categories = watch('categories')

  const mutation = useMutation({
    mutationFn: (data: any) => raceApi.createEvent({ ...data, status: 'planned' }),
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['race-events'] })
      navigate(`/races/${event.id}`)
    },
    onError: (error: any) => {
      setSaveError(`Error al guardar. Comprueba que el servidor está disponible.${error?.message ? ` (${error.message})` : ''}`)
    },
  })

  const toggleCategory = (cat: RaceCategory, current: RaceCategory[]) =>
    current.includes(cat) ? current.filter(c => c !== cat) : [...current, cat]

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Link to="/races" className="p-2 rounded-lg hover:bg-smc-card text-smc-muted">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-white">Nueva carrera</h1>
      </div>

      <form onSubmit={handleSubmit(data => { setSaveError(null); mutation.mutate(data) })} className="space-y-6">
        <Card title="Datos del evento">
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Nombre del evento *</label>
              <Controller name="name" control={control} render={({ field }) => (
                <input {...field} className="input-field" placeholder="Carrera Regional – Circuito Jarama" />
              )} />
            </div>
            <div>
              <label className="label">Fecha y hora *</label>
              <Controller name="date" control={control} render={({ field }) => (
                <input type="datetime-local" {...field} className="input-field" />
              )} />
            </div>
            <div>
              <label className="label">Condiciones climáticas</label>
              <Controller name="weatherConditions" control={control} render={({ field }) => (
                <input {...field} className="input-field" placeholder="Soleado, 18°C" />
              )} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notas del circuito</label>
              <Controller name="circuitNotes" control={control} render={({ field }) => (
                <textarea {...field} className="input-field resize-none" rows={2}
                  placeholder="Curva 3 muy cerrada, asfalto irregular en sector 2..." />
              )} />
            </div>
          </CardContent>
        </Card>

        <Card title="Categorías a disputar">
          <CardContent>
            <Controller name="categories" control={control} render={({ field }) => (
              <div className="space-y-3">
                <label className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                  field.value.includes('F24') ? 'border-primary bg-primary/5' : 'border-smc-border hover:border-primary/30'
                }`}>
                  <input type="checkbox" checked={field.value.includes('F24')}
                    onChange={() => field.onChange(toggleCategory('F24', field.value))}
                    className="w-4 h-4 accent-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-white">F24</p>
                    <p className="text-xs text-smc-muted">90 minutos · Mínimo 2 cambios de piloto · Todas las edades</p>
                  </div>
                </label>
                <label className={`flex items-start gap-4 p-4 rounded-xl border cursor-pointer transition-colors ${
                  field.value.includes('F24+') ? 'border-primary bg-primary/5' : 'border-smc-border hover:border-primary/30'
                }`}>
                  <input type="checkbox" checked={field.value.includes('F24+')}
                    onChange={() => field.onChange(toggleCategory('F24+', field.value))}
                    className="w-4 h-4 accent-primary mt-0.5" />
                  <div>
                    <p className="font-semibold text-white">F24+</p>
                    <p className="text-xs text-smc-muted">60 minutos · Sin cambio de piloto · Pilotos ≥ 16 años</p>
                  </div>
                </label>
              </div>
            )} />
          </CardContent>
        </Card>

        {saveError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {saveError}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link to="/races" className="btn-secondary">Cancelar</Link>
          <button type="submit" disabled={mutation.isPending} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            {mutation.isPending ? 'Creando...' : 'Crear carrera'}
          </button>
        </div>
      </form>
    </div>
  )
}
