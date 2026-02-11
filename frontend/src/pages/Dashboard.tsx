import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Users, Dumbbell, Trophy, Wrench, Activity,
  Calendar, TrendingUp, AlertTriangle, CheckCircle2, Clock
} from 'lucide-react'
import { Card, CardContent, StatCard } from '@/components/ui/Card'
import { pilotsApi } from '@/services/api/pilots.api'
import { trainingApi } from '@/services/api/training.api'
import { raceApi } from '@/services/api/race.api'
import { maintenanceApi } from '@/services/api/maintenance.api'
import { db } from '@/services/indexeddb/db'
import { useLiveQuery } from 'dexie-react-hooks'
import { seedInitialData } from '@/services/indexeddb/db'
import { useEffect } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export default function Dashboard() {
  // Seed initial data on first load
  useEffect(() => {
    seedInitialData()
  }, [])

  const { data: pilots = [] } = useQuery({
    queryKey: ['pilots'],
    queryFn: pilotsApi.getAll,
  })

  const { data: sessions = [] } = useQuery({
    queryKey: ['training-sessions'],
    queryFn: trainingApi.getSessions,
  })

  const { data: races = [] } = useQuery({
    queryKey: ['race-events'],
    queryFn: raceApi.getEvents,
  })

  const { data: alerts = [] } = useQuery({
    queryKey: ['maintenance-alerts'],
    queryFn: maintenanceApi.getAlerts,
  })

  const vehicles = useLiveQuery(() => db.vehicles.toArray(), [])

  const upcomingRaces = races
    .filter(r => new Date(r.date) >= new Date() && r.status !== 'cancelled')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3)

  const recentSessions = sessions
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  const criticalAlerts = alerts.filter(a => a.severity === 'red')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-smc-muted mt-1">
          {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
        </p>
      </div>

      {/* Critical Alerts */}
      {criticalAlerts.length > 0 && (
        <div className="bg-danger/10 border border-danger/30 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-danger" />
            <span className="font-semibold text-danger">{criticalAlerts.length} alerta{criticalAlerts.length !== 1 ? 's' : ''} crítica{criticalAlerts.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {criticalAlerts.slice(0, 3).map(alert => (
              <div key={alert.id} className="flex items-start gap-2 text-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-danger mt-1.5 flex-shrink-0" />
                <span className="text-smc-text">{alert.message}</span>
              </div>
            ))}
          </div>
          <Link to="/maintenance" className="text-sm text-danger mt-3 inline-flex items-center gap-1 hover:underline">
            Ver todas →
          </Link>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pilotos activos"
          value={pilots.filter(p => p.availability).length}
          icon={Users}
          color="primary"
        />
        <StatCard
          label="Sesiones este mes"
          value={sessions.filter(s => {
            const sessionDate = new Date(s.date)
            const now = new Date()
            return sessionDate.getMonth() === now.getMonth() &&
              sessionDate.getFullYear() === now.getFullYear()
          }).length}
          icon={Dumbbell}
          color="success"
        />
        <StatCard
          label="Carreras programadas"
          value={upcomingRaces.length}
          icon={Trophy}
          color="warning"
        />
        <StatCard
          label="Alertas mantenimiento"
          value={alerts.length}
          icon={alerts.length > 0 ? AlertTriangle : CheckCircle2}
          color={alerts.length > 0 ? 'danger' : 'success'}
        />
      </div>

      {/* Vehicle Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {vehicles?.map(vehicle => (
          <Card key={vehicle.id} className="overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-primary to-primary/30" />
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-white text-lg">{vehicle.name}</h3>
                  <p className="text-sm text-smc-muted">{vehicle.material} · {vehicle.weightKg} kg</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className={vehicle.status === 'operational' ? 'status-green' : 'status-red'} />
                  <span className={`text-xs font-medium ${vehicle.status === 'operational' ? 'text-success' : 'text-danger'}`}>
                    {vehicle.status === 'operational' ? 'Operativo' : 'En mantenimiento'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-smc-muted">Horas totales</p>
                  <p className="font-semibold text-white">{vehicle.totalHours}h</p>
                </div>
                <div>
                  <p className="text-xs text-smc-muted">Km recorridos</p>
                  <p className="font-semibold text-white">{vehicle.totalKm} km</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Link
                  to={`/maintenance?vehicleId=${vehicle.id}`}
                  className="flex-1 text-center text-xs btn-secondary py-1.5"
                >
                  Mantenimiento
                </Link>
                <Link
                  to={`/maintenance/checklist/${vehicle.id}`}
                  className="flex-1 text-center text-xs btn-primary py-1.5"
                >
                  Checklist
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming Races */}
        <Card title="Próximas carreras" action={
          <Link to="/races" className="text-xs text-primary hover:underline">Ver todas</Link>
        }>
          <CardContent className="pt-3">
            {upcomingRaces.length === 0 ? (
              <div className="text-center py-8 text-smc-muted">
                <Trophy className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay carreras programadas</p>
                <Link to="/races/new" className="text-xs text-primary mt-2 hover:underline inline-block">
                  Crear carrera
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingRaces.map(race => (
                  <Link
                    key={race.id}
                    to={`/races/${race.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-smc-darker hover:bg-smc-border/30 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center flex-shrink-0">
                      <Trophy className="w-5 h-5 text-warning" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm truncate">{race.name}</p>
                      <p className="text-xs text-smc-muted flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(race.date), "d MMM yyyy", { locale: es })}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {race.categories.map(cat => (
                        <span key={cat} className="badge-blue text-xs">{cat}</span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Training */}
        <Card title="Últimos entrenamientos" action={
          <Link to="/training" className="text-xs text-primary hover:underline">Ver todos</Link>
        }>
          <CardContent className="pt-3">
            {recentSessions.length === 0 ? (
              <div className="text-center py-8 text-smc-muted">
                <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay sesiones registradas</p>
                <Link to="/training/new" className="text-xs text-primary mt-2 hover:underline inline-block">
                  Crear sesión
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSessions.map(session => (
                  <Link
                    key={session.id}
                    to={`/training/${session.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg bg-smc-darker hover:bg-smc-border/30 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white text-sm truncate">
                        {session.location?.name ?? 'Circuito'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-smc-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(session.date), "d MMM", { locale: es })}
                        </p>
                        <p className="text-xs text-smc-muted">
                          {session.durationMinutes} min
                        </p>
                      </div>
                    </div>
                    <span className={`badge text-xs ${
                      session.status === 'completed' ? 'badge-green' :
                      session.status === 'in_progress' ? 'badge-primary' : 'badge-yellow'
                    }`}>
                      {session.status === 'completed' ? 'Completada' :
                       session.status === 'in_progress' ? 'En curso' : 'Planificada'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card title="Acciones rápidas">
        <CardContent className="pt-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Link to="/pilots/new" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-smc-darker hover:bg-smc-border/30 transition-colors text-center">
              <Users className="w-6 h-6 text-primary" />
              <span className="text-xs text-smc-text">Añadir piloto</span>
            </Link>
            <Link to="/training/new" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-smc-darker hover:bg-smc-border/30 transition-colors text-center">
              <Dumbbell className="w-6 h-6 text-success" />
              <span className="text-xs text-smc-text">Nueva sesión</span>
            </Link>
            <Link to="/races/new" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-smc-darker hover:bg-smc-border/30 transition-colors text-center">
              <Trophy className="w-6 h-6 text-warning" />
              <span className="text-xs text-smc-text">Nueva carrera</span>
            </Link>
            <Link to="/stats" className="flex flex-col items-center gap-2 p-4 rounded-xl bg-smc-darker hover:bg-smc-border/30 transition-colors text-center">
              <TrendingUp className="w-6 h-6 text-info" />
              <span className="text-xs text-smc-text">Estadísticas</span>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
