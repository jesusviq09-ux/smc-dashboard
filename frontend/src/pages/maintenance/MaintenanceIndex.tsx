import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Wrench, AlertTriangle, CheckCircle, Clock, ClipboardCheck, Pencil, Trash2, CheckSquare, Square } from 'lucide-react'
import { useState } from 'react'
import { maintenanceApi } from '@/services/api/maintenance.api'
import { Card, CardContent } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { db } from '@/services/indexeddb/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MaintenanceType, Vehicle, MaintenanceChecklist } from '@/types'

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

function ChecklistHistory({ vehicles }: { vehicles: Vehicle[] }) {
  const [editChecklist, setEditChecklist] = useState<MaintenanceChecklist | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editChecked, setEditChecked] = useState<Record<string, boolean>>({})
  const [editSignedBy, setEditSignedBy] = useState('')
  const [editSignatureText, setEditSignatureText] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const checklists = useLiveQuery(
    () => db.maintenanceChecklists.orderBy('date').reverse().toArray(),
    []
  )

  const openEdit = (cl: MaintenanceChecklist) => {
    const checkedMap: Record<string, boolean> = {}
    cl.items.forEach(item => { checkedMap[item.id] = item.checked })
    // Parse signedBy: "Nombre — Firma: texto" back into parts
    const firmaMatch = cl.signedBy?.match(/^(.*?) — Firma: (.*)$/)
    setEditSignedBy(firmaMatch ? firmaMatch[1] : (cl.signedBy ?? ''))
    setEditSignatureText(firmaMatch ? firmaMatch[2] : '')
    setEditChecked(checkedMap)
    setEditDate(cl.date)
    setEditError(null)
    setEditChecklist(cl)
  }

  const handleUpdate = async () => {
    if (!editChecklist) return
    try {
      setEditError(null)
      await db.maintenanceChecklists.update(editChecklist.id, {
        date: editDate,
        items: editChecklist.items.map(item => ({ ...item, checked: editChecked[item.id] ?? item.checked })),
        signedBy: `${editSignedBy}${editSignatureText ? ` — Firma: ${editSignatureText}` : ''}`,
      })
      setEditChecklist(null)
    } catch (err: any) {
      setEditError(err?.message || 'Error al actualizar el checklist')
    }
  }

  const handleDelete = async (id: string) => {
    await db.maintenanceChecklists.delete(id)
    setDeleteConfirmId(null)
  }

  if (!checklists || checklists.length === 0) return null

  const editItems = editChecklist
    ? (editChecklist.type === 'pre_race' ? PRE_RACE_ITEMS : POST_RACE_ITEMS)
    : []

  return (
    <>
      <Card title="Checklists firmados">
        <CardContent className="pt-3">
          <div className="space-y-2">
            {checklists.map(cl => {
              const vehicleName = vehicles.find(v => v.id === cl.vehicleId)?.name ?? cl.vehicleId
              const checkedCount = cl.items.filter(i => i.checked).length
              const totalCount = cl.items.length
              return (
                <div key={cl.id} className="flex items-start gap-3 p-3 rounded-lg border border-smc-border bg-smc-darker">
                  <ClipboardCheck className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white text-sm">{vehicleName}</span>
                      <span className="badge-blue text-xs">{cl.type === 'pre_race' ? 'Pre-carrera' : 'Post-carrera'}</span>
                      <span className="badge-green text-xs">{checkedCount}/{totalCount} ítems</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-smc-muted flex-wrap">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(cl.date), "d MMM yyyy", { locale: es })}
                      </span>
                      {cl.signedBy && <span>Firmado: {cl.signedBy}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(cl)} className="p-1.5 rounded-lg hover:bg-smc-card text-smc-muted hover:text-primary" title="Editar">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteConfirmId(cl.id)} className="p-1.5 rounded-lg hover:bg-smc-card text-smc-muted hover:text-danger" title="Eliminar">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Edit modal */}
      {editChecklist && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-smc-card rounded-xl p-6 max-w-md w-full space-y-4 border border-smc-border max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-smc-text">Editar checklist</h3>

            <div>
              <label className="form-label">Fecha</label>
              <input type="date" className="input-field" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              {editItems.map(item => (
                <button key={item.id} type="button"
                  onClick={() => setEditChecked(c => ({ ...c, [item.id]: !c[item.id] }))}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors ${
                    editChecked[item.id]
                      ? 'border-success bg-success/10'
                      : item.critical
                      ? 'border-danger/30 bg-danger/5'
                      : 'border-smc-border'
                  }`}
                >
                  {editChecked[item.id]
                    ? <CheckSquare className="w-4 h-4 text-success flex-shrink-0" />
                    : <Square className={`w-4 h-4 flex-shrink-0 ${item.critical ? 'text-danger' : 'text-smc-muted'}`} />
                  }
                  <span className="text-sm text-smc-text">{item.label}</span>
                  {item.critical && !editChecked[item.id] && (
                    <span className="ml-auto badge-red text-xs">Crítico</span>
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="form-label">Nombre firmante *</label>
                <input type="text" className="input-field" value={editSignedBy} onChange={e => setEditSignedBy(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Firma</label>
                <input type="text" className="input-field italic font-serif" value={editSignatureText} onChange={e => setEditSignatureText(e.target.value)} />
              </div>
            </div>

            {editError && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">{editError}</div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditChecklist(null)} className="btn-secondary">Cancelar</button>
              <button onClick={handleUpdate} disabled={!editSignedBy || !editDate} className="btn-primary">Guardar cambios</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-smc-card rounded-xl p-6 max-w-sm w-full space-y-4 border border-smc-border">
            <h3 className="font-semibold text-smc-text">¿Eliminar checklist?</h3>
            <p className="text-sm text-smc-muted">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteConfirmId(null)} className="btn-secondary">Cancelar</button>
              <button onClick={() => handleDelete(deleteConfirmId)} className="btn-danger flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const TYPES: { value: MaintenanceType; label: string }[] = [
  { value: 'preventive', label: 'Preventivo' },
  { value: 'corrective', label: 'Correctivo' },
  { value: 'pre_race', label: 'Pre-carrera' },
  { value: 'post_race', label: 'Post-carrera' },
  { value: 'electrical', label: 'Eléctrico' },
]

export default function MaintenanceIndex() {
  const queryClient = useQueryClient()
  const [createModal, setCreateModal] = useState(false)
  const [form, setForm] = useState({
    vehicleId: 'smc01', type: 'preventive' as MaintenanceType,
    date: new Date().toISOString().split('T')[0],
    description: '', nextServiceDate: '', technicianName: '', notes: '',
  })

  const vehicles = useLiveQuery(() => db.vehicles.toArray(), [])

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => maintenanceApi.getRecords(),
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['maintenance-alerts'],
    queryFn: maintenanceApi.getAlerts,
  })

  const createMutation = useMutation({
    mutationFn: () => maintenanceApi.createRecord({ ...form, completed: false, partsReplaced: [] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance'] })
      queryClient.invalidateQueries({ queryKey: ['maintenance-alerts'] })
      setCreateModal(false)
    },
  })

  const completeMutation = useMutation({
    mutationFn: (id: string) => maintenanceApi.updateRecord(id, { completed: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['maintenance'] }),
  })

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="section-title mb-0">Mantenimiento</h1>
          <p className="text-smc-muted text-sm mt-1">{alerts.length} alertas activas</p>
        </div>
        <div className="flex gap-2">
          <Link to="/maintenance/parts" className="btn-secondary">Inventario</Link>
          <button onClick={() => setCreateModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo registro
          </button>
        </div>
      </div>

      {/* Vehicle status cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {vehicles?.map(vehicle => {
          const vehicleAlerts = alerts.filter(a => a.vehicleId === vehicle.id)
          const status = vehicleAlerts.some(a => a.severity === 'red') ? 'red' :
                        vehicleAlerts.some(a => a.severity === 'yellow') ? 'yellow' : 'green'

          return (
            <Card key={vehicle.id}>
              <CardContent className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  status === 'green' ? 'bg-success/10' : status === 'yellow' ? 'bg-warning/10' : 'bg-danger/10'
                }`}>
                  <Wrench className={`w-6 h-6 ${
                    status === 'green' ? 'text-success' : status === 'yellow' ? 'text-warning' : 'text-danger'
                  }`} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-white">{vehicle.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`status-${status}`} />
                    <span className={`text-xs font-medium ${
                      status === 'green' ? 'text-success' : status === 'yellow' ? 'text-warning' : 'text-danger'
                    }`}>
                      {status === 'green' ? 'Operativo' : status === 'yellow' ? 'Mantenimiento próximo' : 'Revisión urgente'}
                    </span>
                  </div>
                </div>
                <Link to={`/maintenance/checklist/${vehicle.id}`} className="btn-primary text-sm py-1.5">
                  Checklist
                </Link>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card title="Alertas activas">
          <CardContent className="space-y-2 pt-3">
            {alerts.map((alert: any) => (
              <div key={alert.id} className={`flex items-start gap-3 p-3 rounded-lg ${
                alert.severity === 'red' ? 'bg-danger/10 border border-danger/20' : 'bg-warning/10 border border-warning/20'
              }`}>
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${alert.severity === 'red' ? 'text-danger' : 'text-warning'}`} />
                <p className="text-sm text-smc-text">{alert.message}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Records */}
      <Card title="Historial de mantenimiento">
        <CardContent className="pt-3">
          {isLoading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}
            </div>
          ) : records.length === 0 ? (
            <p className="text-smc-muted text-sm text-center py-8">No hay registros de mantenimiento.</p>
          ) : (
            <div className="space-y-2">
              {records.map(record => (
                <div key={record.id} className={`flex items-start gap-3 p-3 rounded-lg border ${
                  record.completed ? 'border-smc-border bg-smc-darker opacity-70' : 'border-smc-border bg-smc-darker'
                }`}>
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                    record.completed ? 'bg-success' : 'bg-warning'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white text-sm">{record.description}</span>
                      <span className="badge-blue text-xs">{TYPES.find(t => t.value === record.type)?.label ?? record.type}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-smc-muted">
                      <span>{vehicles?.find(v => v.id === record.vehicleId)?.name ?? record.vehicleId}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(record.date), "d MMM yyyy", { locale: es })}
                      </span>
                      {record.nextServiceDate && (
                        <span>Próxima: {format(new Date(record.nextServiceDate), "d MMM", { locale: es })}</span>
                      )}
                    </div>
                  </div>
                  {!record.completed && (
                    <button
                      onClick={() => completeMutation.mutate(record.id)}
                      className="flex-shrink-0 text-xs text-success hover:underline flex items-center gap-1"
                    >
                      <CheckCircle className="w-3 h-3" /> Completar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Signed Checklists from IndexedDB */}
      <ChecklistHistory vehicles={vehicles ?? []} />

      {/* Create Modal */}
      <Modal
        isOpen={createModal}
        onClose={() => setCreateModal(false)}
        title="Nuevo registro de mantenimiento"
        footer={
          <>
            <button onClick={() => setCreateModal(false)} className="btn-secondary">Cancelar</button>
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.description} className="btn-primary">
              {createMutation.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Vehículo</label>
              <select className="input-field" value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                {vehicles?.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as MaintenanceType }))}>
                {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input-field" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label className="label">Próxima revisión</label>
              <input type="date" className="input-field" value={form.nextServiceDate} onChange={e => setForm(f => ({ ...f, nextServiceDate: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Descripción *</label>
            <textarea className="input-field resize-none" rows={2} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
          <div>
            <label className="label">Técnico</label>
            <input type="text" className="input-field" value={form.technicianName}
              onChange={e => setForm(f => ({ ...f, technicianName: e.target.value }))} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
