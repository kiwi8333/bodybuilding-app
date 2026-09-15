import { useEffect } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { useStore } from './store/StoreContext.jsx'
import { FoodIcon, PlanIcon, ProgressIcon, SettingsIcon, TodayIcon } from './components/icons.jsx'
import Onboarding from './pages/Onboarding.jsx'
import Today from './pages/Today.jsx'
import Workout from './pages/Workout.jsx'
import WorkoutSummary from './pages/WorkoutSummary.jsx'
import Cardio from './pages/Cardio.jsx'
import Plan from './pages/Plan.jsx'
import Progress from './pages/Progress.jsx'
import Settings from './pages/Settings.jsx'
import Food from './pages/Food.jsx'
import Mobility from './pages/Mobility.jsx'
import { syncPush } from './reminders/client.js'

const NAV = [
  { to: '/', label: 'Today', Icon: TodayIcon, end: true },
  { to: '/plan', label: 'Plan', Icon: PlanIcon },
  { to: '/food', label: 'Food', Icon: FoodIcon },
  { to: '/progress', label: 'Progress', Icon: ProgressIcon },
  { to: '/settings', label: 'Settings', Icon: SettingsIcon },
]

export default function App() {
  const { state, loadError, readOnly, saveError, dismissLoadError } = useStore()
  const flash = useLocation().state?.flash

  // Keep reminder data current (next workout, last session, backups). Debounced,
  // and syncPush itself only talks to the server when something changed.
  useEffect(() => {
    if (!state.reminders.enabled) return undefined
    const t = setTimeout(() => {
      syncPush(state).catch(() => {})
    }, 3000)
    return () => clearTimeout(t)
  }, [state])

  const banners = (
    <>
      {loadError && (
        <div className="banner bad" role="alert">
          <span>{loadError}</span>
          {!readOnly && (
            <button className="link-btn" onClick={dismissLoadError}>
              Dismiss
            </button>
          )}
        </div>
      )}
      {typeof flash === 'string' && (
        <div className="banner good" role="status">
          {flash}
        </div>
      )}
      {saveError && (
        <div className="banner bad" role="alert">
          {saveError}
        </div>
      )}
    </>
  )

  if (!state.profile.onboarded) {
    return (
      <div className="app page">
        {banners}
        <Routes>
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Onboarding />} />
        </Routes>
      </div>
    )
  }

  return (
    <>
      <main className="app page">
        {banners}
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/summary/:id" element={<WorkoutSummary />} />
          <Route path="/cardio/:kind" element={<Cardio />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/food" element={<Food />} />
          <Route path="/mobility" element={<Mobility />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="nav" aria-label="Main">
        <div className="nav-inner">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <Icon />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  )
}
