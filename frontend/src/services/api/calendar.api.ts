import { apiClient } from './client'

export interface CalendarEventItem {
  id: string
  title: string
  date: string       // DATEONLY 'YYYY-MM-DD'
  endDate?: string
  type: 'event' | 'reminder' | 'meeting'
  description?: string
  color?: string
}

export const calendarApi = {
  getEvents: async (): Promise<CalendarEventItem[]> => {
    const { data } = await apiClient.get<CalendarEventItem[]>('/calendar')
    return data
  },

  createEvent: async (event: Omit<CalendarEventItem, 'id'>): Promise<CalendarEventItem> => {
    const { data } = await apiClient.post<CalendarEventItem>('/calendar', event)
    return data
  },

  updateEvent: async (id: string, updates: Partial<CalendarEventItem>): Promise<CalendarEventItem> => {
    const { data } = await apiClient.put<CalendarEventItem>(`/calendar/${id}`, updates)
    return data
  },

  deleteEvent: async (id: string): Promise<void> => {
    await apiClient.delete(`/calendar/${id}`)
  },
}
