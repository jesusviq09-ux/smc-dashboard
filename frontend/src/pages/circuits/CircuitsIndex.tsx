import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, MapPin, Ruler, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { circuitsApi } from '@/services/api/circuits.api'

export default function CircuitsIndex() {
  const qc = useQueryClient()
  const { data: circuits = [], isLoading } = useQuery({ queryKey: ['circuits'], queryFn: circuitsApi.getAll })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="section-title mb-0">Circuitos</h1>
        <Link to="/circuits/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nuevo circuito
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map(i => <div key={i} className="skeleton h-40 rounded-xl" />)}
        </div>
      ) : circuits.length === 0 ? (
        <div className="text-center py-16 text-smc-muted">
          <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="mb-4">Sin circuitos registrados</p>
          <Link to="/circuits/new" className="btn-primary">Añadir primer circuito</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {circuits.map(circuit => (
            <Link key={circuit.id} to={`/circuits/${circuit.id}`}>
              <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                <div className="h-1 bg-gradient-to-r from-warning to-warning/30" />
                <CardContent>
                  <h3 className="font-bold text-white text-lg mb-1">{circuit.name}</h3>
                  <p className="text-sm text-smc-muted flex items-center gap-1 mb-3">
                    <MapPin className="w-3.5 h-3.5" /> {circuit.city}, {circuit.country}
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-smc-muted">Longitud</p>
                      <p className="text-sm font-semibold text-white flex items-center gap-1">
                        <Ruler className="w-3.5 h-3.5 text-primary" /> {circuit.lengthMeters}m
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-smc-muted">Curvas</p>
                      <p className="text-sm font-semibold text-white">{circuit.numberOfCurves ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-smc-muted">Asfalto</p>
                      <p className="text-sm font-semibold text-white capitalize">{circuit.asphaltType ?? '—'}</p>
                    </div>
                  </div>
                  {circuit.notes && (
                    <p className="text-xs text-smc-muted mt-3 line-clamp-2">{circuit.notes}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
