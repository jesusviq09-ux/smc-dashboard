import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ChevronLeft, Save } from 'lucide-react'
import { circuitsApi } from '@/services/api/circuits.api'
import { Card, CardContent } from '@/components/ui/Card'

const ASPHALT_TYPES = ['smooth', 'rough', 'mixed', 'wet', 'unknown']
const ASPHALT_LABELS: Record<string, string> = {
  smooth: 'Liso', rough: 'Rugoso', mixed: 'Mixto', wet: 'Mojado', unknown: 'Desconocido',
}

export default function CircuitForm() {
  const { id } = useParams<{ id: string }>()
  const isEditing = !!id
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '', city: '', country: '', lengthMeters: 1000,
    numberOfCurves: 8, elevationMeters: 0, asphaltType: 'smooth',
    sectors: 3, notes: '',
    demandingTechnical: 5, demandingPhysical: 5,
    energyConsumption: 5, overtakingDifficulty: 5, gripLevel: 5,
  })
  const [loading, setLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (isEditing) {
      circuitsApi.getById(id!).then(c => {
        if (c) setForm({
          name: c.name ?? '',
          city: c.city ?? '',
          country: c.country ?? '',
          lengthMeters: c.lengthMeters ?? 1000,
          numberOfCurves: c.numberOfCurves ?? 8,
          elevationMeters: c.elevationMeters ?? 0,
          asphaltType: c.asphaltType ?? 'smooth',
          sectors: Array.isArray(c.sectors) ? c.sectors.length : (c.sectors as any) ?? 3,
          notes: c.notes ?? '',
          demandingTechnical: c.demandingTechnical ?? 5,
          demandingPhysical: c.demandingPhysical ?? 5,
          energyConsumption: c.energyConsumption ?? 5,
          overtakingDifficulty: c.overtakingDifficulty ?? 5,
          gripLevel: c.gripLevel ?? 5,
        })
      })
    }
  }, [id, isEditing])

  const NUMERIC_FIELDS = ['lengthMeters', 'numberOfCurves', 'elevationMeters', 'sectors',
    'demandingTechnical', 'demandingPhysical', 'energyConsumption', 'overtakingDifficulty', 'gripLevel']

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = NUMERIC_FIELDS.includes(field)
      ? parseFloat(e.target.value) || 0
      : e.target.value
    setForm(f => ({ ...f, [field]: value }))
  }

  const setNum = (field: string, value: number) => setForm(f => ({ ...f, [field]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveError(null)
    setLoading(true)
    try {
      const payload = {
        ...form,
        sectors: Array.from({ length: form.sectors }, (_, i) => ({ name: `Sector ${i + 1}`, lengthMeters: 0 })),
      }
      if (isEditing) {
        await circuitsApi.update(id!, payload as any)
      } else {
        await circuitsApi.create(payload as any)
      }
      navigate('/circuits')
    } catch (err: any) {
      setSaveError(`Error al guardar. ${err?.response?.data?.error || err?.message || 'Comprueba el servidor.'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link to="/circuits" className="text-smc-muted hover:text-smc-text">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="section-title mb-0">{isEditing ? 'Editar circuito' : 'Nuevo circuito'}</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card title="Información general">
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="form-label">Nombre del circuito *</label>
                <input className="input-field" value={form.name} onChange={set('name')} placeholder="Karting de Rivas" required />
              </div>
              <div>
                <label className="form-label">Ciudad *</label>
                <input className="input-field" value={form.city} onChange={set('city')} placeholder="Madrid" required />
              </div>
              <div>
                <label className="form-label">País *</label>
                <input className="input-field" value={form.country} onChange={set('country')} placeholder="España" required />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card title="Características técnicas">
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Longitud (m) *</label>
                <input type="number" className="input-field" value={form.lengthMeters} onChange={set('lengthMeters')} min={100} max={10000} required />
              </div>
              <div>
                <label className="form-label">Nº curvas</label>
                <input type="number" className="input-field" value={form.numberOfCurves} onChange={set('numberOfCurves')} min={0} max={50} />
              </div>
              <div>
                <label className="form-label">Elevación (m)</label>
                <input type="number" className="input-field" value={form.elevationMeters} onChange={set('elevationMeters')} min={0} max={1000} step="0.1" />
              </div>
              <div>
                <label className="form-label">Tipo de asfalto</label>
                <select className="input-field" value={form.asphaltType} onChange={set('asphaltType')}>
                  {ASPHALT_TYPES.map(t => (
                    <option key={t} value={t}>{ASPHALT_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Sectores</label>
                <input type="number" className="input-field" value={form.sectors} onChange={set('sectors')} min={1} max={10} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card title="Parámetros de rendimiento">
          <CardContent>
            <p className="text-xs text-smc-muted mb-4">
              Evalúa la exigencia del circuito (1 = muy bajo, 10 = muy alto). Se usarán para calcular la estrategia óptima según las fortalezas de cada piloto.
            </p>
            <div className="space-y-4">
              {([
                { field: 'demandingTechnical', label: 'Exigencia técnica', hint: 'Curvas rápidas, frenadas tardías, chicanes' },
                { field: 'demandingPhysical', label: 'Exigencia física', hint: 'Fuerza lateral, resistencia del piloto' },
                { field: 'energyConsumption', label: 'Consumo energético', hint: 'Cuánta energía consume el coche por vuelta' },
                { field: 'overtakingDifficulty', label: 'Dificultad de adelantamiento', hint: 'Facilidad para adelantar en carrera' },
                { field: 'gripLevel', label: 'Nivel de grip', hint: 'Adherencia del asfalto (10 = máximo grip)' },
              ] as const).map(({ field, label, hint }) => {
                const val = form[field as keyof typeof form] as number
                return (
                  <div key={field}>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-smc-text">{label}</label>
                      <span className="text-lg font-bold text-primary w-8 text-right">{val}</span>
                    </div>
                    <p className="text-xs text-smc-muted mb-2">{hint}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-smc-muted w-4">1</span>
                      <input
                        type="range"
                        min={1}
                        max={10}
                        step={1}
                        value={val}
                        onChange={e => setNum(field, Number(e.target.value))}
                        className="flex-1 accent-primary"
                      />
                      <span className="text-xs text-smc-muted w-4">10</span>
                    </div>
                    <div className="h-1.5 bg-smc-darker rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${(val / 10) * 100}%`,
                          background: val >= 8 ? 'var(--color-danger)' : val >= 6 ? 'var(--color-warning)' : val >= 4 ? 'var(--color-primary)' : 'var(--color-success)',
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card title="Notas">
          <CardContent>
            <textarea
              className="input-field min-h-[80px]"
              value={form.notes}
              onChange={set('notes')}
              placeholder="Observaciones sobre el circuito, restricciones, consejos..."
            />
          </CardContent>
        </Card>

        {saveError && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {saveError}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <Link to="/circuits" className="btn-secondary">Cancelar</Link>
          <button type="submit" disabled={loading} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" />
            {loading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Crear circuito'}
          </button>
        </div>
      </form>
    </div>
  )
}
