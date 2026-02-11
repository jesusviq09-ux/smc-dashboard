import { apiClient } from './client'
import { db } from '../indexeddb/db'
import { TrainingSession, TrainingStint } from '@/types'

export const trainingApi = {
  getSessions: async (): Promise<TrainingSession[]> => {
    try {
      const { data } = await apiClient.get<TrainingSession[]>('/training/sessions')
      await db.trainingSessions.bulkPut(data)
      return data
    } catch {
      return db.trainingSessions.orderBy('date').reverse().toArray()
    }
  },

  getSession: async (id: string): Promise<TrainingSession | null> => {
    try {
      const { data } = await apiClient.get<TrainingSession>(`/training/sessions/${id}`)
      await db.trainingSessions.put(data)
      return data
    } catch {
      return db.trainingSessions.get(id).then(r => r ?? null)
    }
  },

  createSession: async (session: Omit<TrainingSession, 'id' | 'createdAt' | 'stints'>): Promise<TrainingSession> => {
    const payload = { ...session, stints: [] }

    if (!navigator.onLine) {
      const newSession = {
        ...payload,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }
      await db.trainingSessions.put(newSession)
      return newSession
    }

    const { data } = await apiClient.post<TrainingSession>('/training/sessions', payload)
    await db.trainingSessions.put(data)
    return data
  },

  updateSession: async (id: string, updates: Partial<TrainingSession>): Promise<TrainingSession> => {
    if (!navigator.onLine) {
      const existing = await db.trainingSessions.get(id)
      const updated = { ...existing, ...updates }
      await db.trainingSessions.put(updated as TrainingSession)
      return updated as TrainingSession
    }
    const { data } = await apiClient.put<TrainingSession>(`/training/sessions/${id}`, updates)
    await db.trainingSessions.put(data)
    return data
  },

  deleteSession: async (id: string): Promise<void> => {
    if (!navigator.onLine) {
      await db.trainingSessions.delete(id)
      return
    }
    await apiClient.delete(`/training/sessions/${id}`)
    await db.trainingSessions.delete(id)
  },

  addStint: async (sessionId: string, stint: Omit<TrainingStint, 'id' | 'sessionId'>): Promise<TrainingStint> => {
    const payload = { ...stint, sessionId }

    if (!navigator.onLine) {
      const newStint = { ...payload, id: crypto.randomUUID() }
      await db.trainingStints.put(newStint)
      return newStint
    }

    const { data } = await apiClient.post<TrainingStint>(`/training/sessions/${sessionId}/stints`, payload)
    await db.trainingStints.put(data)
    return data
  },

  getLocations: async () => {
    try {
      const { data } = await apiClient.get('/training/locations')
      await db.trainingLocations.bulkPut(data)
      return data
    } catch {
      return db.trainingLocations.toArray()
    }
  },

  compareSession: async (sessionId: string, pilotId: string) => {
    const { data } = await apiClient.get(`/training/sessions/${sessionId}/compare/${pilotId}`)
    return data
  },
}
