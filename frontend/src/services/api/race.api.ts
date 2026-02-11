import { apiClient } from './client'
import { db } from '../indexeddb/db'
import { RaceEvent, RaceStrategy } from '@/types'

export const raceApi = {
  getEvents: async (): Promise<RaceEvent[]> => {
    try {
      const { data } = await apiClient.get<RaceEvent[]>('/races')
      await db.raceEvents.bulkPut(data)
      return data
    } catch {
      return db.raceEvents.orderBy('date').reverse().toArray()
    }
  },

  getEvent: async (id: string): Promise<RaceEvent | null> => {
    try {
      const { data } = await apiClient.get<RaceEvent>(`/races/${id}`)
      await db.raceEvents.put(data)
      return data
    } catch {
      return db.raceEvents.get(id).then(r => r ?? null)
    }
  },

  createEvent: async (event: Omit<RaceEvent, 'id' | 'createdAt'>): Promise<RaceEvent> => {
    if (!navigator.onLine) {
      const newEvent = {
        ...event,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }
      await db.raceEvents.put(newEvent)
      return newEvent
    }
    const { data } = await apiClient.post<RaceEvent>('/races', event)
    await db.raceEvents.put(data)
    return data
  },

  updateEvent: async (id: string, updates: Partial<RaceEvent>): Promise<RaceEvent> => {
    if (!navigator.onLine) {
      const existing = await db.raceEvents.get(id)
      const updated = { ...existing, ...updates }
      await db.raceEvents.put(updated as RaceEvent)
      return updated as RaceEvent
    }
    const { data } = await apiClient.put<RaceEvent>(`/races/${id}`, updates)
    await db.raceEvents.put(data)
    return data
  },

  deleteEvent: async (id: string): Promise<void> => {
    await apiClient.delete(`/races/${id}`)
    await db.raceEvents.delete(id)
  },

  getStrategies: async (raceId: string): Promise<RaceStrategy[]> => {
    try {
      const { data } = await apiClient.get<RaceStrategy[]>(`/races/${raceId}/strategies`)
      await db.raceStrategies.bulkPut(data)
      return data
    } catch {
      return db.raceStrategies.where('raceId').equals(raceId).toArray()
    }
  },

  saveStrategy: async (strategy: Omit<RaceStrategy, 'id'>): Promise<RaceStrategy> => {
    if (!navigator.onLine) {
      const newStrategy = { ...strategy, id: crypto.randomUUID() }
      await db.raceStrategies.put(newStrategy)
      return newStrategy
    }
    const { data } = await apiClient.post<RaceStrategy>(`/races/${strategy.raceId}/strategies`, strategy)
    await db.raceStrategies.put(data)
    return data
  },

  generateRecommendation: async (raceId: string, options: {
    priorityMode: string
    vehicleIds: string[]
  }) => {
    const { data } = await apiClient.post(`/races/${raceId}/recommend`, options)
    return data
  },

  updateStrategy: async (id: string, updates: Partial<RaceStrategy>): Promise<RaceStrategy> => {
    if (!navigator.onLine) {
      const existing = await db.raceStrategies.get(id)
      const updated = { ...existing, ...updates }
      await db.raceStrategies.put(updated as RaceStrategy)
      return updated as RaceStrategy
    }
    const { data } = await apiClient.put<RaceStrategy>(`/races/strategies/${id}`, updates)
    await db.raceStrategies.put(data)
    return data
  },
}
