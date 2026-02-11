import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Trophy, Calendar, Play, Flag } from 'lucide-react'
import { raceApi } from '@/services/api/race.api'
import { Card, CardContent } from '@/components/ui/Card'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function RaceIndex() {
  const { data: races = [], isLoading } = useQuery({
    queryKey: ['race-events'],
    queryFn: raceApi.getEvents,
  })

  const upcoming = races.filter(r => new Date(r.date) >= new Date())
  const past = races.filter(r => new Date(r.date) < new Date())

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="section-title mb-0">Carreras</h1>
          <p className="text-smc-muted text-sm mt-1">{upcoming.length} próximas · {past.length} disputadas</p>
        </div>
        <Link to="/races/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva carrera
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : races.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 mx-auto mb-4 text-smc-muted opacity-30" />
              <p className="text-smc-muted mb-4">No hay carreras registradas.</p>
              <Link to="/races/new" className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Crear primera carrera
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-smc-muted uppercase tracking-wider mb-3">Próximas</h2>
              <div className="space-y-2">
                {upcoming.map(race => <RaceCard key={race.id} race={race} />)}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-smc-muted uppercase tracking-wider mb-3">Historial</h2>
              <div className="space-y-2">
                {past.map(race => <RaceCard key={race.id} race={race} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function RaceCard({ race }: { race: import('@/types').RaceEvent }) {
  const isPast = new Date(race.date) < new Date()
  const isLive = race.status === 'in_progress'

  return (
    <div className="card-hover flex items-center gap-4 p-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
        isLive ? 'bg-danger/20 border border-danger/30 animate-pulse' :
        isPast ? 'bg-smc-darker border border-smc-border' :
        'bg-warning/10 border border-warning/20'
      }`}>
        {isLive ? <Play className="w-5 h-5 text-danger" /> :
         isPast ? <Flag className="w-5 h-5 text-smc-muted" /> :
         <Trophy className="w-5 h-5 text-warning" />}
      </div>

      <div className="flex-1 min-w-0">
        <Link to={`/races/${race.id}`} className="font-bold text-white hover:text-primary transition-colors">
          {race.name}
        </Link>
        <div className="flex items-center gap-3 mt-1 text-xs text-smc-muted flex-wrap">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {format(new Date(race.date), "d MMM yyyy · HH:mm", { locale: es })}
          </span>
          {race.categories?.map(cat => (
            <span key={cat} className="badge-blue">{cat}</span>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        {!isPast && race.status !== 'cancelled' && (
          <Link to={`/races/${race.id}/live`} className={`btn-primary py-1.5 text-sm flex items-center gap-1 ${
            isLive ? 'bg-danger/90 hover:bg-danger' : ''
          }`}>
            <Play className="w-3 h-3" />
            {isLive ? 'En vivo' : 'Iniciar'}
          </Link>
        )}
        <Link to={`/races/${race.id}`} className="btn-secondary py-1.5 text-sm">
          Ver
        </Link>
      </div>
    </div>
  )
}
