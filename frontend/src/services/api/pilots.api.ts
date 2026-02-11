import { apiClient } from './client'
import { db } from '../indexeddb/db'
import { Pilot, PilotRatingHistory, CoachNote } from '@/types'
import { calculateWeightedScore } from '@/utils/pilotScore'

export const pilotsApi = {
  getAll: async (): Promise<Pilot[]> => {
    try {
      const { data } = await apiClient.get<Pilot[]>('/pilots')
      await db.pilots.bulkPut(data)
      return data
    } catch {
      return db.pilots.toArray()
    }
  },

  getById: async (id: string): Promise<Pilot | null> => {
    try {
      const { data } = await apiClient.get<Pilot>(`/pilots/${id}`)
      await db.pilots.put(data)
      return data
    } catch {
      return db.pilots.get(id).then(r => r ?? null)
    }
  },

  create: async (pilot: Omit<Pilot, 'id' | 'createdAt' | 'updatedAt' | 'weightedScore'>): Promise<Pilot> => {
    const weightedScore = calculateWeightedScore(pilot.ratings, pilot.weightKg)
    const payload = { ...pilot, weightedScore }

    if (!navigator.onLine) {
      const tempId = crypto.randomUUID()
      const newPilot = {
        ...payload,
        id: tempId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      await db.pilots.put(newPilot)
      return newPilot
    }

    const { data } = await apiClient.post<Pilot>('/pilots', payload)
    await db.pilots.put(data)
    return data
  },

  update: async (id: string, updates: Partial<Pilot>): Promise<Pilot> => {
    if (updates.ratings || updates.weightKg !== undefined) {
      const existing = await db.pilots.get(id)
      if (existing) {
        const ratings = updates.ratings ?? existing.ratings
        const weightKg = updates.weightKg ?? existing.weightKg
        updates.weightedScore = calculateWeightedScore(ratings, weightKg)
      }
    }

    if (!navigator.onLine) {
      const existing = await db.pilots.get(id)
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() }
      await db.pilots.put(updated as Pilot)
      return updated as Pilot
    }

    const { data } = await apiClient.put<Pilot>(`/pilots/${id}`, updates)
    await db.pilots.put(data)
    return data
  },

  delete: async (id: string): Promise<void> => {
    if (!navigator.onLine) {
      await db.pilots.delete(id)
      return
    }
    await apiClient.delete(`/pilots/${id}`)
    await db.pilots.delete(id)
  },

  getRatingHistory: async (pilotId: string): Promise<PilotRatingHistory[]> => {
    try {
      const { data } = await apiClient.get<PilotRatingHistory[]>(`/pilots/${pilotId}/rating-history`)
      await db.pilotRatingHistory.bulkPut(data)
      return data
    } catch {
      return db.pilotRatingHistory.where('pilotId').equals(pilotId).toArray()
    }
  },

  addCoachNote: async (pilotId: string, note: Omit<CoachNote, 'id' | 'pilotId'>): Promise<CoachNote> => {
    if (!navigator.onLine) {
      const tempNote = {
        ...note,
        id: crypto.randomUUID(),
        pilotId,
      }
      await db.coachNotes.put(tempNote)
      return tempNote
    }

    const { data } = await apiClient.post<CoachNote>(`/pilots/${pilotId}/notes`, note)
    await db.coachNotes.put(data)
    return data
  },

  getCoachNotes: async (pilotId: string): Promise<CoachNote[]> => {
    try {
      const { data } = await apiClient.get<CoachNote[]>(`/pilots/${pilotId}/notes`)
      await db.coachNotes.bulkPut(data)
      return data
    } catch {
      return db.coachNotes.where('pilotId').equals(pilotId).toArray()
    }
  },

  uploadPhoto: async (pilotId: string, file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('photo', file)
    const { data } = await apiClient.post<{ url: string }>(`/pilots/${pilotId}/photo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data.url
  },
}
