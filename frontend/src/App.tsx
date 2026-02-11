import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import AppShell from '@/components/layout/AppShell'
import LoadingScreen from '@/components/ui/LoadingScreen'
import { getStoredToken } from '@/hooks/useAuth'

// Auth pages (not lazy — must load fast)
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const PilotsIndex = lazy(() => import('@/pages/pilots/PilotsIndex'))
const PilotDetail = lazy(() => import('@/pages/pilots/PilotDetail'))
const PilotForm = lazy(() => import('@/pages/pilots/PilotForm'))
const TrainingIndex = lazy(() => import('@/pages/training/TrainingIndex'))
const NewSession = lazy(() => import('@/pages/training/NewSession'))
const SessionDetail = lazy(() => import('@/pages/training/SessionDetail'))
const RaceIndex = lazy(() => import('@/pages/race/RaceIndex'))
const NewRace = lazy(() => import('@/pages/race/NewRace'))
const RaceDetail = lazy(() => import('@/pages/race/RaceDetail'))
const LiveRace = lazy(() => import('@/pages/race/LiveRace'))
const Simulator = lazy(() => import('@/pages/race/Simulator'))
const MaintenanceIndex = lazy(() => import('@/pages/maintenance/MaintenanceIndex'))
const VehicleChecklist = lazy(() => import('@/pages/maintenance/VehicleChecklist'))
const SpareParts = lazy(() => import('@/pages/maintenance/SpareParts'))
const TelemetryIndex = lazy(() => import('@/pages/telemetry/TelemetryIndex'))
const CircuitsIndex = lazy(() => import('@/pages/circuits/CircuitsIndex'))
const CircuitDetail = lazy(() => import('@/pages/circuits/CircuitDetail'))
const CircuitForm = lazy(() => import('@/pages/circuits/CircuitForm'))
const ChatIndex = lazy(() => import('@/pages/communication/ChatIndex'))
const BriefingForm = lazy(() => import('@/pages/communication/BriefingForm'))
const DebriefForm = lazy(() => import('@/pages/communication/DebriefForm'))
const StatsIndex = lazy(() => import('@/pages/statistics/StatsIndex'))
const GoalsIndex = lazy(() => import('@/pages/goals/GoalsIndex'))
const ExportsIndex = lazy(() => import('@/pages/exports/ExportsIndex'))
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers'))

// Auth guard: redirects to /login if not authenticated
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = getStoredToken()
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected routes — wrapped in AppShell */}
      <Route path="/*" element={
        <RequireAuth>
          <AppShell>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />

                {/* Pilots */}
                <Route path="/pilots" element={<PilotsIndex />} />
                <Route path="/pilots/new" element={<PilotForm />} />
                <Route path="/pilots/:id" element={<PilotDetail />} />
                <Route path="/pilots/:id/edit" element={<PilotForm />} />

                {/* Training */}
                <Route path="/training" element={<TrainingIndex />} />
                <Route path="/training/new" element={<NewSession />} />
                <Route path="/training/:id" element={<SessionDetail />} />

                {/* Race */}
                <Route path="/races" element={<RaceIndex />} />
                <Route path="/races/new" element={<NewRace />} />
                <Route path="/races/:id" element={<RaceDetail />} />
                <Route path="/races/:id/live" element={<LiveRace />} />
                <Route path="/races/:id/simulator" element={<Simulator />} />

                {/* Maintenance */}
                <Route path="/maintenance" element={<MaintenanceIndex />} />
                <Route path="/maintenance/checklist/:vehicleId" element={<VehicleChecklist />} />
                <Route path="/maintenance/parts" element={<SpareParts />} />

                {/* Telemetry */}
                <Route path="/telemetry" element={<TelemetryIndex />} />

                {/* Circuits */}
                <Route path="/circuits" element={<CircuitsIndex />} />
                <Route path="/circuits/new" element={<CircuitForm />} />
                <Route path="/circuits/:id/edit" element={<CircuitForm />} />
                <Route path="/circuits/:id" element={<CircuitDetail />} />

                {/* Communication */}
                <Route path="/chat" element={<ChatIndex />} />
                <Route path="/chat/briefing/:eventId" element={<BriefingForm />} />
                <Route path="/chat/debrief/:eventId" element={<DebriefForm />} />

                {/* Statistics */}
                <Route path="/stats" element={<StatsIndex />} />

                {/* Goals */}
                <Route path="/goals" element={<GoalsIndex />} />

                {/* Exports */}
                <Route path="/exports" element={<ExportsIndex />} />

                {/* Admin */}
                <Route path="/admin/users" element={<AdminUsers />} />

                {/* 404 */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Suspense>
          </AppShell>
        </RequireAuth>
      } />
    </Routes>
  )
}
