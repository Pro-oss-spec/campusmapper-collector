import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import { useApp } from '../context/AppContext'
import { fetchPlaceStats } from '../lib/places'

function MapIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3-6-3z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 3v15M15 6v15"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function PinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1116 0z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="10"
        r="2.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function RoadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 21l4-18m4 18l-4-18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 6v3m0 6v3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function BuildingIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 21V6l8-3 8 3v15"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M8 9h1m6 0h1M8 13h1m6 0h1M8 17h1m6 0h1M12 21v-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function Dashboard() {
  const {
    campuses,
    currentCampus,
    setCampusId,
  } = useApp()

  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPlaceStats()
      .then(setStats)
      .catch((err) => {
        setError(
          err.message ||
            'Could not load collection totals'
        )
      })
  }, [])

  return (
    <>
      <Header title="CampusMapper" />

      <main className="dashboard-page">

        {/* Welcome */}
        <section className="dashboard-welcome">
          <div>
            <p className="eyebrow">
              CAMPUS FIELDWORK
            </p>

            <h2>
              Explore your campus.
            </h2>

            <p>
              Capture locations, map roads and build
              a complete digital campus map.
            </p>
          </div>
        </section>

        {/* Campus selector */}
        <section className="campus-selector">
          <div>
            <span className="selector-label">
              CURRENT CAMPUS
            </span>

            <strong>
              {currentCampus?.name ||
                'Select campus'}
            </strong>
          </div>

          <select
            value={currentCampus?.id || ''}
            onChange={(e) =>
              setCampusId(e.target.value)
            }
            aria-label="Select campus"
          >
            {campuses.map((campus) => (
              <option
                key={campus.id}
                value={campus.id}
              >
                {campus.name}
              </option>
            ))}
          </select>
        </section>

        {/* Stats */}
        <section
          className="dashboard-stats"
          aria-label="Collection statistics"
        >
          <div className="dashboard-stat">
            <span className="dashboard-stat-icon">
              <BuildingIcon />
            </span>

            <div>
              <strong>
                {stats ? stats.total : '—'}
              </strong>

              <span>
                Locations
              </span>
            </div>
          </div>

          <div className="dashboard-stat">
            <span className="dashboard-stat-icon">
              <PinIcon />
            </span>

            <div>
              <strong>
                {stats ? stats.today : '—'}
              </strong>

              <span>
                Added today
              </span>
            </div>
          </div>
        </section>

        {error && (
          <div
            className="banner banner-error"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Main map action */}
        <Link
          to="/map"
          className="map-hero"
        >
          <div className="map-hero-content">
            <span className="map-hero-icon">
              <MapIcon />
            </span>

            <div>
              <span className="map-hero-label">
                CAMPUS MAP
              </span>

              <h2>
                Explore Campus
              </h2>

              <p>
                View buildings, locations and
                mapped roads in one place.
              </p>
            </div>
          </div>

          <span className="map-hero-arrow">
            →
          </span>
        </Link>

        {/* Quick actions */}
        <section>
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                QUICK ACTIONS
              </span>

              <h2>
                Continue fieldwork
              </h2>
            </div>
          </div>

          <div className="quick-actions">

            <Link
              to="/new"
              className="quick-action quick-action-primary"
            >
              <span className="quick-action-icon">
                <PinIcon />
              </span>

              <span>
                <strong>
                  Add Location
                </strong>

                <small>
                  Capture a building or place
                </small>
              </span>

              <span className="quick-arrow">
                →
              </span>
            </Link>

            <Link
              to="/roads/new"
              className="quick-action"
            >
              <span className="quick-action-icon">
                <RoadIcon />
              </span>

              <span>
                <strong>
                  Map a Road
                </strong>

                <small>
                  Record a campus road with GPS
                </small>
              </span>

              <span className="quick-arrow">
                →
              </span>
            </Link>

          </div>
        </section>

        {/* Collection */}
        <section className="dashboard-section">

          <div className="section-heading">
            <div>
              <span className="eyebrow">
                YOUR DATA
              </span>

              <h2>
                Collection
              </h2>
            </div>

            <Link
              to="/collection"
              className="section-link"
            >
              View all
            </Link>
          </div>

          <div className="collection-links">

            <Link
              to="/collection"
              className="collection-link"
            >
              <span className="collection-link-icon">
                <BuildingIcon />
              </span>

              <span>
                <strong>
                  Saved locations
                </strong>

                <small>
                  Browse buildings and places
                </small>
              </span>

              <span>
                →
              </span>
            </Link>

            <Link
              to="/roads"
              className="collection-link"
            >
              <span className="collection-link-icon">
                <RoadIcon />
              </span>

              <span>
                <strong>
                  Saved roads
                </strong>

                <small>
                  View mapped campus roads
                </small>
              </span>

              <span>
                →
              </span>
            </Link>

          </div>
        </section>

        {/* Latest */}
        {stats?.latest && (
          <section className="latest-card">

            <span className="eyebrow">
              LAST ADDED
            </span>

            <Link
              to={`/location/${stats.latest.id}`}
            >
              <strong>
                {stats.latest.name}
              </strong>

              <span>
                Open location →
              </span>
            </Link>

          </section>
        )}

      </main>
    </>
  )
}