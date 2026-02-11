import { useQuery } from '@tanstack/react-query'
import { BarChart2, TrendingUp, Users, Zap } from 'lucide-react'
import { Card, CardContent, StatCard } from '@/components/ui/Card'
import { pilotsApi } from '@/services/api/pilots.api'
import { trainingApi } from '@/services/api/training.api'
import { raceApi } from '@/services/api/race.api'
import { calculateWeightedScore } from '@/utils/pilotScore'
import type { RaceEvent } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts'

export default function StatsIndex() {
  const { data: pilots = [] } = useQuery({ queryKey: ['pilots'], queryFn: pilotsApi.getAll })
  const { data: sessions = [] } = useQuery({ queryKey: ['training-sessions'], queryFn: trainingApi.getSessions })
  const { data: races = [] } = useQuery<RaceEvent[]>({ queryKey: ['races'], queryFn: raceApi.getEvents })

  // Pilot scores bar chart data
  const pilotScoreData = pilots
    .map(p => ({ name: p.fullName.split(' ')[0], score: Number(calculateWeightedScore(p.ratings, p.weightKg).toFixed(2)) }))
    .sort((a, b) => b.score - a.score)

  // Sessions per month
  const sessionsByMonth: Record<string, number> = {}
  sessions.forEach(s => {
    const month = s.date?.slice(0, 7) ?? 'N/A'
    sessionsByMonth[month] = (sessionsByMonth[month] ?? 0) + 1
  })
  const sessionMonthData = Object.entries(sessionsByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month: month.slice(5), count }))

  // Radar data: average team ratings
  const avgRatings = pilots.length > 0 ? {
    experience: pilots.reduce((s, p) => s + (p.ratings?.experience ?? 0), 0) / pilots.length,
    driving: pilots.reduce((s, p) => s + (p.ratings?.driving ?? 0), 0) / pilots.length,
    energyManagement: pilots.reduce((s, p) => s + (p.ratings?.energyManagement ?? 0), 0) / pilots.length,
    teamwork: pilots.reduce((s, p) => s + (p.ratings?.teamwork ?? 0), 0) / pilots.length,
    consistency: pilots.reduce((s, p) => s + (p.ratings?.consistency ?? 0), 0) / pilots.length,
    adaptation: pilots.reduce((s, p) => s + (p.ratings?.adaptation ?? 0), 0) / pilots.length,
  } : null

  const radarData = avgRatings ? [
    { subject: 'Experiencia', A: avgRatings.experience },
    { subject: 'Conducción', A: avgRatings.driving },
    { subject: 'Energía', A: avgRatings.energyManagement },
    { subject: 'Equipo', A: avgRatings.teamwork },
    { subject: 'Consistencia', A: avgRatings.consistency },
    { subject: 'Adaptación', A: avgRatings.adaptation },
  ] : []

  const finishedRaces = races.filter(r => r.status === 'completed').length
  const avgSessionsPilot = pilots.length > 0 ? (sessions.length / pilots.length).toFixed(1) : '—'

  return (
    <div className="space-y-6">
      <h1 className="section-title">Estadísticas del equipo</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Pilotos" value={pilots.length} icon={Users} />
        <StatCard label="Sesiones" value={sessions.length} icon={TrendingUp} />
        <StatCard label="Carreras" value={`${finishedRaces}/${races.length}`} icon={Zap} />
        <StatCard label="Sesiones/piloto" value={avgSessionsPilot} icon={BarChart2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Puntuación por piloto">
          <CardContent>
            {pilotScoreData.length === 0 ? (
              <p className="text-sm text-smc-muted text-center py-8">Sin pilotos</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={pilotScoreData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis type="number" domain={[0, 10]} stroke="#8b949e" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" stroke="#8b949e" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: 8 }} />
                  <Bar dataKey="score" fill="#00d4ff" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card title="Sesiones de entrenamiento por mes">
          <CardContent>
            {sessionMonthData.length === 0 ? (
              <p className="text-sm text-smc-muted text-center py-8">Sin sesiones registradas</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={sessionMonthData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                  <XAxis dataKey="month" stroke="#8b949e" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#8b949e" tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: 8 }} />
                  <Line type="monotone" dataKey="count" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4, fill: '#f59e0b' }} name="Sesiones" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {radarData.length > 0 && (
        <Card title="Perfil medio del equipo">
          <CardContent>
            <div className="flex justify-center">
              <RadarChart width={320} height={260} data={radarData}>
                <PolarGrid stroke="#30363d" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#8b949e', fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={{ fill: '#8b949e', fontSize: 9 }} />
                <Radar name="Equipo" dataKey="A" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.2} />
              </RadarChart>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
