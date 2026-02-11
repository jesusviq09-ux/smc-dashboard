import { apiClient } from './client'
import { db } from '../indexeddb/db'
import { Circuit, CircuitRecord } from '@/types'

export const circuitsApi = {
  getAll: async (): Promise<Circuit[]> => {
    try {
      const { data } = await apiClient.get<Circuit[]>('/circuits')
      await db.circuits.bulkPut(data)
      return data
    } catch {
      return db.circuits.toArray()
    }
  },

  getById: async (id: string): Promise<Circuit | null> => {
    try {
      const { data } = await apiClient.get<Circuit>(`/circuits/${id}`)
      await db.circuits.put(data)
      return data
    } catch {
      return db.circuits.get(id).then(r => r ?? null)
    }
  },

  create: async (circuit: Omit<Circuit, 'id' | 'createdAt'>): Promise<Circuit> => {
    const { data } = await apiClient.post<Circuit>('/circuits', circuit)
    await db.circuits.put(data)
    return data
  },

  update: async (id: string, updates: Partial<Circuit>): Promise<Circuit> => {
    const { data } = await apiClient.put<Circuit>(`/circuits/${id}`, updates)
    await db.circuits.put(data)
    return data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/circuits/${id}`)
    await db.circuits.delete(id)
  },

  getRecords: async (circuitId: string): Promise<CircuitRecord[]> => {
    try {
      const { data } = await apiClient.get<CircuitRecord[]>(`/circuits/${circuitId}/records`)
      await db.circuitRecords.bulkPut(data)
      return data
    } catch {
      return db.circuitRecords.where('circuitId').equals(circuitId).toArray()
    }
  },

  getTimePrediction: async (circuitId: string, vehicleId: string) => {
    const { data } = await apiClient.get(`/circuits/${circuitId}/predict/${vehicleId}`)
    return data
  },
}
