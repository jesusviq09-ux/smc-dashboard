import { apiClient } from './client'
import { db } from '../indexeddb/db'
import type { Goal } from '@/types'

export const goalsApi = {
  getAll: async (): Promise<Goal[]> => {
    try {
      const res = await apiClient.get('/goals')
      return res.data
    } catch {
      return db.goals.toArray() as unknown as Goal[]
    }
  },
  create: async (data: Omit<Goal, 'id'>): Promise<Goal> => {
    try {
      const res = await apiClient.post('/goals', data)
      return res.data
    } catch (err: any) {
      // Re-throw with a clear message so onError handlers can display it
      const message = err?.response?.data?.error || err?.message || 'Error de red al crear el objetivo'
      throw new Error(message)
    }
  },
  update: async (id: string, data: Partial<Goal>): Promise<Goal> => {
    try {
      const res = await apiClient.put(`/goals/${id}`, data)
      return res.data
    } catch (err: any) {
      const message = err?.response?.data?.error || err?.message || 'Error de red al actualizar el objetivo'
      throw new Error(message)
    }
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/goals/${id}`)
  },
}
