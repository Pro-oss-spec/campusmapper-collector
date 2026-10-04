import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import LocationCard from '../components/LocationCard'
import MapView from '../components/MapView'
import { useApp } from '../context/AppContext'
import { fetchPlaces } from '../lib/places'

export default function Collection() {
  const { campuses, categories, currentCampus } = useApp()
  const navigate = useNavigate()

  const [places, setPlaces] = useState(null)
  const [error, setError] = useState('')
  const [view, setView] = useState('list')
  const [campusFilter, setCampusFilter] = useState('all')
  const [query, setQuery] = useState('')

  async function load() {
    setError('')
    try {
      setPlaces(await fetchPlaces())
    } catch (err) {
      setError(err.message || 'Could not load locations')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const iconFor = useMemo(() => Object.fromEntries(categories.map((c) => [c.name, c.icon])), [categories])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (places || []).filter((p) => {
      if (campusFilter !== 'all' && p.campus_id !== campusFilter) return false
      if (q && !p.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [places, campusFilter, query])

  const mapCampus = campuses.find((c) => c.id === campusFilter) || currentCampus
  const mapCenter = [mapCampus.center_lat, mapCampus.center_lng]

  return (
    <>
      <Header
        title="Collection"
        backTo="/"
        action={
          <Link to="/new" className="header-link">
            Add
          </Link>
        }
      />
      <main className="page">
        <div className="toolbar">
          <input
            type="search"
            value={query}
            placeholder="Search by name"
            aria-label="Search by name"
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={campusFilter} aria-label="Filter by campus" onChange={(e) => setCampusFilter(e.target.value)}>
            <option value="all">All campuses</option>
            {campuses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="segmented" role="group" aria-label="View">
          <button type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}>
            List
          </button>
          <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
            Map
          </button>
        </div>

        {error && (
          <div className="banner banner-error" role="alert">
            {error} <button className="link-btn" onClick={load}>Try again</button>
          </div>
        )}

        {!places && !error && <p className="muted">Loading locations...</p>}

        {places && (
          <>
            <p className="count">
              {filtered.length} {filtered.length === 1 ? 'location' : 'locations'}
            </p>

            {view === 'list' &&
              (filtered.length ? (
                <div className="card-list">
                  {filtered.map((p) => (
                    <LocationCard key={p.id} place={p} categoryIcon={iconFor[p.category]} />
                  ))}
                </div>
              ) : (
                <div className="empty">
                  <h2>{places.length ? 'No matches' : 'Nothing collected yet'}</h2>
                  <p>{places.length ? 'Try a different search or campus.' : 'Walk to a building and add your first location.'}</p>
                  {!places.length && (
                    <Link to="/new" className="btn btn-flag">
                      Add Location
                    </Link>
                  )}
                </div>
              ))}

            {view === 'map' && (
              <MapView places={filtered} center={mapCenter} height="65vh" onSelect={(p) => navigate(`/location/${p.id}`)} />
            )}
          </>
        )}
      </main>
    </>
  )
}
