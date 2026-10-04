import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import LocationForm from '../components/LocationForm'
import GPSCapture from '../components/GPSCapture'
import PhotoGrid from '../components/PhotoGrid'
import { useApp } from '../context/AppContext'
import { createPlace } from '../lib/places'
import { PHOTO_TYPES, accuracyLevel, formatAccuracy, formatCoord } from '../lib/location'

const STEPS = ['Details', 'GPS', 'Photos', 'Notes', 'Review']

export default function NewLocation() {
  const { campuses, categories, currentCampus } = useApp()

  const emptyValues = () => ({
    campusId: currentCampus.id,
    name: '',
    category: '',
    description: '',
    fieldNotes: '',
  })

  const [step, setStep] = useState(0)
  const [values, setValues] = useState(emptyValues)
  const [gps, setGps] = useState(null)
  const [photos, setPhotos] = useState({})
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(null)

  const hasData = Boolean(values.name || gps || Object.keys(photos).length)

  // Warn before the tab closes with unsaved work
  useEffect(() => {
    if (!hasData || saved) return undefined
    const warn = (e) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasData, saved])

  const patch = (changes) => setValues((v) => ({ ...v, ...changes }))

  const setPhoto = (type, slot) =>
    setPhotos((prev) => {
      const next = { ...prev }
      if (slot) next[type] = slot
      else delete next[type]
      return next
    })

  function canContinue() {
    if (step === 0) return Boolean(values.name.trim() && values.category && values.campusId)
    if (step === 1) return Boolean(gps)
    return true
  }

  async function save() {
    setSaving(true)
    setError('')
    setProgress(null)
    try {
      const id = await createPlace(
        { ...values, latitude: gps.latitude, longitude: gps.longitude, gpsAccuracy: gps.accuracy },
        photos,
        (done, total) => setProgress({ done, total })
      )
      setSaved({ id, name: values.name.trim() })
    } catch (err) {
      setError(
        `Could not save. ${err.message || ''} Check your connection and tap Save Location again. Everything you entered is still here.`
      )
    } finally {
      setSaving(false)
    }
  }

  function startAnother() {
    setValues(emptyValues())
    setGps(null)
    setPhotos({})
    setStep(0)
    setSaved(null)
    setError('')
  }

  if (saved) {
    return (
      <>
        <Header title="Location saved" />
        <main className="page">
          <div className="success">
            <h2>{saved.name} is saved</h2>
            <p>The photos and coordinates are now in your collection and on the map.</p>
          </div>
          <div className="stack">
            <button type="button" className="btn btn-flag btn-lg" onClick={startAnother}>
              Add another location
            </button>
            <Link to="/collection" className="btn btn-primary btn-lg">
              View Collection
            </Link>
            <Link to={`/location/${saved.id}`} className="btn btn-ghost">
              Open this record
            </Link>
          </div>
        </main>
      </>
    )
  }

  const photoCount = PHOTO_TYPES.filter((t) => photos[t.key]).length
  const campus = campuses.find((c) => c.id === values.campusId)
  const gpsLevel = gps ? accuracyLevel(gps.accuracy) : 'unknown'

  return (
    <>
      <Header title="New location" backTo="/" />
      <main className="page">
        <nav className="steps" aria-label="Progress">
          <p className="steps-label">
            Step {step + 1} of {STEPS.length}: {STEPS[step]}
          </p>
          <ol className="steps-bar">
            {STEPS.map((name, i) => (
              <li key={name} className={i < step ? 'done' : i === step ? 'current' : ''} aria-current={i === step ? 'step' : undefined}>
                <span className="sr-only">{name}</span>
              </li>
            ))}
          </ol>
        </nav>

        <div className="step-body">
          {step === 0 && (
            <>
              <h2 className="step-title">Which place are you standing at?</h2>
              <LocationForm values={values} onChange={patch} campuses={campuses} categories={categories} mode="details" />
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="step-title">Capture the coordinates</h2>
              <p className="step-help">Stand at the main entrance or the centre of the building, outdoors if you can.</p>
              <GPSCapture value={gps} onChange={setGps} />
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="step-title">Take the photos</h2>
              <p className="step-help">Add as many as you can. Take Photo opens your camera. Select Photo uses your gallery.</p>
              <PhotoGrid photos={photos} onChange={setPhoto} />
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="step-title">Anything to note?</h2>
              <LocationForm values={values} onChange={patch} campuses={campuses} categories={categories} mode="notes" />
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="step-title">Check before saving</h2>

              {(!gps || gpsLevel === 'poor') && (
                <div className="banner banner-warn">
                  {gps ? `GPS accuracy is weak (${formatAccuracy(gps.accuracy)}). You can go back and recapture.` : 'No GPS reading yet.'}
                </div>
              )}
              {photoCount === 0 && <div className="banner banner-note">No photos added. You can still save, or go back and add some.</div>}

              <dl className="review">
                <div className="review-row">
                  <dt>Place</dt>
                  <dd>
                    <strong>{values.name}</strong>
                    <br />
                    {values.category} at {campus ? campus.name : ''}
                    {values.description && (
                      <>
                        <br />
                        <span className="muted">{values.description}</span>
                      </>
                    )}
                  </dd>
                  <button type="button" className="link-btn" onClick={() => setStep(0)}>
                    Change
                  </button>
                </div>

                <div className="review-row">
                  <dt>GPS</dt>
                  <dd>
                    {gps ? (
                      <>
                        {formatCoord(gps.latitude)}, {formatCoord(gps.longitude)}
                        <br />
                        <span className="muted">Accuracy {formatAccuracy(gps.accuracy)}</span>
                      </>
                    ) : (
                      <span className="muted">Not captured</span>
                    )}
                  </dd>
                  <button type="button" className="link-btn" onClick={() => setStep(1)}>
                    Change
                  </button>
                </div>

                <div className="review-row review-photos">
                  <dt>Photos ({photoCount})</dt>
                  <dd>
                    {photoCount ? (
                      <div className="thumb-row">
                        {PHOTO_TYPES.filter((t) => photos[t.key]).map((t) => (
                          <figure key={t.key}>
                            <img src={photos[t.key].previewUrl} alt={t.label} />
                            <figcaption>{t.label}</figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : (
                      <span className="muted">None</span>
                    )}
                  </dd>
                  <button type="button" className="link-btn" onClick={() => setStep(2)}>
                    Change
                  </button>
                </div>

                <div className="review-row">
                  <dt>Notes</dt>
                  <dd>{values.fieldNotes ? values.fieldNotes : <span className="muted">None</span>}</dd>
                  <button type="button" className="link-btn" onClick={() => setStep(3)}>
                    Change
                  </button>
                </div>
              </dl>

              {error && (
                <div className="banner banner-error" role="alert">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        <div className="wizard-footer">
          {step > 0 && (
            <button type="button" className="btn btn-ghost" disabled={saving} onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn btn-primary btn-grow" disabled={!canContinue()} onClick={() => setStep(step + 1)}>
              Next
            </button>
          ) : (
            <button type="button" className="btn btn-flag btn-grow" disabled={saving || !gps || !values.name.trim()} onClick={save}>
              {saving
                ? progress
                  ? `Uploading photo ${Math.min(progress.done + 1, progress.total)} of ${progress.total}`
                  : 'Saving...'
                : 'Save Location'}
            </button>
          )}
        </div>
      </main>
    </>
  )
}
