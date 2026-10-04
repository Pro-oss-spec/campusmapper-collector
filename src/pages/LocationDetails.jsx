import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import LocationForm from '../components/LocationForm'
import GPSCapture from '../components/GPSCapture'
import PhotoGrid from '../components/PhotoGrid'
import MapView from '../components/MapView'
import { useApp } from '../context/AppContext'
import { deletePlace, fetchPlace, updatePlace } from '../lib/places'
import { PHOTO_LABELS, formatAccuracy, formatCoord, formatDateTime, mapsUrl } from '../lib/location'

export default function LocationDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { campuses, categories } = useApp()

  const [place, setPlace] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState(null)
  const [gps, setGps] = useState(null)
  const [photos, setPhotos] = useState({})
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(null)
  const [editError, setEditError] = useState('')

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      setPlace(await fetchPlace(id))
      setError('')
    } catch (err) {
      setError(err.message || 'Could not load this location')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  const mapPlaces = useMemo(() => (place ? [place] : []), [place])

  function startEdit() {
    setValues({
      campusId: place.campus_id,
      name: place.name,
      category: place.category || '',
      description: place.description || '',
      fieldNotes: place.field_notes || '',
    })
    setGps({ latitude: place.latitude, longitude: place.longitude, accuracy: place.gps_accuracy })
    setPhotos(Object.fromEntries(place.photos.map((p) => [p.photo_type, { previewUrl: p.image_url }])))
    setEditError('')
    setEditing(true)
  }

  function cancelEdit() {
    Object.values(photos).forEach((slot) => {
      if (slot.previewUrl && slot.previewUrl.startsWith('blob:')) URL.revokeObjectURL(slot.previewUrl)
    })
    setEditing(false)
  }

  const patch = (changes) => setValues((v) => ({ ...v, ...changes }))

  const setPhoto = (type, slot) =>
    setPhotos((prev) => {
      const next = { ...prev }
      if (slot) next[type] = slot
      else delete next[type]
      return next
    })

  async function saveEdit() {
    setSaving(true)
    setEditError('')
    setProgress(null)
    try {
      await updatePlace(
        place,
        { ...values, latitude: gps.latitude, longitude: gps.longitude, gpsAccuracy: gps.accuracy },
        photos,
        (done, total) => setProgress({ done, total })
      )
      await load()
      setEditing(false)
    } catch (err) {
      setEditError(`Could not save changes. ${err.message || ''} Check your connection and try again.`)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setDeleting(true)
    try {
      await deletePlace(place)
      navigate('/collection', { replace: true })
    } catch (err) {
      setError(err.message || 'Could not delete this location')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Location" backTo="/collection" />
        <main className="page">
          <p className="muted">Loading...</p>
        </main>
      </>
    )
  }

  if (!place) {
    return (
      <>
        <Header title="Location" backTo="/collection" />
        <main className="page">
          <div className="banner banner-error">{error || 'This location was not found.'}</div>
        </main>
      </>
    )
  }

  // ---------- Edit mode ----------
  if (editing) {
    const canSave = values.name.trim() && values.category && gps
    return (
      <>
        <Header title="Edit location" backTo={cancelEdit} />
        <main className="page">
          <div className="step-body">
            <LocationForm values={values} onChange={patch} campuses={campuses} categories={categories} mode="all" lockCampus />

            <h2 className="section-title">GPS</h2>
            <GPSCapture value={gps} onChange={setGps} />

            <h2 className="section-title">Photos</h2>
            <PhotoGrid photos={photos} onChange={setPhoto} />

            {editError && (
              <div className="banner banner-error" role="alert">
                {editError}
              </div>
            )}
          </div>

          <div className="wizard-footer">
            <button type="button" className="btn btn-ghost" disabled={saving} onClick={cancelEdit}>
              Cancel
            </button>
            <button type="button" className="btn btn-flag btn-grow" disabled={!canSave || saving} onClick={saveEdit}>
              {saving
                ? progress
                  ? `Uploading photo ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`
                  : 'Saving...'
                : 'Save Changes'}
            </button>
          </div>
        </main>
      </>
    )
  }

  // ---------- View mode ----------
  const mapCenter = place.campus ? [place.campus.center_lat, place.campus.center_lng] : [place.latitude, place.longitude]

  return (
    <>
      <Header title={place.name} backTo="/collection" />
      <main className="page">
        {error && <div className="banner banner-error">{error}</div>}

        {place.photos.length > 0 ? (
          <div className="gallery" aria-label="Photos">
            {place.photos.map((p) => (
              <figure key={p.id}>
                <img src={p.image_url} alt={PHOTO_LABELS[p.photo_type]} loading="lazy" />
                <figcaption>{PHOTO_LABELS[p.photo_type]}</figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <div className="banner banner-note">No photos were saved for this location.</div>
        )}

        <dl className="facts">
          <div>
            <dt>Category</dt>
            <dd>{place.category || 'Uncategorised'}</dd>
          </div>
          <div>
            <dt>Campus</dt>
            <dd>{place.campus ? place.campus.name : ''}</dd>
          </div>
          <div>
            <dt>Coordinates</dt>
            <dd>
              {formatCoord(place.latitude)}, {formatCoord(place.longitude)}
            </dd>
          </div>
          <div>
            <dt>GPS accuracy</dt>
            <dd>{formatAccuracy(place.gps_accuracy)}</dd>
          </div>
          <div>
            <dt>Collected</dt>
            <dd>{formatDateTime(place.created_at)}</dd>
          </div>
          {place.updated_at !== place.created_at && (
            <div>
              <dt>Last edited</dt>
              <dd>{formatDateTime(place.updated_at)}</dd>
            </div>
          )}
        </dl>

        {place.description && (
          <section className="text-block">
            <h2 className="section-title">Description</h2>
            <p>{place.description}</p>
          </section>
        )}
        {place.field_notes && (
          <section className="text-block">
            <h2 className="section-title">Field notes</h2>
            <p>{place.field_notes}</p>
          </section>
        )}

        <MapView places={mapPlaces} center={mapCenter} height="240px" />

        <div className="stack">
          <button type="button" className="btn btn-primary btn-lg" onClick={startEdit}>
            Edit Location
          </button>
          <a className="btn btn-ghost" href={mapsUrl(place.latitude, place.longitude)} target="_blank" rel="noreferrer">
            Open in Google Maps
          </a>

          {!confirmDelete ? (
            <button type="button" className="btn btn-text-danger" onClick={() => setConfirmDelete(true)}>
              Delete Location
            </button>
          ) : (
            <div className="confirm" role="alertdialog" aria-label="Confirm delete">
              <p>
                Delete <strong>{place.name}</strong> and all of its photos? This cannot be undone.
              </p>
              <div className="confirm-actions">
                <button type="button" className="btn btn-ghost" disabled={deleting} onClick={() => setConfirmDelete(false)}>
                  Keep it
                </button>
                <button type="button" className="btn btn-danger" disabled={deleting} onClick={remove}>
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
