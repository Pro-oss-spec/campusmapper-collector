
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import { useApp } from '../context/AppContext'
import { fetchPlaceStats } from '../lib/places'

export default function Dashboard() {
  const { campuses, currentCampus, setCampusId } = useApp()
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPlaceStats()
      .then(setStats)
      .catch((err) => {
        setError(err.message || 'Could not load your totals')
      })
  }, [])

  return (
    <>
      <Header title="CampusMapper Collector" />

      <main className="page">
        <section className="stats" aria-label="Collection totals">
          <div className="stat">
            <span className="stat-num">
              {stats ? stats.total : '-'}
            </span>
            <span className="stat-label">
              Locations collected
            </span>
          </div>

          <div className="stat">
            <span className="stat-num">
              {stats ? stats.today : '-'}
            </span>
            <span className="stat-label">
              Collected today
            </span>
          </div>
        </section>

        {error && (
          <div className="banner banner-error">
            {error}
          </div>
        )}

        <section className="panel">
          <label
            className="field-label"
            htmlFor="current-campus"
          >
            Current campus
          </label>

          <select
            id="current-campus"
            value={currentCampus.id}
            onChange={(e) => setCampusId(e.target.value)}
          >
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </section>

        <div className="stack">
          <Link
            to="/new"
            className="btn btn-flag btn-lg"
          >
            📍 Add Location
          </Link>

          <Link
            to="/collection"
            className="btn btn-primary btn-lg"
          >
            🗺️ View Collection
          </Link>

          <Link
            to="/roads/new"
            className="btn btn-primary btn-lg"
          >
            🛣️ Road Mapper
          </Link>
        </div>

        {stats && stats.latest && (
          <p className="last-saved">
            Last saved:{' '}
            <Link to={'/location/' + stats.latest.id}>
              {stats.latest.name}
            </Link>
          </p>
        )}
      </main>
    </>
  )
}

