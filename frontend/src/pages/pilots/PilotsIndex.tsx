import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Search, Filter, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useState } from 'react'
import { pilotsApi } from '@/services/api/pilots.api'
import { Pilot } from '@/types'
import { getScoreColor, RATING_LABELS } from '@/utils/pilotScore'
import ScoreRing from '@/components/ui/ScoreRing'
import { Card, CardContent } from '@/components/ui/Card'

export default function PilotsIndex() {
  const [search, setSearch] = useState('')
  const queryClient = useQueryClient()

  const { data: pilots = [], isLoading } = useQuery({
    queryKey: ['pilots'],
    queryFn: pilotsApi.getAll,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pilotsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pilots'] }),
  })

  const filtered = pilots.filter(p =>
    p.fullName.toLowerCase().includes(search.toLowerCase()) ||
    p.dni.includes(search)
  )

  const avgScore = pilots.length > 0
    ? (pilots.reduce((s, p) => s + (p.weightedScore ?? 0), 0) / pilots.length).toFixed(1)
    : '0.0'

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="section-title mb-0">Pilotos</h1>
          <p className="text-smc-muted text-sm mt-1">{pilots.length} piloto{pilots.length !== 1 ? 's' : ''} · Media equipo: {avgScore}/10</p>
        </div>
        <Link to="/pilots/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Añadir piloto
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-smc-muted" />
        <input
          type="text"
          placeholder="Buscar por nombre o DNI..."
          className="input-field pl-10"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Pilots Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-48 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-smc-darker mx-auto mb-4 flex items-center justify-center">
                <Filter className="w-7 h-7 text-smc-muted" />
              </div>
              <p className="text-smc-muted">
                {search ? 'No se encontraron pilotos con esa búsqueda.' : 'No hay pilotos registrados.'}
              </p>
              {!search && (
                <Link to="/pilots/new" className="btn-primary mt-4 inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" /> Añadir primer piloto
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(pilot => (
            <PilotCard key={pilot.id} pilot={pilot} onDelete={() => deleteMutation.mutate(pilot.id)} />
          ))}
        </div>
      )}
    </div>
  )
}

function PilotCard({ pilot, onDelete }: { pilot: Pilot; onDelete: () => void }) {
  const categories = pilot.age < 16 ? ['F24'] : ['F24', 'F24+']

  return (
    <Link to={`/pilots/${pilot.id}`} className="card-hover block">
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border-2 border-primary/20 flex items-center justify-center flex-shrink-0 text-xl font-bold text-primary">
            {pilot.fullName.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-white truncate">{pilot.fullName}</h3>
            <p className="text-xs text-smc-muted">{pilot.age} años · {pilot.weightKg} kg</p>
            <div className="flex gap-1 mt-1.5">
              {categories.map(cat => (
                <span key={cat} className="badge-blue text-xs">{cat}</span>
              ))}
              {!pilot.availability && (
                <span className="badge-red text-xs">No disponible</span>
              )}
            </div>
          </div>

          {/* Score */}
          <ScoreRing score={pilot.weightedScore ?? 0} size={52} strokeWidth={4} />
        </div>

        {/* Mini ratings */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          {Object.entries(pilot.ratings).slice(0, 3).map(([key, value]) => (
            <div key={key} className="text-center">
              <div className="text-xs text-smc-muted truncate">
                {key === 'experience' ? 'Exp' : key === 'driving' ? 'Pilot' : 'Energía'}
              </div>
              <div className={`text-sm font-bold ${getScoreColor(value as number)}`}>{value}/10</div>
            </div>
          ))}
        </div>
      </div>
    </Link>
  )
}
