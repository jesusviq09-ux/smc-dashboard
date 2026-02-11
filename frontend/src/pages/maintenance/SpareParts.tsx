import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Package, AlertTriangle, Trash2, Edit2, Check, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { maintenanceApi } from '@/services/api/maintenance.api'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/services/indexeddb/db'
import { apiClient } from '@/services/api/client'
import type { SparePart } from '@/types'

function stockStatus(part: SparePart): 'ok' | 'atMin' | 'belowMin' {
  if (part.stock < part.minStock) return 'belowMin'
  if (part.stock === part.minStock) return 'atMin'
  return 'ok'
}

export default function SpareParts() {
  const qc = useQueryClient()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: '', vehicleId: 'smc01', stock: 0, minStock: 1, unit: 'unidad' })

  const vehicles = useLiveQuery(() => db.vehicles.toArray(), [])
  const { data: parts = [] } = useQuery({ queryKey: ['spare-parts'], queryFn: maintenanceApi.getSpareParts })

  const saveMutation = useMutation({
    mutationFn: async (data: Omit<SparePart, 'id'>) => {
      const { data: created } = await apiClient.post<SparePart>('/maintenance/parts', data)
      await db.spareParts.put(created)
      return created
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['spare-parts'] }); setShowNew(false); resetForm() },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SparePart> }) => maintenanceApi.updateSparePart(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['spare-parts'] }); setEditingId(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/maintenance/parts/${id}`)
      await db.spareParts.delete(id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['spare-parts'] }),
  })

  const resetForm = () => setForm({ name: '', vehicleId: 'smc01', stock: 0, minStock: 1, unit: 'unidad' })

  const atMinParts = parts.filter(p => stockStatus(p) === 'atMin')
  const belowMinParts = parts.filter(p => stockStatus(p) === 'belowMin')
  const alertParts = [...belowMinParts, ...atMinParts]
  const partsByVehicle = vehicles?.map(v => ({
    vehicle: v,
    parts: parts.filter(p => p.vehicleId === v.id),
  })) ?? []

  const [editForm, setEditForm] = useState<Partial<SparePart>>({})

  const startEdit = (part: SparePart) => {
    setEditingId(part.id)
    setEditForm({ name: part.name, stock: part.stock, minStock: part.minStock, unit: part.unit })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="section-title mb-0">Repuestos e inventario</h1>
        <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Añadir repuesto
        </button>
      </div>

      {belowMinParts.length > 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-danger" />
            <span className="text-sm font-semibold text-danger">Stock crítico — por debajo del mínimo ({belowMinParts.length} artículo{belowMinParts.length !== 1 ? 's' : ''})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {belowMinParts.map(p => (
              <span key={p.id} className="badge-red text-xs">{p.name}: {p.stock}/{p.minStock} {p.unit}</span>
            ))}
          </div>
        </div>
      )}

      {atMinParts.length > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-sm font-semibold text-warning">Stock en el mínimo ({atMinParts.length} artículo{atMinParts.length !== 1 ? 's' : ''})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {atMinParts.map(p => (
              <span key={p.id} className="badge-yellow text-xs">{p.name}: {p.stock}/{p.minStock} {p.unit}</span>
            ))}
          </div>
        </div>
      )}

      {showNew && (
        <Card title="Nuevo repuesto">
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="col-span-2">
                <label className="form-label">Nombre</label>
                <input className="input-field" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej: Pastillas de freno" />
              </div>
              <div>
                <label className="form-label">Vehículo</label>
                <select className="input-field" value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                  {vehicles?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Unidad</label>
                <input className="input-field" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="unidad, par, litro..." />
              </div>
              <div>
                <label className="form-label">Stock actual</label>
                <input type="number" min={0} className="input-field" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="form-label">Stock mínimo</label>
                <input type="number" min={0} className="input-field" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setShowNew(false); resetForm() }} className="btn-secondary">Cancelar</button>
              <button onClick={() => saveMutation.mutate(form as Omit<SparePart, 'id'>)} disabled={!form.name || saveMutation.isPending} className="btn-primary">
                {saveMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {partsByVehicle.map(({ vehicle, parts: vParts }) => (
        <Card key={vehicle.id} title={`${vehicle.name} — ${vParts.length} artículo${vParts.length !== 1 ? 's' : ''}`}>
          <CardContent>
            {vParts.length === 0 ? (
              <p className="text-sm text-smc-muted text-center py-4">Sin repuestos registrados</p>
            ) : (
              <div className="space-y-2">
                {vParts.map(part => {
                  const status = stockStatus(part)
                  const rowClass = status === 'belowMin'
                    ? 'border-danger/30 bg-danger/5'
                    : status === 'atMin'
                    ? 'border-warning/30 bg-warning/5'
                    : 'border-smc-border'
                  const iconClass = status === 'belowMin'
                    ? 'text-danger'
                    : status === 'atMin'
                    ? 'text-warning'
                    : 'text-smc-muted'
                  const valueClass = status === 'belowMin'
                    ? 'text-danger'
                    : status === 'atMin'
                    ? 'text-warning'
                    : 'text-success'
                  return (
                    <div key={part.id} className={`flex items-center gap-3 p-3 rounded-lg border ${rowClass}`}>
                      <Package className={`w-4 h-4 flex-shrink-0 ${iconClass}`} />
                      {editingId === part.id ? (
                        <>
                          <input className="input-field flex-1 text-sm py-1" value={editForm.name ?? ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
                          <input type="number" min={0} className="input-field w-20 text-sm py-1" value={editForm.stock ?? 0} onChange={e => setEditForm(f => ({ ...f, stock: Number(e.target.value) }))} />
                          <span className="text-smc-muted text-xs">/</span>
                          <input type="number" min={0} className="input-field w-20 text-sm py-1" value={editForm.minStock ?? 1} onChange={e => setEditForm(f => ({ ...f, minStock: Number(e.target.value) }))} />
                          <button onClick={() => updateMutation.mutate({ id: part.id, data: editForm })} className="text-success hover:text-success/80"><Check className="w-4 h-4" /></button>
                          <button onClick={() => setEditingId(null)} className="text-smc-muted hover:text-smc-text"><X className="w-4 h-4" /></button>
                        </>
                      ) : (
                        <>
                          <span className="flex-1 text-sm text-smc-text">{part.name}</span>
                          <span className={`text-sm font-semibold ${valueClass}`}>
                            {part.stock} {part.unit}
                          </span>
                          <span className="text-xs text-smc-muted">mín. {part.minStock}</span>
                          {status === 'belowMin' && <AlertTriangle className="w-3.5 h-3.5 text-danger" />}
                          {status === 'atMin' && <AlertTriangle className="w-3.5 h-3.5 text-warning" />}
                          <button onClick={() => startEdit(part)} className="text-smc-muted hover:text-smc-text ml-1"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => deleteMutation.mutate(part.id)} className="text-smc-muted hover:text-danger"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
