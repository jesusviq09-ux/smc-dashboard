import { apiClient } from './client'

export interface Notice {
  id: string
  title: string
  content: string
  authorId: string
  authorName: string
  pinned: boolean
  expiresAt?: string
  createdAt: string
  updatedAt: string
}

export const noticesApi = {
  getAll: async (): Promise<Notice[]> => {
    try {
      const { data } = await apiClient.get<Notice[]>('/notices')
      return data
    } catch {
      return []
    }
  },

  create: async (data: { title: string; content: string; pinned?: boolean; expiresAt?: string }): Promise<Notice> => {
    const { data: created } = await apiClient.post<Notice>('/notices', data)
    return created
  },

  update: async (id: string, data: Partial<Notice>): Promise<Notice> => {
    const { data: updated } = await apiClient.put<Notice>(`/notices/${id}`, data)
    return updated
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/notices/${id}`)
  },
}
