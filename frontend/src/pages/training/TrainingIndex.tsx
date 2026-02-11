import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Dumbbell, Clock, MapPin, Car } from 'lucide-react'
import { trainingApi } from '@/services/api/training.api'
import { Card, CardContent } from '@/components/ui/Card'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function TrainingIndex() {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['training-sessions'],
    queryFn: trainingApi.getSessions,
  })

  const grouped = sessions.reduce((acc, session) => {
    const month = format(new Date(session.date), 'MMMM yyyy', { locale: es })
    if (!acc[month]) acc[month] = []
    acc[month].push(session)
    return acc
  }, {} as Record<string, typeof sessions>)

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="section-title mb-0">Entrenamientos</h1>
          <p className="text-smc-muted text-sm mt-1">{sessions.length} sesiones registradas</p>
        </div>
        <Link to="/training/new" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva sesión
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent>
            <div className="text-center py-12">
              <Dumbbell className="w-12 h-12 mx-auto mb-4 text-smc-muted opacity-30" />
              <p className="text-smc-muted mb-4">No hay sesiones de entrenamiento registradas.</p>
              <Link to="/training/new" className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Crear primera sesión
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([month, monthSessions]) => (
          <div key={month}>
            <h2 className="text-sm font-semibold text-smc-muted uppercase tracking-wider mb-3 capitalize">
              {month}
            </h2>
            <div className="space-y-2">
              {monthSessions.map(session => (
                <Link
                  key={session.id}
                  to={`/training/${session.id}`}
                  className="card-hover flex items-center gap-4 p-4"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                    <Dumbbell className="w-6 h-6 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white">
                        {format(new Date(session.date), "d 'de' MMMM", { locale: es })}
                      </span>
                      <span className={`badge text-xs ${
                        session.status === 'completed' ? 'badge-green' :
                        session.status === 'in_progress' ? 'badge-primary' : 'badge-yellow'
                      }`}>
                        {session.status === 'completed' ? 'Completada' :
                         session.status === 'in_progress' ? 'En curso' : 'Planificada'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-smc-muted">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {session.locationId}
                      </span>
                      <span className="flex items-center gap-1">
                        <Car className="w-3 h-3" />
                        {session.vehicleId === 'smc01' ? 'SMC 01' : 'SMC 02 EVO'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {session.durationMinutes} min
                      </span>
                    </div>
                  </div>

                  <div className="text-sm text-smc-muted">
                    {session.stints?.length ?? 0} stints
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
