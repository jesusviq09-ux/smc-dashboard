import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, CheckSquare, Plus, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { communicationApi } from '@/services/api/communication.api'
import { pilotsApi } from '@/services/api/pilots.api'
import { raceApi } from '@/services/api/race.api'
import type { RaceEvent } from '@/types'

export default function BriefingForm() {
  const navigate = useNavigate()
  const [type, setType] = useState<'pre' | 'post'>('pre')
  const [raceId, setRaceId] = useState('')
  const [objectives, setObjectives] = useState<string[]>([''])
  const [safetyPoints, setSafetyPoints] = useState<string[]>([''])
  const [notes, setNotes] = useState('')
  const [attendees, setAttendees] = useState<string[]>([])

  const { data: races = [] } = useQuery<RaceEvent[]>({ queryKey: ['races'], queryFn: raceApi.getEvents })
  const { data: pilots = [] } = useQuery({ queryKey: ['pilots'], queryFn: pilotsApi.getAll })

  const mutation = useMutation({
    mutationFn: communicationApi.saveBriefing,
    onSuccess: () => navigate('/communication'),
  })

  const addLine = (arr: string[], set: (v: string[]) => void) => set([...arr, ''])
  const updateLine = (arr: string[], set: (v: string[]) => void, i: number, val: string) => {
    const copy = [...arr]; copy[i] = val; set(copy)
  }
  const removeLine = (arr: string[], set: (v: string[]) => void, i: number) => set(arr.filter((_, idx) => idx !== i))

  const submit = () => {
    mutation.mutate({
      type, raceId: raceId || undefined,
      objectives: objectives.filter(Boolean),
      safetyPoints: safetyPoints.filter(Boolean),
      notes, attendees,
      createdAt: new Date().toISOString(),
    } as any)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-smc-muted hover:text-smc-text"><ArrowLeft className="w-5 h-5" /></button>
        <h1 className="section-title mb-0">Nuevo briefing</h1>
      </div>

      <Card>
        <CardContent>
          <div className="space-y-5">
            <div>
              <label className="form-label">Tipo</label>
              <div className="flex gap-2">
                {(['pre', 'post'] as const).map(t => (
                  <button key={t} onClick={() => setType(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${type === t ? 'bg-primary text-smc-dark' : 'bg-smc-dark text-smc-muted border border-smc-border'}`}>
                    {t === 'pre' ? 'Pre-carrera' : 'Post-carrera (debrief)'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="form-label">Carrera (opcional)</label>
              <select className="input-field" value={raceId} onChange={e => setRaceId(e.target.value)}>
                <option value="">Sin carrera asociada</option>
                {races.map(r => <option key={r.id} value={r.id}>{r.name} — {r.date?.slice(0, 10)}</option>)}
              </select>
            </div>
            <div>
              <label className="form-label">Pilotos asistentes</label>
              <div className="flex flex-wrap gap-2">
                {pilots.map(p => (
                  <button key={p.id} onClick={() => setAttendees(a => a.includes(p.id) ? a.filter(x => x !== p.id) : [...a, p.id])}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${attendees.includes(p.id) ? 'border-primary bg-primary/20 text-primary' : 'border-smc-border text-smc-muted hover:border-smc-text'}`}>
                    <CheckSquare className="w-3 h-3 inline mr-1" />{p.fullName}
                  </button>
                ))}
              </div>
            </div>
            {[
              { label: 'Objetivos', items: objectives, set: setObjectives, placeholder: 'Ej: Mantener velocidad constante en curvas' },
              { label: 'Puntos de seguridad', items: safetyPoints, set: setSafetyPoints, placeholder: 'Ej: No adelantar en la chicane interior' },
            ].map(({ label, items, set, placeholder }) => (
              <div key={label}>
                <label className="form-label">{label}</label>
                <div className="space-y-2">
                  {items.map((item, i) => (
                    <div key={i} className="flex gap-2">
                      <input className="input-field flex-1" value={item} placeholder={placeholder}
                        onChange={e => updateLine(items, set, i, e.target.value)} />
                      {items.length > 1 && (
                        <button onClick={() => removeLine(items, set, i)} className="text-smc-muted hover:text-danger">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => addLine(items, set)} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Añadir
                  </button>
                </div>
              </div>
            ))}
            <div>
              <label className="form-label">Notas adicionales</label>
              <textarea className="input-field min-h-[80px]" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones, táctica específica..." />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end">
        <button onClick={() => navigate(-1)} className="btn-secondary">Cancelar</button>
        <button onClick={submit} disabled={mutation.isPending} className="btn-primary">
          {mutation.isPending ? 'Guardando...' : 'Guardar briefing'}
        </button>
      </div>
    </div>
  )
}
