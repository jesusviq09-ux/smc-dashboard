import { apiClient } from './client'
import { db } from '../indexeddb/db'
import { MaintenanceRecord, MaintenanceChecklist, SparePart } from '@/types'

export interface MaintenanceAlert {
  id: string
  vehicleId: string
  vehicleName: string
  type: 'overdue' | 'upcoming' | 'low_stock'
  message: string
  severity: 'red' | 'yellow'
}

export const maintenanceApi = {
  getRecords: async (vehicleId?: string): Promise<MaintenanceRecord[]> => {
    try {
      const url = vehicleId ? `/maintenance?vehicleId=${vehicleId}` : '/maintenance'
      const { data } = await apiClient.get<MaintenanceRecord[]>(url)
      await db.maintenanceRecords.bulkPut(data)
      return data
    } catch {
      const query = vehicleId
        ? db.maintenanceRecords.where('vehicleId').equals(vehicleId)
        : db.maintenanceRecords
      return query.toArray()
    }
  },

  createRecord: async (record: Omit<MaintenanceRecord, 'id' | 'createdAt'>): Promise<MaintenanceRecord> => {
    if (!navigator.onLine) {
      const newRecord = {
        ...record,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      }
      await db.maintenanceRecords.put(newRecord)
      return newRecord
    }
    const { data } = await apiClient.post<MaintenanceRecord>('/maintenance', record)
    await db.maintenanceRecords.put(data)
    return data
  },

  deleteRecord: async (id: string): Promise<void> => {
    await apiClient.delete(`/maintenance/${id}`)
    await db.maintenanceRecords.delete(id)
  },

  updateRecord: async (id: string, updates: Partial<MaintenanceRecord>): Promise<MaintenanceRecord> => {
    if (!navigator.onLine) {
      const existing = await db.maintenanceRecords.get(id)
      const updated = { ...existing, ...updates }
      await db.maintenanceRecords.put(updated as MaintenanceRecord)
      return updated as MaintenanceRecord
    }
    const { data } = await apiClient.put<MaintenanceRecord>(`/maintenance/${id}`, updates)
    await db.maintenanceRecords.put(data)
    return data
  },

  getAlerts: async (): Promise<MaintenanceAlert[]> => {
    try {
      const { data } = await apiClient.get<MaintenanceAlert[]>('/maintenance/alerts')
      return data
    } catch {
      // Compute locally from IDB
      const records = await db.maintenanceRecords
        .filter(r => !r.completed)
        .toArray()
      const vehicles = await db.vehicles.toArray()

      return records
        .filter(r => r.nextServiceDate && new Date(r.nextServiceDate) <= new Date())
        .map(r => {
          const vehicle = vehicles.find(v => v.id === r.vehicleId)
          return {
            id: r.id,
            vehicleId: r.vehicleId,
            vehicleName: vehicle?.name ?? r.vehicleId,
            type: 'overdue' as const,
            message: `Mantenimiento pendiente: ${r.description}`,
            severity: 'red' as const,
          }
        })
    }
  },

  getChecklists: async (vehicleId: string): Promise<MaintenanceChecklist[]> => {
    try {
      const { data } = await apiClient.get<MaintenanceChecklist[]>(`/maintenance/checklists/${vehicleId}`)
      await db.maintenanceChecklists.bulkPut(data)
      return data
    } catch {
      return db.maintenanceChecklists.where('vehicleId').equals(vehicleId).toArray()
    }
  },

  saveChecklist: async (checklist: Omit<MaintenanceChecklist, 'id'>): Promise<MaintenanceChecklist> => {
    if (!navigator.onLine) {
      const newChecklist = { ...checklist, id: crypto.randomUUID() }
      await db.maintenanceChecklists.put(newChecklist)
      return newChecklist
    }
    const { data } = await apiClient.post<MaintenanceChecklist>('/maintenance/checklists', checklist)
    await db.maintenanceChecklists.put(data)
    return data
  },

  getSpareParts: async (): Promise<SparePart[]> => {
    try {
      const { data } = await apiClient.get<SparePart[]>('/maintenance/parts')
      await db.spareParts.bulkPut(data)
      return data
    } catch {
      return db.spareParts.toArray()
    }
  },

  updateSparePart: async (id: string, updates: Partial<SparePart>): Promise<SparePart> => {
    if (!navigator.onLine) {
      const existing = await db.spareParts.get(id)
      const updated = { ...existing, ...updates }
      await db.spareParts.put(updated as SparePart)
      return updated as SparePart
    }
    const { data } = await apiClient.put<SparePart>(`/maintenance/parts/${id}`, updates)
    await db.spareParts.put(data)
    return data
  },
}
