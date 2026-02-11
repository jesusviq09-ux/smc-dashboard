import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AppConfig } from '@/types'

interface AppConfigStore {
  config: AppConfig
  updateConfig: (updates: Partial<AppConfig>) => void
}

const DEFAULT_CONFIG: AppConfig = {
  weightPenaltyThresholdKg: 50,
  weightPenaltyPer10kg: 0.2,
  teamName: 'SMC Greenpower F24',
  echookApiUrl: '',
  echookApiKey: '',
}

export const useAppConfigStore = create<AppConfigStore>()(
  persist(
    (set) => ({
      config: DEFAULT_CONFIG,
      updateConfig: (updates) =>
        set(state => ({ config: { ...state.config, ...updates } })),
    }),
    {
      name: 'smc-app-config',
    }
  )
)
