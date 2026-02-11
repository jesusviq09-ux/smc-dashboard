import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { Edit2, Trash2, Plus, ChevronLeft, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts'
import { pilotsApi } from '@/services/api/pilots.api'
import { Card, CardContent } from '@/components/ui/Card'
import ScoreRing from '@/components/ui/ScoreRing'
import Modal from '@/components/ui/Modal'
import { RATING_LABELS, RATING_WEIGHTS, getScoreColor, calculateWeightedScore } from '@/utils/pilotScore'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { PilotRatings } from '@/types'

const RATING_KEYS = ['experience', 'driving', 'energyManagement', 'teamwork', 'consistency', 'adaptation'] as const
const LINE_COLORS: Record<string, string> = {
  General: '#00d4ff',
  Experiencia: '#3fb950',
  Pilotaje: '#f78166',
  Energía: '#d29922',
  'Trabajo eq.': '#a855f7',
  Consistencia: '#ec4899',
  Adaptación: '#fb923c',
}

export default function PilotDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  // Notes modal state
  const [noteModal, setNoteModal] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [noteAuthor, setNoteAuthor] = useState('')

  // Evolution modal state
  const [evolutionModal, setEvolutionModal] = useState(false)
  const [evoDate, setEvoDate] = useState(new Date().toISOString().split('T')[0])
  const [evoNotes, setEvoNotes] = useState('')
  const [evoRatings, setEvoRatings] = useState<PilotRatings>({
    experience: 5, driving: 5, energyManagement: 5,
    teamwork: 5, consistency: 5, adaptation: 5,
  })

  // Chart view toggle
  const [chartLines, setChartLines] = useState<string[]>(['General'])

  const { data: pilot, isLoading } = useQuery({
    queryKey: ['pilot', id],
    queryFn: () => pilotsApi.getById(id!),
    enabled: !!id,
  })

  const { data: history = [] } = useQuery({
    queryKey: ['pilot-history', id],
    queryFn: () => pilotsApi.getRatingHistory(id!),
    enabled: !!id,
  })

  const { data: notes = [] } = useQuery({
    queryKey: ['pilot-notes', id],
    queryFn: () => pilotsApi.getCoachNotes(id!),
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => pilotsApi.delete(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilots'] })
      navigate('/pilots')
    },
  })

  const addNoteMutation = useMutation({
    mutationFn: () => pilotsApi.addCoachNote(id!, {
      content: noteContent,
      author: noteAuthor || 'Equipo',
      date: new Date().toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilot-notes', id] })
      setNoteModal(false)
      setNoteContent('')
      setNoteAuthor('')
    },
  })

  // Save evolution snapshot via PUT /pilots/:id (triggers rating history snapshot in backend)
  const saveEvolutionMutation = useMutation({
    mutationFn: () => pilotsApi.update(id!, {
      ratings: evoRatings,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pilot', id] })
      queryClient.invalidateQueries({ queryKey: ['pilot-history', id] })
      setEvolutionModal(false)
      setEvoNotes('')
    },
  })

  if (isLoading) return <div className="skeleton h-96 rounded-xl" />
  if (!pilot) return <p className="text-smc-muted">Piloto no encontrado</p>

  // Pre-fill evo ratings from current pilot when opening modal
  const openEvoModal = () => {
    setEvoRatings({
      experience: pilot.ratings.experience,
      driving: pilot.ratings.driving,
      energyManagement: pilot.ratings.energyManagement,
      teamwork: pilot.ratings.teamwork,
      consistency: pilot.ratings.consistency,
      adaptation: pilot.ratings.adaptation,
    })
    setEvoDate(new Date().toISOString().split('T')[0])
    setEvolutionModal(true)
  }

  // Radar chart data
  const radarData = (Object.entries(pilot.ratings) as [keyof PilotRatings, number][]).map(([key, value]) => ({
    subject: RATING_LABELS[key],
    value,
    weight: RATING_WEIGHTS[key],
    fullMark: 10,
  }))

  // History line chart data — all metrics
  const historyChartData = history
    .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime())
    .map(h => ({
      date: format(new Date(h.sessionDate), 'd MMM yy', { locale: es }),
      General: +(h.weightedScore ?? 0).toFixed(2),
      Experiencia: h.ratings.experience,
      Pilotaje: h.ratings.driving,
      'Energía': h.ratings.energyManagement,
      'Trabajo eq.': h.ratings.teamwork,
      Consistencia: h.ratings.consistency,
      Adaptación: h.ratings.adaptation,
    }))

  const ALL_LINES = ['General', 'Experiencia', 'Pilotaje', 'Energía', 'Trabajo eq.', 'Consistencia', 'Adaptación']

  const toggleLine = (line: string) => {
    setChartLines(prev =>
      prev.includes(line)
        ? prev.length > 1 ? prev.filter(l => l !== line) : prev
        : [...prev, line]
    )
  }

  const categories = pilot.age < 16 ? ['F24'] : ['F24', 'F24+']

  // Preview score in evo modal
  const evoScore = calculateWeightedScore(evoRatings, pilot.weightKg)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/pilots" className="p-2 rounded-lg hover:bg-smc-card text-smc-muted">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">{pilot.fullName}</h1>
          <p className="text-smc-muted text-sm">
            DNI: {pilot.dni} · Desde {format(new Date(pilot.joinDate), "MMMM yyyy", { locale: es })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <button onClick={openEvoModal} className="btn-primary flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Registrar evolución
          </button>
          <Link to={`/pilots/${id}/edit`} className="btn-secondary flex items-center gap-2">
            <Edit2 className="w-4 h-4" /> Editar
          </Link>
          <button
            onClick={() => { if (confirm('¿Eliminar este piloto?')) deleteMutation.mutate() }}
            className="btn-danger flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Profile overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Profile card */}
        <Card>
          <CardContent className="flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/40 to-primary/10 border-4 border-primary/20 flex items-center justify-center text-4xl font-bold text-primary mb-4">
              {pilot.fullName.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-xl font-bold text-white">{pilot.fullName}</h2>
            <div className="flex gap-2 mt-2 flex-wrap justify-center">
              {categories.map(cat => (
                <span key={cat} className="badge-blue">{cat}</span>
              ))}
              <span className={pilot.availability ? 'badge-green' : 'badge-red'}>
                {pilot.availability ? 'Disponible' : 'No disponible'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-6 w-full">
              <div>
                <p className="text-2xl font-bold text-white">{pilot.age}</p>
                <p className="text-xs text-smc-muted">años</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{pilot.weightKg}</p>
                <p className="text-xs text-smc-muted">kg</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{pilot.heightCm}</p>
                <p className="text-xs text-smc-muted">cm</p>
              </div>
            </div>

            <div className="mt-6">
              <ScoreRing score={pilot.weightedScore ?? 0} size={90} strokeWidth={7} label="Puntuación general" />
            </div>

            {history.length > 0 && (
              <p className="text-xs text-smc-muted mt-3">{history.length} registro{history.length !== 1 ? 's' : ''} de evolución</p>
            )}
          </CardContent>
        </Card>

        {/* Center: Radar */}
        <Card title="Perfil de habilidades">
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#30363d" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: "#8b949e", fontSize: 11 }} />
                <Radar
                  name="Valoraciones"
                  dataKey="value"
                  stroke="#00d4ff"
                  fill="#00d4ff"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Right: Ratings list */}
        <Card title="Valoraciones detalladas">
          <CardContent className="space-y-4">
            {(Object.entries(pilot.ratings) as [keyof PilotRatings, number][]).map(([key, value]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-smc-text">{RATING_LABELS[key]}</span>
                  <span className={`text-sm font-bold ${getScoreColor(value)}`}>{value}/10</span>
                </div>
                <div className="h-1.5 bg-smc-darker rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${value * 10}%`,
                      backgroundColor: value >= 8 ? '#3fb950' : value >= 6 ? '#00d4ff' : value >= 4 ? '#d29922' : '#f85149',
                    }}
                  />
                </div>
                <p className="text-xs text-smc-muted mt-0.5">Peso: {(RATING_WEIGHTS[key] * 100).toFixed(0)}%</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Evolution chart */}
      {historyChartData.length > 0 ? (
        <Card title={`Evolución de valoraciones (${historyChartData.length} registros)`}>
          <CardContent>
            {/* Line toggles */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {ALL_LINES.map(line => (
                <button
                  key={line}
                  onClick={() => toggleLine(line)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    chartLines.includes(line)
                      ? 'border-transparent text-smc-dark'
                      : 'border-smc-border text-smc-muted hover:text-smc-text'
                  }`}
                  style={chartLines.includes(line) ? { backgroundColor: LINE_COLORS[line] } : {}}
                >
                  {line}
                </button>
              ))}
            </div>

            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={historyChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="date" tick={{ fill: "#8b949e", fontSize: 10 }} />
                <YAxis domain={[0, 10]} tick={{ fill: "#8b949e", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '8px' }}
                  labelStyle={{ color: '#c9d1d9' }}
                />
                <Legend />
                {ALL_LINES.filter(l => chartLines.includes(l)).map(line => (
                  <Line
                    key={line}
                    type="monotone"
                    dataKey={line}
                    stroke={LINE_COLORS[line]}
                    strokeWidth={line === 'General' ? 2.5 : 1.5}
                    dot={{ fill: LINE_COLORS[line], r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      ) : (
        <Card title="Evolución de valoraciones">
          <CardContent>
            <div className="flex flex-col items-center justify-center py-10 text-smc-muted">
              <TrendingUp className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">Aún no hay registros de evolución.</p>
              <button onClick={openEvoModal} className="btn-primary mt-4 flex items-center gap-2 text-sm">
                <Plus className="w-4 h-4" /> Registrar primera evolución
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card
        title="Notas del equipo"
        action={
          <button onClick={() => setNoteModal(true)} className="btn-primary flex items-center gap-1 text-sm py-1.5">
            <Plus className="w-3 h-3" /> Añadir nota
          </button>
        }
      >
        <CardContent className="pt-3">
          {notes.length === 0 ? (
            <p className="text-smc-muted text-sm text-center py-6">No hay notas añadidas.</p>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <div key={note.id} className="bg-smc-darker rounded-lg p-3">
                  <p className="text-sm text-smc-text">{note.content}</p>
                  <p className="text-xs text-smc-muted mt-2">
                    {note.author} · {format(new Date(note.date), "d MMM yyyy", { locale: es })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note Modal */}
      <Modal
        isOpen={noteModal}
        onClose={() => setNoteModal(false)}
        title="Añadir nota"
        footer={
          <>
            <button onClick={() => setNoteModal(false)} className="btn-secondary">Cancelar</button>
            <button
              onClick={() => addNoteMutation.mutate()}
              disabled={!noteContent.trim() || addNoteMutation.isPending}
              className="btn-primary"
            >
              {addNoteMutation.isPending ? 'Guardando...' : 'Guardar nota'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Nota</label>
            <textarea
              className="input-field resize-none"
              rows={4}
              placeholder="Observaciones, feedback de sesión..."
              value={noteContent}
              onChange={e => setNoteContent(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Autor (opcional)</label>
            <input
              type="text"
              className="input-field"
              placeholder="Nombre del entrenador..."
              value={noteAuthor}
              onChange={e => setNoteAuthor(e.target.value)}
            />
          </div>
        </div>
      </Modal>

      {/* Evolution Modal */}
      <Modal
        isOpen={evolutionModal}
        onClose={() => setEvolutionModal(false)}
        title="Registrar evolución del piloto"
        footer={
          <>
            <button onClick={() => setEvolutionModal(false)} className="btn-secondary">Cancelar</button>
            <button
              onClick={() => saveEvolutionMutation.mutate()}
              disabled={saveEvolutionMutation.isPending}
              className="btn-primary flex items-center gap-2"
            >
              <TrendingUp className="w-4 h-4" />
              {saveEvolutionMutation.isPending ? 'Guardando...' : 'Guardar evolución'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="label">Fecha del registro</label>
              <input
                type="date"
                className="input-field"
                value={evoDate}
                onChange={e => setEvoDate(e.target.value)}
              />
            </div>
            <div className="text-center">
              <p className="text-xs text-smc-muted mb-1">Puntuación calculada</p>
              <ScoreRing score={evoScore} size={64} strokeWidth={5} />
            </div>
          </div>

          <div className="space-y-3">
            {RATING_KEYS.map(key => (
              <div key={key}>
                <div className="flex justify-between mb-1">
                  <label className="text-sm text-smc-text">
                    {RATING_LABELS[key]} <span className="text-xs text-smc-muted">({Math.round(RATING_WEIGHTS[key] * 100)}%)</span>
                  </label>
                  <span className="text-sm font-semibold text-primary">{evoRatings[key]}</span>
                </div>
                <input
                  type="range" min={1} max={10} step={1}
                  value={evoRatings[key]}
                  onChange={e => setEvoRatings(r => ({ ...r, [key]: Number(e.target.value) }))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-smc-muted mt-0.5">
                  <span>1</span><span>10</span>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="label">Notas de la sesión (opcional)</label>
            <textarea
              className="input-field resize-none"
              rows={2}
              placeholder="Contexto de la valoración: entrenamiento, carrera..."
              value={evoNotes}
              onChange={e => setEvoNotes(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
