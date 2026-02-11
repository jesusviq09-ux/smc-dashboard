import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, Trophy, MapPin, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { circuitsApi } from '@/services/api/circuits.api'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { formatLapTime } from '@/utils/lapStatistics'

export default function CircuitDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: circuit, isLoading } = useQuery({
    queryKey: ['circuit', id],
    queryFn: () => circuitsApi.getById(id!),
    enabled: !!id,
  })

  const { data: records = [] } = useQuery({
    queryKey: ['circuit-records', id],
    queryFn: () => circuitsApi.getRecords(id!),
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => circuitsApi.delete(id!),
    onSuccess: () => navigate('/circuits'),
    onError: (err: any) => setDeleteError(err?.response?.data?.error || err?.message || 'Error al eliminar el circuito'),
  })

  if (isLoading) return <div className="skeleton h-64 rounded-xl" />
  if (!circuit) return <div className="text-smc-muted">Circuito no encontrado</div>

  const smc01Records = records.filter(r => r.vehicleId === 'smc01').sort((a, b) => a.bestTimeSeconds - b.bestTimeSeconds)
  const smc02Records = records.filter(r => r.vehicleId === 'smc02').sort((a, b) => a.bestTimeSeconds - b.bestTimeSeconds)

  const comparisonData = [
    ...(smc01Records[0] ? [{ vehicle: 'SMC 01', time: smc01Records[0].bestTimeSeconds, pilot: smc01Records[0].pilot?.fullName }] : []),
    ...(smc02Records[0] ? [{ vehicle: 'SMC 02 EVO', time: smc02Records[0].bestTimeSeconds, pilot: smc02Records[0].pilot?.fullName }] : []),
  ]

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-smc-muted hover:text-smc-text">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="section-title mb-0">{circuit.name}</h1>
          <p className="text-sm text-smc-muted flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" /> {circuit.city}, {circuit.country}
          </p>
        </div>
        <Link to={`/circuits/${id}/edit`} className="btn-secondary flex items-center gap-2">
          <Pencil className="w-4 h-4" /> Editar
        </Link>
        <button onClick={() => setConfirmDelete(true)} className="btn-danger flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> Eliminar
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Longitud', value: `${circuit.lengthMeters}m` },
          { label: 'Desnivel', value: circuit.elevationMeters ? `${circuit.elevationMeters}m` : '—' },
          { label: 'Curvas', value: circuit.numberOfCurves ?? '—' },
          { label: 'Asfalto', value: circuit.asphaltType ?? '—' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="text-center py-3">
              <p className="text-xs text-smc-muted mb-1">{stat.label}</p>
              <p className="text-lg font-bold text-white capitalize">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {circuit.notes && (
        <Card title="Notas del circuito">
          <CardContent>
            <p className="text-sm text-smc-text whitespace-pre-wrap">{circuit.notes}</p>
          </CardContent>
        </Card>
      )}

      {comparisonData.length > 0 && (
        <Card title="Comparativa SMC 01 vs SMC 02 EVO">
          <CardContent>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={comparisonData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis type="number" stroke="#8b949e" tick={{ fontSize: 10 }}
                  tickFormatter={v => formatLapTime(v)} />
                <YAxis type="category" dataKey="vehicle" stroke="#8b949e" tick={{ fontSize: 11 }} width={90} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: 8 }}
                  formatter={(v: number) => [formatLapTime(v), 'Mejor tiempo']}
                />
                <Bar dataKey="time" radius={[0, 6, 6, 0]}>
                  {comparisonData.map((entry, i) => (
                    <Cell key={i} fill={entry.vehicle === 'SMC 01' ? '#00d4ff' : '#f59e0b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { title: 'SMC 01 — Records', records: smc01Records, color: 'text-primary' },
          { title: 'SMC 02 EVO — Records', records: smc02Records, color: 'text-warning' },
        ].map(({ title, records: recs, color }) => (
          <Card key={title} title={title}>
            <CardContent>
              {recs.length === 0 ? (
                <p className="text-xs text-smc-muted text-center py-4">Sin records registrados</p>
              ) : (
                <div className="space-y-2">
                  {recs.slice(0, 5).map((r, i) => (
                    <div key={r.id} className="flex items-center gap-3">
                      <span className={`text-xs font-bold w-5 ${i === 0 ? 'text-warning' : 'text-smc-muted'}`}>
                        #{i + 1}
                      </span>
                      <Trophy className={`w-3.5 h-3.5 ${i === 0 ? 'text-warning' : 'text-smc-muted'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-smc-text truncate">{r.pilot?.fullName ?? 'Piloto desconocido'}</p>
                        <p className="text-xs text-smc-muted">{r.sessionDate?.slice(0, 10)}</p>
                      </div>
                      <span className={`text-sm font-mono font-semibold ${color}`}>
                        {formatLapTime(r.bestTimeSeconds)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-smc-card rounded-xl p-6 max-w-sm w-full space-y-4 border border-smc-border">
            <h3 className="font-semibold text-smc-text">¿Eliminar circuito?</h3>
            <p className="text-sm text-smc-muted">Se eliminará <span className="text-smc-text font-medium">{circuit.name}</span> de forma permanente. Esta acción no se puede deshacer.</p>
            {deleteError && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                {deleteError}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setConfirmDelete(false); setDeleteError(null) }} className="btn-secondary">
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="btn-danger flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
