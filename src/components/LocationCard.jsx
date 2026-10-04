import { Link } from 'react-router-dom'
import { formatAccuracy, formatCoord, formatDate } from '../lib/location'

export default function LocationCard({ place, categoryIcon }) {
  return (
    <Link to={`/location/${place.id}`} className="loc-card">
      {place.cover_image ? (
        <img className="loc-thumb" src={place.cover_image} alt="" loading="lazy" />
      ) : (
        <div className="loc-thumb loc-thumb-empty" aria-hidden="true">
          No photo
        </div>
      )}
      <div className="loc-body">
        <h3>{place.name}</h3>
        <p className="loc-meta">
          {categoryIcon ? <span aria-hidden="true">{categoryIcon} </span> : null}
          {place.category || 'Uncategorised'}
        </p>
        <p className="loc-meta">{place.campus ? place.campus.name : ''}</p>
        <p className="loc-coords">
          {formatCoord(place.latitude)}, {formatCoord(place.longitude)} ({formatAccuracy(place.gps_accuracy)})
        </p>
        <p className="loc-date">Collected {formatDate(place.created_at)}</p>
      </div>
    </Link>
  )
}
