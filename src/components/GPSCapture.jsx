import { useEffect, useRef, useState } from 'react'
import {
  accuracyLevel,
  formatAccuracy,
  formatCoord,
  gpsErrorMessage,
  startGpsCapture,
  GOOD_ACCURACY_M,
  FAIR_ACCURACY_M,
} from '../lib/location'

const LEVEL_TEXT = {
  good: 'Good fix',
  fair: 'Fair fix',
  poor: 'Weak fix',
  unknown: 'No reading',
}

// value: { latitude, longitude, accuracy } or null
export default function GPSCapture({ value, onChange }) {
  const [capturing, setCapturing] = useState(false)
  const [live, setLive] = useState(null)
  const [error, setError] = useState('')
  const sessionRef = useRef(null)

  // Stop watching the GPS if the person leaves this screen mid-capture
  useEffect(() => () => sessionRef.current?.cancel(), [])

  async function capture() {
    setError('')
    setLive(null)
    setCapturing(true)
    const session = startGpsCapture({ onProgress: setLive })
    sessionRef.current = session
    try {
      const reading = await session.promise
      onChange(reading)
    } catch (err) {
      if (err.code !== 'CANCELLED') setError(gpsErrorMessage(err.code))
    } finally {
      setCapturing(false)
      setLive(null)
      sessionRef.current = null
    }
  }

  const shown = capturing ? live : value
  const level = shown ? accuracyLevel(shown.accuracy) : 'unknown'

  return (
    <div className="gps">
      <div className={`gps-card ${capturing ? 'is-capturing' : ''}`}>
        <div className="gps-top">
          <span className={`gps-badge level-${level}`}>
            <span className="gps-dot" aria-hidden="true" />
            {capturing ? 'Reading GPS' : LEVEL_TEXT[level]}
          </span>
          {shown && <span className="gps-accuracy">{formatAccuracy(shown.accuracy)}</span>}
        </div>

        <dl className="gps-readout">
          <div>
            <dt>Latitude</dt>
            <dd>{shown ? formatCoord(shown.latitude) : '--'}</dd>
          </div>
          <div>
            <dt>Longitude</dt>
            <dd>{shown ? formatCoord(shown.longitude) : '--'}</dd>
          </div>
          <div>
            <dt>Accuracy</dt>
            <dd>{shown ? formatAccuracy(shown.accuracy) : '--'}</dd>
          </div>
        </dl>

        {capturing && (
          <p className="gps-note">
            {live
              ? 'Holding still improves accuracy. Tap Use this reading when you are happy with it.'
              : 'Waiting for the first fix. If your phone asks for permission, tap Allow.'}
          </p>
        )}
      </div>

      {error && (
        <div className="banner banner-error" role="alert">
          {error}
        </div>
      )}

      {!capturing && value && level === 'poor' && (
        <div className="banner banner-warn" role="alert">
          Accuracy is weak ({formatAccuracy(value.accuracy)}). Move to open sky, away from tall buildings and
          trees, then recapture. A reading better than {FAIR_ACCURACY_M} m is best for mapping.
        </div>
      )}
      {!capturing && value && level === 'fair' && (
        <div className="banner banner-note">
          Fair accuracy. For a sharper fix, try again in the open. Under {GOOD_ACCURACY_M} m is ideal.
        </div>
      )}

      <div className="stack">
        {capturing ? (
          <>
            {live && (
              <button type="button" className="btn btn-primary btn-lg" onClick={() => sessionRef.current?.finishNow()}>
                Use this reading
              </button>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => sessionRef.current?.cancel()}>
              Cancel
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-flag btn-lg" onClick={capture}>
            {value ? 'Recapture GPS' : 'Capture GPS'}
          </button>
        )}
      </div>
    </div>
  )
}
