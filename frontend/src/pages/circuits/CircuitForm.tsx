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
        })
      })
    }
  }, [id, isEditing])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = ['lengthMeters', 'numberOfCurves', 'elevationMeters', 'sectors'].includes(field)
      ? parseFloat(e.target.value) || 0
      : e.target.value
    setForm(f => ({ ...f, [field]: value }))
  }

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
