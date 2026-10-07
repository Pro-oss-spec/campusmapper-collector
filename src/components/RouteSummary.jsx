import {
  formatDistance,
  formatWalkingTime,
} from '../lib/navigation'

export default function RouteSummary({
  route,
  destinationName,
  onStart,
  loading = false,
  error = '',
}) {
  if (loading) {
    return (
      <section className="panel">
        <h2 className="section-title">
          Calculating route
        </h2>

        <p className="muted">
          Finding the best walking route
          through the mapped campus roads...
        </p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="panel">
        <h2 className="section-title">
          Route unavailable
        </h2>

        <div
          className="banner banner-error"
          role="alert"
        >
          {error}
        </div>
      </section>
    )
  }

  if (!route) {
    return null
  }

  return (
    <section className="panel">
      <p className="muted">
        Walking to
      </p>

      <h2 className="section-title">
        {destinationName ||
          'Selected destination'}
      </h2>

      <div className="road-stats">
        <div className="road-stat">
          <strong>
            {formatDistance(
              route.distanceMeters
            )}
          </strong>

          <span>Distance</span>
        </div>

        <div className="road-stat">
          <strong>
            {formatWalkingTime(
              route.walkingTimeMinutes
            )}
          </strong>

          <span>Walking time</span>
        </div>
      </div>

      <p className="muted">
        Route connects to the CampusMapper
        mapped road network.
      </p>

      <button
        type="button"
        className="btn btn-flag btn-lg"
        onClick={onStart}
      >
        {loading
          ? 'Starting...'
          : 'Start Navigation'}
      </button>
    </section>
  )
}