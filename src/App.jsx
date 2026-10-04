import { HashRouter, Route, Routes } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import { isConfigured } from './lib/supabase'

import Dashboard from './pages/Dashboard'
import NewLocation from './pages/NewLocation'
import Collection from './pages/Collection'
import LocationDetails from './pages/LocationDetails'
import RoadMapper from './pages/RoadMapper'

function SetupNotice() {
  return (
    <main className="center-screen">
      <h1>Connect Supabase</h1>

      <p>
        The app cannot find your Supabase keys. Create a file named{' '}
        <code>.env</code> in the project root (next to{' '}
        <code>package.json</code>) and add:
      </p>

      <pre className="code-block">
        {'VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...'}
      </pre>

      <p>
        Then stop the dev server and start it again with{' '}
        <code>npm run dev</code>.
      </p>
    </main>
  )
}

function Gate() {
  const { loading, error, campuses, reload } = useApp()

  if (loading) {
    return (
      <main className="center-screen">
        <p>Loading campuses...</p>
      </main>
    )
  }

  if (error) {
    return (
      <main className="center-screen">
        <h1>Could not reach the database</h1>

        <p>{error}</p>

        <p>
          Check your keys in <code>.env</code> and that you ran{' '}
          <code>supabase/schema.sql</code>.
        </p>

        <button
          className="btn btn-primary"
          onClick={reload}
        >
          Try again
        </button>
      </main>
    )
  }

  if (campuses.length === 0) {
    return (
      <main className="center-screen">
        <h1>No campus yet</h1>

        <p>
          Add a row to the <code>campuses</code> table in Supabase,
          then reload.
        </p>

        <button
          className="btn btn-primary"
          onClick={reload}
        >
          Reload
        </button>
      </main>
    )
  }

  return (
    <Routes>
      <Route
        path="/"
        element={<Dashboard />}
      />

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

      <Route
        path="/roads/new"
        element={<RoadMapper />}
      />

      <Route
        path="*"
        element={<Dashboard />}
      />
    </Routes>
  )
}

export default function App() {
  if (!isConfigured) {
    return <SetupNotice />
  }

  return (
    <AppProvider>
      <HashRouter>
        <div className="app">
          <Gate />
        </div>
      </HashRouter>
    </AppProvider>
  )
}