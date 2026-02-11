import { apiClient } from './client'

export interface AdminUser {
  id: string
  email: string
  name: string
  department: string
  role: 'admin' | 'user'
  permissions: string[]
}

export const adminApi = {
  getUsers: async (): Promise<AdminUser[]> => {
    const { data } = await apiClient.get<AdminUser[]>('/admin/users')
    return data
  },

  updatePermissions: async (userId: string, permissions: string[]): Promise<AdminUser> => {
    const { data } = await apiClient.put<AdminUser>(`/admin/users/${userId}/permissions`, { permissions })
    return data
  },

  updateRole: async (userId: string, role: 'admin' | 'user'): Promise<AdminUser> => {
    const { data } = await apiClient.put<AdminUser>(`/admin/users/${userId}/role`, { role })
    return data
  },
}
