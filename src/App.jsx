import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppProvider } from './context/AppContext'

import Dashboard from './pages/Dashboard'
import NewLocation from './pages/NewLocation'
import Collection from './pages/Collection'
import LocationDetails from './pages/LocationDetails'
import RoadMapper from './pages/RoadMapper'
import SavedRoads from './pages/SavedRoads'
import CentralMap from './pages/CentralMap'
import Navigation from './pages/Navigation'

export default function App() {
  return (
    <HashRouter>
      <AppProvider>
        <Routes>
          {/* Home */}
          <Route
            path="/"
            element={<Dashboard />}
          />

          {/* Location collection */}
          <Route
            path="/new"
            element={<NewLocation />}
          />

          <Route
            path="/collection"
            element={<Collection />}
          />

          <Route
            path="/location/:id"
            element={<LocationDetails />}
          />

          {/* Road mapping */}
          <Route
            path="/road-mapper"
            element={<RoadMapper />}
          />

          <Route
            path="/saved-roads"
            element={<SavedRoads />}
          />

          {/* Central campus map */}
          <Route
            path="/map"
            element={<CentralMap />}
          />

          {/* Walking navigation */}
          <Route
            path="/navigation"
            element={<Navigation />}
          />

          {/* Unknown routes go home */}
          <Route
            path="*"
            element={<Navigate to="/" replace />}
          />
        </Routes>
      </AppProvider>
    </HashRouter>
  )
}