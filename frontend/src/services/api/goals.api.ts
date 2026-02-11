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
    const res = await apiClient.post('/goals', data)
    return res.data
  },
  update: async (id: string, data: Partial<Goal>): Promise<Goal> => {
    const res = await apiClient.patch(`/goals/${id}`, data)
    return res.data
  },
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/goals/${id}`)
  },
}
