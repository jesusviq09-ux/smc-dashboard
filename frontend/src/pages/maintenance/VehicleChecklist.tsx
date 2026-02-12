import { useParams } from 'react-router-dom'
import { useState } from 'react'
import { CheckSquare, Square, Save } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { useLiveQuery } from 'dexie-react-hooks'
import { useQueryClient } from '@tanstack/react-query'
import { db } from '@/services/indexeddb/db'
import { maintenanceApi } from '@/services/api/maintenance.api'

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
  const qc = useQueryClient()
  const [type, setType] = useState<'pre_race' | 'post_race'>('pre_race')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [signedBy, setSignedBy] = useState('')
  const [signatureText, setSignatureText] = useState('')
  const [signatureDate, setSignatureDate] = useState(new Date().toISOString().split('T')[0])
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const vehicle = useLiveQuery(() => db.vehicles.get(vehicleId!), [vehicleId])
  const items = type === 'pre_race' ? PRE_RACE_ITEMS : POST_RACE_ITEMS

  const allCriticalChecked = items.filter(i => i.critical).every(i => checked[i.id])
  const totalChecked = items.filter(i => checked[i.id]).length

  const handleSave = async () => {
    try {
      setSaveError(null)

      // Generar id del checklist antes para poder enlazarlo después
      const checklistId = crypto.randomUUID()

      // 1. Guardar en IndexedDB local (para offline y visualización local)
      await db.maintenanceChecklists.add({
        id: checklistId,
        vehicleId: vehicleId!,
        type,
        date: signatureDate,
        items: items.map(item => ({
          id: item.id,
          checklistId: '',
          label: item.label,
          checked: checked[item.id] ?? false,
          critical: item.critical,
        })),
        signedBy: `${signedBy}${signatureText ? ` — Firma: ${signatureText}` : ''}`,
        completedAt: new Date().toISOString(),
      })

      // 2. Guardar en el backend para que aparezca en el historial compartido
      const checkedCount = items.filter(i => checked[i.id]).length
      const uncheckedCritical = items.filter(i => i.critical && !checked[i.id]).map(i => i.label)
      const notesParts = [
        signatureText ? `Firma: ${signatureText}` : '',
        uncheckedCritical.length > 0 ? `Ítems críticos sin completar: ${uncheckedCritical.join(', ')}` : '',
      ].filter(Boolean)

      try {
        const record = await maintenanceApi.createRecord({
          vehicleId: vehicleId!,
          type,
          date: signatureDate,
          description: `Checklist ${type === 'pre_race' ? 'pre-carrera' : 'post-carrera'} — ${checkedCount}/${items.length} ítems OK`,
          technicianName: signedBy,
          notes: notesParts.length > 0 ? notesParts.join(' | ') : undefined,
          completed: true,
          partsReplaced: [],
        })
        // Guardar el vínculo para que al borrar el checklist se borre también el registro del backend
        await db.maintenanceChecklists.update(checklistId, { maintenanceRecordId: record.id })
        qc.invalidateQueries({ queryKey: ['maintenance'] })
        qc.invalidateQueries({ queryKey: ['maintenance-alerts'] })
      } catch {
        // Silencioso — el guardado local ya fue exitoso; el backend fallará solo si hay problema de red
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setSaveError(err?.message || 'Error al guardar el checklist')
    }
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

          <div className="border-t border-smc-border pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-smc-muted">{totalChecked}/{items.length} completados</span>
              {!allCriticalChecked && (
                <span className="badge-yellow text-xs">⚠️ Hay ítems críticos sin completar</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Nombre del firmante *</label>
                <input
                  type="text"
                  placeholder="Nombre y apellidos"
                  className="input-field"
                  value={signedBy}
                  onChange={e => setSignedBy(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Fecha *</label>
                <input
                  type="date"
                  className="input-field"
                  value={signatureDate}
                  onChange={e => setSignatureDate(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="form-label">Firma (escribe tu nombre en cursiva o iniciales)</label>
                <input
                  type="text"
                  placeholder="Firma..."
                  className="input-field italic font-serif text-lg"
                  value={signatureText}
                  onChange={e => setSignatureText(e.target.value)}
                />
              </div>
            </div>

            {saveError && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {saveError}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={!signedBy || !signatureDate || saved}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saved ? '¡Checklist firmado y guardado!' : 'Firmar y guardar'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
