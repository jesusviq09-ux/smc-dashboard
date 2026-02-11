import { useState } from 'react'
import { Download, FileText, Table, Database, CheckCircle2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { useQuery } from '@tanstack/react-query'
import { pilotsApi } from '@/services/api/pilots.api'
import { trainingApi } from '@/services/api/training.api'
import { raceApi } from '@/services/api/race.api'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { calculateWeightedScore } from '@/utils/pilotScore'
import { formatLapTime } from '@/utils/lapStatistics'
import type { RaceEvent } from '@/types'

export default function ExportsIndex() {
  const [done, setDone] = useState<string | null>(null)

  const { data: pilots = [] } = useQuery({ queryKey: ['pilots'], queryFn: pilotsApi.getAll })
  const { data: sessions = [] } = useQuery({ queryKey: ['training-sessions'], queryFn: trainingApi.getSessions })
  const { data: races = [] } = useQuery<RaceEvent[]>({ queryKey: ['races'], queryFn: raceApi.getEvents })

  const flash = (key: string) => { setDone(key); setTimeout(() => setDone(null), 2500) }

  // --- PDF: Team Report ---
  const exportPilotsPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.setTextColor(0, 212, 255)
    doc.text('SMC Greenpower F24 — Informe de Pilotos', 14, 20)
    doc.setFontSize(10)
    doc.setTextColor(150)
    doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 14, 28)
    autoTable(doc, {
      startY: 34,
      head: [['Piloto', 'Peso (kg)', 'Edad', 'Exp', 'Condu.', 'Energía', 'Equipo', 'Consist.', 'Adapt.', 'Puntuación']],
      body: pilots.map(p => [
        p.fullName, p.weightKg ?? '—', p.age ?? '—',
        p.ratings?.experience ?? '—', p.ratings?.driving ?? '—', p.ratings?.energyManagement ?? '—',
        p.ratings?.teamwork ?? '—', p.ratings?.consistency ?? '—', p.ratings?.adaptation ?? '—',
        calculateWeightedScore(p.ratings, p.weightKg).toFixed(2),
      ]),
      styles: { fontSize: 8, fillColor: [22, 27, 34], textColor: [200, 200, 200] },
      headStyles: { fillColor: [0, 100, 130], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [13, 17, 23] },
    })
    doc.save('SMC-pilotos.pdf')
    flash('pilots-pdf')
  }

  // --- PDF: Race Report ---
  const exportRacesPDF = () => {
    const doc = new jsPDF()
    doc.setFontSize(18)
    doc.setTextColor(245, 158, 11)
    doc.text('SMC Greenpower F24 — Informe de Carreras', 14, 20)
    doc.setFontSize(10)
    doc.setTextColor(150)
    doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 14, 28)
    autoTable(doc, {
      startY: 34,
      head: [['Carrera', 'Fecha', 'Circuito', 'Estado']],
      body: races.map(r => [r.name, r.date?.slice(0, 10) ?? '—', r.circuitId ?? '—', r.status]),
      styles: { fontSize: 9, fillColor: [22, 27, 34], textColor: [200, 200, 200] },
      headStyles: { fillColor: [130, 80, 0], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [13, 17, 23] },
    })
    doc.save('SMC-carreras.pdf')
    flash('races-pdf')
  }

  // --- CSV: Pilots ---
  const exportPilotsCSV = () => {
    const ws = XLSX.utils.json_to_sheet(pilots.map(p => ({
      Nombre: p.fullName, Peso: p.weightKg, Edad: p.age, Vehículo: (p as any).vehicleId,
      Experiencia: p.ratings?.experience, Conducción: p.ratings?.driving,
      Energía: p.ratings?.energyManagement, Equipo: p.ratings?.teamwork,
      Consistencia: p.ratings?.consistency, Adaptación: p.ratings?.adaptation,
      Puntuación: calculateWeightedScore(p.ratings, p.weightKg).toFixed(2),
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Pilotos')
    XLSX.writeFile(wb, 'SMC-pilotos.xlsx')
    flash('pilots-csv')
  }

  // --- CSV: Sessions ---
  const exportSessionsCSV = () => {
    const ws = XLSX.utils.json_to_sheet(sessions.map(s => ({
      Fecha: s.date?.slice(0, 10), Vehículo: s.vehicleId, Ubicación: s.locationId,
      Pilotos: s.pilotIds?.join(', ') ?? '', Notas: s.notes ?? '',
    })))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sesiones')
    XLSX.writeFile(wb, 'SMC-sesiones.xlsx')
    flash('sessions-csv')
  }

  // --- JSON Backup ---
  const exportBackupJSON = () => {
    const data = { pilots, sessions, races, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `SMC-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click(); URL.revokeObjectURL(url)
    flash('backup')
  }

  const EXPORTS = [
    {
      key: 'pilots-pdf', icon: FileText, color: 'text-primary', title: 'Informe de pilotos (PDF)',
      desc: 'Tabla completa de pilotos con puntuaciones y ratings.', action: exportPilotsPDF,
    },
    {
      key: 'races-pdf', icon: FileText, color: 'text-warning', title: 'Informe de carreras (PDF)',
      desc: 'Historial de carreras con resultados y circuitos.', action: exportRacesPDF,
    },
    {
      key: 'pilots-csv', icon: Table, color: 'text-success', title: 'Pilotos — Excel/CSV',
      desc: 'Exporta todos los pilotos con métricas a Excel (.xlsx).', action: exportPilotsCSV,
    },
    {
      key: 'sessions-csv', icon: Table, color: 'text-purple-400', title: 'Sesiones de entrenamiento — Excel',
      desc: 'Historial de todas las sesiones de entrenamiento.', action: exportSessionsCSV,
    },
    {
      key: 'backup', icon: Database, color: 'text-smc-muted', title: 'Copia de seguridad (JSON)',
      desc: 'Backup completo de todos los datos del equipo en formato JSON.', action: exportBackupJSON,
    },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="section-title">Exportar datos</h1>
      <p className="text-sm text-smc-muted -mt-2">Genera informes en PDF o exporta datos en Excel/CSV para análisis externo.</p>

      <div className="space-y-3">
        {EXPORTS.map(({ key, icon: Icon, color, title, desc, action }) => (
          <Card key={key} className="hover:border-smc-border/60 transition-colors">
            <CardContent>
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl bg-smc-dark ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-smc-text">{title}</p>
                  <p className="text-xs text-smc-muted mt-0.5">{desc}</p>
                </div>
                <button onClick={action}
                  className={`btn-secondary flex items-center gap-2 flex-shrink-0 ${done === key ? '!border-success !text-success' : ''}`}>
                  {done === key ? <CheckCircle2 className="w-4 h-4" /> : <Download className="w-4 h-4" />}
                  {done === key ? 'Listo' : 'Exportar'}
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
