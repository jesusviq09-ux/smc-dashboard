import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { RaceIncident } from '@/types'

export interface StintLog {
  id: string
  vehicleId: string
  vehicleName: string
  stintNumber: number
  pilotId: string
  pilotName: string
  startElapsed: number        // seconds from race start
  endElapsed: number | null   // null = ongoing
  plannedDurationMinutes: number
  actualDurationMinutes: number | null
  stintScore?: number         // 1-10 rating
  notes?: string
}

interface LiveRaceState {
  raceId: string | null
  isLive: boolean
  startTimestamp: number | null
  currentStintByVehicle: Record<string, number>  // vehicleId -> stintNumber (0-based idx)
  incidents: RaceIncident[]
  isPaused: boolean
  pausedAt: number | null
  totalPausedMs: number
  stintLogs: StintLog[]
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
  // Stint logging
  startStintLog: (
    vehicleId: string,
    vehicleName: string,
    stintNumber: number,
    pilotId: string,
    pilotName: string,
    plannedDurationMinutes: number,
    elapsed: number
  ) => void
  endStintLog: (
    vehicleId: string,
    elapsed: number,
    score?: number,
    notes?: string
  ) => void
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
  stintLogs: [],
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

      startStintLog: (vehicleId, vehicleName, stintNumber, pilotId, pilotName, plannedDurationMinutes, elapsed) =>
        set(state => ({
          liveRace: {
            ...state.liveRace,
            stintLogs: [
              ...state.liveRace.stintLogs,
              {
                id: crypto.randomUUID(),
                vehicleId,
                vehicleName,
                stintNumber,
                pilotId,
                pilotName,
                startElapsed: elapsed,
                endElapsed: null,
                plannedDurationMinutes,
                actualDurationMinutes: null,
              },
            ],
          },
        })),

      endStintLog: (vehicleId, elapsed, score, notes) =>
        set(state => {
          // Find the most recent ongoing log for this vehicle
          const logs = [...state.liveRace.stintLogs]
          const lastIdx = logs.map((l, i) => ({ l, i }))
            .filter(({ l }) => l.vehicleId === vehicleId && l.endElapsed === null)
            .at(-1)?.i

          if (lastIdx === undefined) return state

          const log = logs[lastIdx]
          const actualDurationMinutes = Math.round((elapsed - log.startElapsed) / 60)
          logs[lastIdx] = {
            ...log,
            endElapsed: elapsed,
            actualDurationMinutes,
            stintScore: score,
            notes,
          }

          return { liveRace: { ...state.liveRace, stintLogs: logs } }
        }),
    }),
    {
      name: 'smc-live-race',
      partialize: (state) => ({ liveRace: state.liveRace }),
    }
  )
)
