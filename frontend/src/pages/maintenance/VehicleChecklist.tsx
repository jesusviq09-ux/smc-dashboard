import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { CheckSquare, Square, Save } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/services/indexeddb/db'

const PRE_RACE_ITEMS = [
  { id: 'tires', label: 'Presión y estado neumáticos', critical: true },
  { id: 'battery', label: 'Nivel de carga batería (>90%)', critical: true },
  { id: 'motor', label: 'Motor: estado y conexiones', critical: true },
  { id: 'brakes', label: 'Frenos: respuesta y estado', critical: true },
  { id: 'bolts', label: 'Tornillería y fijaciones', critical: true },
  { id: 'cabling', label: 'Cableado y conectores', critical: true },
  { id: 'bodywork', label: 'Carrocería y aerodinámica', critical: false },
  { id: 'steering', label: 'Dirección y alineación', critical: false },
  { id: 'coolant', label: 'Sistema de refrigeración', critical: false },
  { id: 'electronics', label: 'Controlador electrónico', critical: false },
]

const POST_RACE_ITEMS = [
  { id: 'inspection', label: 'Inspección general de daños', critical: true },
  { id: 'motor_check', label: 'Revisión motor post-carrera', critical: true },
  { id: 'battery_post', label: 'Estado batería post-carrera', critical: true },
  { id: 'cleaning', label: 'Limpieza del vehículo', critical: false },
  { id: 'storage', label: 'Preparación para almacenamiento', critical: false },
]

export default function VehicleChecklist() {
  const { vehicleId } = useParams<{ vehicleId: string }>()
  const [type, setType] = useState<'pre_race' | 'post_race'>('pre_race')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [signedBy, setSignedBy] = useState('')
  const [saved, setSaved] = useState(false)

  const vehicle = useLiveQuery(() => db.vehicles.get(vehicleId!), [vehicleId])
  const items = type === 'pre_race' ? PRE_RACE_ITEMS : POST_RACE_ITEMS

  const allCriticalChecked = items.filter(i => i.critical).every(i => checked[i.id])
  const totalChecked = items.filter(i => checked[i.id]).length

  const handleSave = async () => {
    await db.maintenanceChecklists.add({
      id: crypto.randomUUID(),
      vehicleId: vehicleId!,
      type,
      date: new Date().toISOString(),
      items: items.map(item => ({
        id: item.id,
        checklistId: '',
        label: item.label,
        checked: checked[item.id] ?? false,
        critical: item.critical,
      })),
      signedBy,
      completedAt: new Date().toISOString(),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="section-title mb-0">Checklist – {vehicle?.name ?? vehicleId}</h1>
        <div className="flex gap-2 mt-3">
          {(['pre_race', 'post_race'] as const).map(t => (
            <button key={t} onClick={() => { setType(t); setChecked({}) }}
              className={t === type ? 'btn-primary' : 'btn-secondary'}>
              {t === 'pre_race' ? 'Pre-carrera' : 'Post-carrera'}
            </button>
          ))}
        </div>
      </div>

      <Card title={type === 'pre_race' ? 'Verificación pre-carrera' : 'Inspección post-carrera'}>
        <CardContent>
          <div className="space-y-2 mb-4">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => setChecked(c => ({ ...c, [item.id]: !c[item.id] }))}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                  checked[item.id]
                    ? 'border-success bg-success/10'
                    : item.critical
                    ? 'border-danger/30 bg-danger/5 hover:border-danger/60'
                    : 'border-smc-border hover:border-primary/30'
                }`}
              >
                {checked[item.id]
                  ? <CheckSquare className="w-5 h-5 text-success flex-shrink-0" />
                  : <Square className={`w-5 h-5 flex-shrink-0 ${item.critical ? 'text-danger' : 'text-smc-muted'}`} />
                }
                <span className="text-sm text-smc-text">{item.label}</span>
                {item.critical && !checked[item.id] && (
                  <span className="ml-auto badge-red text-xs">Crítico</span>
                )}
              </button>
            ))}
          </div>

          <div className="border-t border-smc-border pt-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-smc-muted">{totalChecked}/{items.length} completados</span>
              {!allCriticalChecked && <span className="badge-red text-xs">Faltan ítems críticos</span>}
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Firmado por..."
                className="input-field flex-1"
                value={signedBy}
                onChange={e => setSignedBy(e.target.value)}
              />
              <button onClick={handleSave} disabled={!allCriticalChecked} className="btn-primary flex items-center gap-2">
                <Save className="w-4 h-4" />
                {saved ? '¡Guardado!' : 'Firmar'}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
