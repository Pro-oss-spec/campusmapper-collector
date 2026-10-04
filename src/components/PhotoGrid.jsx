import PhotoCapture from './PhotoCapture'
import { PHOTO_TYPES } from '../lib/location'

// photos: { front: {file, previewUrl}, ... }
// onChange(type, slotOrNull)
export default function PhotoGrid({ photos, onChange }) {
  const count = PHOTO_TYPES.filter((t) => photos[t.key]).length

  return (
    <div className="photo-grid">
      <p className="photo-count">
        {count} of {PHOTO_TYPES.length} photos added
      </p>
      {PHOTO_TYPES.map((type) => (
        <PhotoCapture key={type.key} type={type} value={photos[type.key] || null} onChange={(slot) => onChange(type.key, slot)} />
      ))}
    </div>
  )
}
