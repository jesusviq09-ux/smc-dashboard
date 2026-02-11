import { create } from 'zustand'
import { SyncStatus, SyncQueueItem } from '@/types'

interface SyncStore {
  status: SyncStatus
  pendingCount: number
  isSyncing: boolean
  lastSyncAt: string | null
  queue: SyncQueueItem[]
  addToQueue: (item: Omit<SyncQueueItem, 'id' | 'retryCount' | 'status'>) => void
  removeFromQueue: (id: number) => void
  setPendingCount: (count: number) => void
  setStatus: (status: SyncStatus) => void
  triggerSync: () => void
}

export const useSyncStore = create<SyncStore>((set, get) => ({
  status: navigator.onLine ? 'online' : 'offline',
  pendingCount: 0,
  isSyncing: false,
  lastSyncAt: null,
  queue: [],

  addToQueue: (item) => {
    const newItem: SyncQueueItem = {
      ...item,
      retryCount: 0,
      status: 'pending',
      timestamp: new Date().toISOString(),
    }
    set(state => ({
      queue: [...state.queue, newItem],
      pendingCount: state.pendingCount + 1,
    }))
  },

  removeFromQueue: (id) => {
    set(state => ({
      queue: state.queue.filter(item => item.id !== id),
      pendingCount: Math.max(0, state.pendingCount - 1),
    }))
  },

  setPendingCount: (count) => set({ pendingCount: count }),

  setStatus: (status) => set({
    status,
    isSyncing: status === 'syncing',
  }),

  triggerSync: async () => {
    const { queue, isSyncing } = get()
    if (isSyncing || queue.length === 0) return

    set({ status: 'syncing', isSyncing: true })

    try {
      // Import sync engine dynamically to avoid circular deps
      const { processSyncQueue } = await import('@/services/sync/syncEngine')
      await processSyncQueue()
      set({
        status: 'online',
        isSyncing: false,
        lastSyncAt: new Date().toISOString(),
      })
    } catch {
      set({ status: 'error', isSyncing: false })
    }
  },
}))
