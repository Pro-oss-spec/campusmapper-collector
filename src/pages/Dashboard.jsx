import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useApp } from '../context/AppContext'
import { fetchPlaceStats, fetchPlaces } from '../lib/places'

function MapIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
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

function CampusIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 10l9-6 9 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 10v9h14v-9M9 19v-5h6v5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="11"
        cy="11"
        r="6.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M16 16l5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

function getSearchScore(place, query) {
  const name = normalizeSearchText(place.name)
  const category = normalizeSearchText(place.category)
  const description = normalizeSearchText(place.description)
  const fieldNotes = normalizeSearchText(place.field_notes)

  let score = 0

  if (name === query) score += 100
  if (name.startsWith(query)) score += 60
  if (name.includes(query)) score += 40
  if (category.includes(query)) score += 25
  if (description.includes(query)) score += 10
  if (fieldNotes.includes(query)) score += 5

  return score
}

export default function Dashboard() {
  const {
    campuses,
    currentCampus,
    setCampusId,
  } = useApp()

  const navigate = useNavigate()

  const [stats, setStats] = useState(null)
  const [places, setPlaces] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [placesLoading, setPlacesLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false

    async function loadDashboardData() {
      setPlacesLoading(true)
      setError('')

      try {
        const [statsData, placesData] = await Promise.all([
          fetchPlaceStats(),
          fetchPlaces(),
        ])

        if (cancelled) return

        setStats(statsData)
        setPlaces(placesData)
      } catch (err) {
        if (cancelled) return

        setError(
          err.message ||
            'Could not load CampusMapper data'
        )
      } finally {
        if (!cancelled) {
          setPlacesLoading(false)
        }
      }
    }

    loadDashboardData()

    return () => {
      cancelled = true
    }
  }, [currentCampus?.id])

  const campusPlaces = useMemo(() => {
    if (!currentCampus?.id) return []

    return places.filter(
      (place) =>
        place.campus_id === currentCampus.id
    )
  }, [places, currentCampus?.id])

  const searchResults = useMemo(() => {
    const query = normalizeSearchText(searchQuery)

    if (!query) return []

    return campusPlaces
      .map((place) => ({
        place,
        score: getSearchScore(place, query),
      }))
      .filter((item) => item.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          String(a.place.name).localeCompare(
            String(b.place.name)
          )
      )
      .slice(0, 8)
      .map((item) => item.place)
  }, [searchQuery, campusPlaces])

  function selectSearchResult(place) {
    setSearchQuery('')

    navigate(
      `/map?place=${encodeURIComponent(place.id)}`
    )
  }

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

        {/* Search */}
        <section
          className="campus-search"
          aria-label="Search campus locations"
        >
          <div className="campus-search-heading">
            <div>
              <span className="eyebrow">
                FIND A PLACE
              </span>

              <h2>
                Search campus
              </h2>
            </div>
          </div>

          <div className="campus-search-box">
            <span className="campus-search-icon">
              <SearchIcon />
            </span>

            <input
              type="search"
              value={searchQuery}
              onChange={(e) =>
                setSearchQuery(e.target.value)
              }
              placeholder={
                currentCampus
                  ? `Search ${currentCampus.name}...`
                  : 'Search campus locations...'
              }
              aria-label="Search campus locations"
              autoComplete="off"
            />

            {searchQuery && (
              <button
                type="button"
                className="campus-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <CloseIcon />
              </button>
            )}
          </div>

          {searchQuery && (
            <div className="campus-search-results">
              {placesLoading ? (
                <div className="campus-search-empty">
                  Loading locations...
                </div>
              ) : searchResults.length > 0 ? (
                searchResults.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    className="campus-search-result"
                    onClick={() =>
                      selectSearchResult(place)
                    }
                  >
                    <span className="campus-search-result-icon">
                      <PinIcon />
                    </span>

                    <span className="campus-search-result-text">
                      <strong>
                        {place.name}
                      </strong>

                      <small>
                        {place.category ||
                          'Campus location'}
                      </small>
                    </span>

                    <span className="campus-search-result-arrow">
                      →
                    </span>
                  </button>
                ))
              ) : (
                <div className="campus-search-empty">
                  No location found for “{searchQuery}”
                </div>
              )}
            </div>
          )}
        </section>

        {/* Campus selector */}
        <section className="campus-selector">
          <div className="campus-selector-info">
            <span className="selector-label">
              CURRENTLY MAPPING
            </span>

            <div className="campus-name-row">
              <span className="campus-selector-icon">
                <CampusIcon />
              </span>

              <strong>
                {currentCampus?.name ||
                  'Select campus'}
              </strong>
            </div>

            <small>
              All new locations and roads will be
              saved to this campus.
            </small>
          </div>

          <select
            value={currentCampus?.id || ''}
            onChange={(e) =>
              setCampusId(e.target.value)
            }
            aria-label="Select campus to map"
          >
            <option value="" disabled>
              Select campus
            </option>

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

        {/* Central map */}
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
                CENTRAL CAMPUS MAP
              </span>

              <h2>
                Explore Campus
              </h2>

              <p>
                View buildings, locations and
                mapped roads for{' '}
                {currentCampus?.name ||
                  'this campus'}.
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

        {/* Latest location */}
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