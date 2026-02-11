import { useState, useEffect, useRef } from 'react'
import { Activity, Upload, Download, Wifi, WifiOff } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { telemetryApi } from '@/services/api/telemetry.api'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { TelemetryReading } from '@/types'

function Gauge({ value, max, label, unit, color }: { value: number; max: number; label: string; unit: string; color: string }) {
  const pct = Math.min(value / max, 1)
  const r = 40
  const circ = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="110" height="80" viewBox="0 0 110 90">
        <circle cx="55" cy="65" r={r} fill="none" stroke="#30363d" strokeWidth="8"
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`} strokeLinecap="round"
          transform="rotate(-135 55 65)" />
        <circle cx="55" cy="65" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${circ * 0.75 * pct} ${circ}`} strokeLinecap="round"
          transform="rotate(-135 55 65)" style={{ transition: 'stroke-dasharray 0.4s ease' }} />
        <text x="55" y="62" textAnchor="middle" fill="white" fontSize="16" fontWeight="bold">{value.toFixed(1)}</text>
        <text x="55" y="76" textAnchor="middle" fill="#8b949e" fontSize="10">{unit}</text>
      </svg>
      <span className="text-xs text-smc-muted">{label}</span>
    </div>
  )
}

export default function TelemetryIndex() {
  const [isLive, setIsLive] = useState(false)
  const [liveData, setLiveData] = useState<TelemetryReading | null>(null)
  const [history, setHistory] = useState<TelemetryReading[]>([])
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvMsg, setCsvMsg] = useState('')
  const [activeTab, setActiveTab] = useState<'live' | 'import'>('live')
  const esRef = useRef<EventSource | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isLive) {
      const es = telemetryApi.getLiveStream('smc01', (data) => {
        setLiveData(data)
        setHistory(prev => [...prev.slice(-59), data])
      })
      esRef.current = es
    } else {
      esRef.current?.close()
    }
    return () => esRef.current?.close()
  }, [isLive])

  const handleImport = async () => {
    if (!csvFile) return
    try {
      const count = await telemetryApi.importCSV(csvFile, 'smc01')
      setCsvMsg(`✓ ${count} lecturas importadas`)
    } catch {
      setCsvMsg('Error al importar')
    }
    setTimeout(() => setCsvMsg(''), 3000)
  }

  const handleExport = async () => {
    const csv = await telemetryApi.exportToCSV('smc01')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'telemetria-smc01.csv'
    a.click()
  }

  const chartData = history.map((r, i) => ({
    t: i,
    voltage: r.voltage,
    current: r.current,
    temp: r.temperature,
    speed: r.speed,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="section-title mb-0">Telemetría Echook</h1>
        <div className="flex gap-2">
          {(['live', 'import'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={tab === activeTab ? 'btn-primary' : 'btn-secondary'}>
              {tab === 'live' ? 'En vivo' : 'Importar CSV'}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'live' && (
        <>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {isLive
                    ? <Wifi className="w-4 h-4 text-success animate-pulse" />
                    : <WifiOff className="w-4 h-4 text-smc-muted" />}
                  <span className={`text-sm font-medium ${isLive ? 'text-success' : 'text-smc-muted'}`}>
                    {isLive ? 'Conectado — SMC 01' : 'Desconectado'}
                  </span>
                </div>
                <button onClick={() => setIsLive(l => !l)} className={isLive ? 'btn-danger' : 'btn-primary'}>
                  {isLive ? 'Detener' : 'Iniciar stream'}
                </button>
              </div>
              {liveData ? (
                <div className="flex justify-around flex-wrap gap-4">
                  <Gauge value={liveData.voltage} max={60} label="Voltaje" unit="V" color="#00d4ff" />
                  <Gauge value={Math.abs(liveData.current)} max={50} label="Corriente" unit="A" color="#f59e0b" />
                  <Gauge value={liveData.temperature ?? 0} max={80} label="Temperatura" unit="°C"
                    color={(liveData.temperature ?? 0) > 60 ? '#ef4444' : '#22c55e'} />
                  <Gauge value={liveData.speed ?? 0} max={80} label="Velocidad" unit="km/h" color="#a855f7" />
                </div>
              ) : (
                <div className="flex flex-col items-center py-10 text-smc-muted">
                  <Activity className="w-10 h-10 mb-3 opacity-30" />
                  <p className="text-sm">{isLive ? 'Esperando datos...' : 'Inicia el stream para ver datos en tiempo real'}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card title="Últimos 60 datos">
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                    <XAxis dataKey="t" stroke="#8b949e" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#8b949e" tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#161b22', border: '1px solid #30363d', borderRadius: 8 }} />
                    <Legend />
                    <Line type="monotone" dataKey="voltage" stroke="#00d4ff" dot={false} strokeWidth={2} name="V" />
                    <Line type="monotone" dataKey="current" stroke="#f59e0b" dot={false} strokeWidth={2} name="A" />
                    <Line type="monotone" dataKey="temp" stroke="#22c55e" dot={false} strokeWidth={2} name="°C" />
                    <Line type="monotone" dataKey="speed" stroke="#a855f7" dot={false} strokeWidth={2} name="km/h" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {activeTab === 'import' && (
        <Card title="Importar / Exportar CSV Echook">
          <CardContent>
            <p className="text-sm text-smc-muted mb-4">
              Formato esperado: <code className="bg-smc-dark px-1 rounded text-xs">timestamp, voltage, current, temperature, speed</code>
            </p>
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-smc-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="w-8 h-8 mx-auto mb-2 text-smc-muted" />
              <p className="text-sm text-smc-muted">{csvFile ? csvFile.name : 'Haz clic o arrastra un archivo CSV'}</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden"
              onChange={e => setCsvFile(e.target.files?.[0] ?? null)} />
            {csvMsg && <p className="text-sm text-success mt-2">{csvMsg}</p>}
            <div className="flex gap-3 mt-4 justify-between">
              <button onClick={handleExport} className="btn-secondary flex items-center gap-2 text-sm">
                <Download className="w-4 h-4" /> Exportar CSV
              </button>
              <button onClick={handleImport} disabled={!csvFile} className="btn-primary flex items-center gap-2">
                <Upload className="w-4 h-4" /> Importar
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
