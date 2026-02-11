import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { RaceIncident } from '@/types'

interface LiveRaceState {
  raceId: string | null
  isLive: boolean
  startTimestamp: number | null
  currentStintByVehicle: Record<string, number>  // vehicleId -> stintNumber
  incidents: RaceIncident[]
  isPaused: boolean
  pausedAt: number | null
  totalPausedMs: number
}

interface RaceStore {
  liveRace: LiveRaceState
  startRace: (raceId: string) => void
  stopRace: () => void
  pauseRace: () => void
  resumeRace: () => void
  advanceStint: (vehicleId: string) => void
  addIncident: (incident: Omit<RaceIncident, 'id'>) => void
  resolveIncident: (id: string) => void
  getElapsed: () => number
}

const INITIAL_LIVE_STATE: LiveRaceState = {
  raceId: null,
  isLive: false,
  startTimestamp: null,
  currentStintByVehicle: {},
  incidents: [],
  isPaused: false,
  pausedAt: null,
  totalPausedMs: 0,
}

export const useRaceStore = create<RaceStore>()(
  persist(
    (set, get) => ({
      liveRace: INITIAL_LIVE_STATE,

      startRace: (raceId) => set({
        liveRace: {
          ...INITIAL_LIVE_STATE,
          raceId,
          isLive: true,
          startTimestamp: Date.now(),
        }
      }),

      stopRace: () => set({ liveRace: INITIAL_LIVE_STATE }),

      pauseRace: () => set(state => ({
        liveRace: {
          ...state.liveRace,
          isPaused: true,
          pausedAt: Date.now(),
        }
      })),

      resumeRace: () => set(state => {
        const pausedDuration = state.liveRace.pausedAt
          ? Date.now() - state.liveRace.pausedAt
          : 0
        return {
          liveRace: {
            ...state.liveRace,
            isPaused: false,
            pausedAt: null,
            totalPausedMs: state.liveRace.totalPausedMs + pausedDuration,
          }
        }
      }),

      advanceStint: (vehicleId) => set(state => ({
        liveRace: {
          ...state.liveRace,
          currentStintByVehicle: {
            ...state.liveRace.currentStintByVehicle,
            [vehicleId]: (state.liveRace.currentStintByVehicle[vehicleId] ?? 0) + 1,
          }
        }
      })),

      addIncident: (incident) => set(state => ({
        liveRace: {
          ...state.liveRace,
          incidents: [
            ...state.liveRace.incidents,
            { ...incident, id: crypto.randomUUID() },
          ]
        }
      })),

      resolveIncident: (id) => set(state => ({
        liveRace: {
          ...state.liveRace,
          incidents: state.liveRace.incidents.map(i =>
            i.id === id ? { ...i, resolved: true } : i
          )
        }
      })),

      getElapsed: () => {
        const { liveRace } = get()
        if (!liveRace.startTimestamp) return 0
        const now = Date.now()
        const pausedDuration = liveRace.isPaused && liveRace.pausedAt
          ? now - liveRace.pausedAt
          : 0
        return Math.floor((now - liveRace.startTimestamp - liveRace.totalPausedMs - pausedDuration) / 1000)
      },
    }),
    {
      name: 'smc-live-race',
      partialize: (state) => ({ liveRace: state.liveRace }),
    }
  )
)
