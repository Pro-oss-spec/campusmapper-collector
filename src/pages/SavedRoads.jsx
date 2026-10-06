import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { deleteRoad, fetchRoads } from '../lib/roads'

function formatDistance(meters) {
  if (!meters || meters < 1) {
    return '0 m'
  }

  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`
  }

  return `${Math.round(meters)} m`
}

export default function SavedRoads() {
  const navigate = useNavigate()

  const [roads, setRoads] = useState(null)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)

  async function loadRoads() {
    setError('')

    try {
      const data = await fetchRoads()
      setRoads(data)
    } catch (err) {
      setError(err.message || 'Could not load saved roads')
    }
  }

  useEffect(() => {
    loadRoads()
  }, [])

  async function handleDelete(id) {
    const confirmed = window.confirm(
      'Delete this saved road? This cannot be undone.'
    )

    if (!confirmed) {
      return
    }

    setDeletingId(id)
    setError('')

    try {
      await deleteRoad(id)

      setRoads((current) =>
        (current || []).filter((road) => road.id !== id)
      )
    } catch (err) {
      setError(err.message || 'Could not delete road')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <>
      <Header
        title="Saved Roads"
        backTo="/"
        action={
          <Link to="/roads/new" className="header-link">
            + Road
          </Link>
        }
      />

      <main className="page">
        {error && (
          <div className="banner banner-error" role="alert">
            {error}

            <button
              type="button"
              className="link-btn"
              onClick={loadRoads}
            >
              Try again
            </button>
          </div>
        )}

        {!roads && !error && (
          <p className="muted">
            Loading saved roads...
          </p>
        )}

        {roads && (
          <>
            <p className="count">
              {roads.length}{' '}
              {roads.length === 1 ? 'road' : 'roads'} saved
            </p>

            {roads.length === 0 ? (
              <div className="empty">
                <h2>No roads saved yet</h2>

                <p>
                  Use Road Mapper to record your first campus road.
                </p>

                <Link
                  to="/roads/new"
                  className="btn btn-flag"
                >
                  🛣️ Record Road
                </Link>
              </div>
            ) : (
              <div className="card-list">
                {roads.map((road) => (
                  <article className="location-card" key={road.id}>
                    <div className="location-card-main">
                      <div>
                        <h2 className="location-card-title">
                          🛣️ {road.name}
                        </h2>

                        <p className="location-card-meta">
                          {road.road_type || 'Road'}
                          {' • '}
                          {formatDistance(road.distance_meters)}
                        </p>

                        {road.campus && (
                          <p className="location-card-meta">
                            📍 {road.campus.name}
                          </p>
                        )}

                        {road.description && (
                          <p className="location-card-description">
                            {road.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        marginTop: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() =>
                          navigate(
                            `/roads/new?edit=${road.id}`
                          )
                        }
                      >
                        View / Edit
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={deletingId === road.id}
                        onClick={() =>
                          handleDelete(road.id)
                        }
                      >
                        {deletingId === road.id
                          ? 'Deleting...'
                          : 'Delete'}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </>
  )
}