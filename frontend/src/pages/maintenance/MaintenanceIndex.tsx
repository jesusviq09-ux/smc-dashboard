import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Wrench, AlertTriangle, CheckCircle, Clock } from 'lucide-react'
import { useState } from 'react'
import { maintenanceApi } from '@/services/api/maintenance.api'
import { Card, CardContent } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { db } from '@/services/indexeddb/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { MaintenanceType } from '@/types'

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
