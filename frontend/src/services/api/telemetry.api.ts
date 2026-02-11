import { apiClient } from './client'
import { db } from '../indexeddb/db'
import { TelemetryReading } from '@/types'

export const telemetryApi = {
  getSessionData: async (sessionId: string, sessionType: 'training' | 'race'): Promise<TelemetryReading[]> => {
    try {
      const { data } = await apiClient.get<TelemetryReading[]>(`/telemetry/session/${sessionType}/${sessionId}`)
      await db.telemetryReadings.bulkPut(data)
      return data
    } catch {
      return db.telemetryReadings
        .where('sessionId').equals(sessionId)
        .toArray()
    }
  },

  getLiveStream: (deviceId: string, onData: (reading: TelemetryReading) => void): EventSource => {
    const apiUrl = import.meta.env.VITE_API_URL || '/api'
    const es = new EventSource(`${apiUrl}/telemetry/live/${deviceId}`)

    es.onmessage = (event) => {
      const reading: TelemetryReading = JSON.parse(event.data)
      // Buffer to IndexedDB immediately
      db.telemetryReadings.add(reading).catch(() => {}) // Ignore duplicate key errors
      onData(reading)
    }

    es.onerror = () => {
      es.close()
    }

    return es
  },

  bufferReading: async (reading: Omit<TelemetryReading, 'id'>): Promise<void> => {
    await db.telemetryReadings.add(reading as TelemetryReading)
  },

  syncBufferedReadings: async (sessionId: string): Promise<void> => {
    const unsynced = await db.telemetryReadings
      .where('sessionId').equals(sessionId)
      .toArray()

    if (unsynced.length === 0) return

    // Batch upload in chunks of 100
    const chunkSize = 100
    for (let i = 0; i < unsynced.length; i += chunkSize) {
      const chunk = unsynced.slice(i, i + chunkSize)
      await apiClient.post('/telemetry/batch', chunk)
    }
  },

  importCSV: async (file: File, deviceId: string): Promise<number> => {
    const text = await file.text()
    const lines = text.split('\n').filter(l => l.trim())
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

    const readings: Omit<TelemetryReading, 'id'>[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',')
      const row: Record<string, string> = {}
      headers.forEach((h, idx) => { row[h] = values[idx]?.trim() ?? '' })

      readings.push({
        deviceId,
        voltage: parseFloat(row.voltage ?? row.v ?? row.voltaje ?? '0'),
        current: parseFloat(row.current ?? row.a ?? row.corriente ?? '0'),
        temperature: parseFloat(row.temperature ?? row.temp ?? row.temperatura ?? '0'),
        speed: parseFloat(row.speed ?? row.velocidad ?? row.kmh ?? '0'),
        gpsLat: row.lat ? parseFloat(row.lat) : undefined,
        gpsLon: row.lon ?? row.lng ? parseFloat(row.lon ?? row.lng) : undefined,
        timestamp: row.timestamp ?? row.time ?? row.fecha ?? new Date().toISOString(),
      })
    }

    await db.telemetryReadings.bulkPut(readings as TelemetryReading[])
    return readings.length
  },

  exportToCSV: async (sessionId: string): Promise<string> => {
    const readings = await db.telemetryReadings
      .where('sessionId').equals(sessionId)
      .toArray()

    const headers = ['timestamp', 'voltage', 'current', 'temperature', 'speed', 'gps_lat', 'gps_lon']
    const rows = readings.map(r =>
      [r.timestamp, r.voltage, r.current, r.temperature, r.speed, r.gpsLat ?? '', r.gpsLon ?? ''].join(',')
    )

    return [headers.join(','), ...rows].join('\n')
  },

  getEchookConfig: () => {
    const apiUrl = import.meta.env.VITE_ECHOOK_URL || ''
    const apiKey = import.meta.env.VITE_ECHOOK_KEY || ''
    return { apiUrl, apiKey }
  },
}
