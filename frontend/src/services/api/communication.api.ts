import { apiClient } from './client'
import { db } from '../indexeddb/db'
import { Message, Briefing } from '@/types'

export const communicationApi = {
  getMessages: async (eventId?: string): Promise<Message[]> => {
    try {
      const url = eventId ? `/messages?eventId=${eventId}` : '/messages'
      const { data } = await apiClient.get<Message[]>(url)
      await db.messages.bulkPut(data)
      return data
    } catch {
      const query = eventId
        ? db.messages.where('eventId').equals(eventId)
        : db.messages.filter(m => !m.eventId)
      return query.toArray()
    }
  },

  sendMessage: async (message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> => {
    if (!navigator.onLine) {
      const newMessage = {
        ...message,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      }
      await db.messages.put(newMessage)
      return newMessage
    }
    const { data } = await apiClient.post<Message>('/messages', message)
    await db.messages.put(data)
    return data
  },

  getBriefing: async (eventId: string, type: 'pre_race' | 'post_race'): Promise<Briefing | null> => {
    try {
      const { data } = await apiClient.get<Briefing>(`/briefings/${eventId}/${type}`)
      await db.briefings.put(data)
      return data
    } catch {
      const result = await db.briefings
        .filter(b => b.eventId === eventId && b.type === type)
        .first()
      return result ?? null
    }
  },

  saveBriefing: async (briefing: Omit<Briefing, 'id' | 'createdAt' | 'confirmations'>): Promise<Briefing> => {
    if (!navigator.onLine) {
      const newBriefing = {
        ...briefing,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        confirmations: [],
      }
      await db.briefings.put(newBriefing)
      return newBriefing
    }
    const { data } = await apiClient.post<Briefing>('/briefings', briefing)
    await db.briefings.put(data)
    return data
  },

  confirmBriefing: async (briefingId: string, memberName: string): Promise<void> => {
    await apiClient.post(`/briefings/${briefingId}/confirm`, { memberName })
  },
}
