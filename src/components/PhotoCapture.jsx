import { useRef } from 'react'

function isBlob(url) {
  return typeof url === 'string' && url.startsWith('blob:')
}

// One photo slot.
// value: { file?, previewUrl } or null
// capture="environment" opens the rear camera on phones.
// The second input has no capture attribute, so it opens the gallery.
export default function PhotoCapture({ type, value, onChange }) {
  const cameraRef = useRef(null)
  const galleryRef = useRef(null)

  function handleFile(event) {
    const file = event.target.files && event.target.files[0]
    event.target.value = ''
    if (!file) return
    if (value && isBlob(value.previewUrl)) URL.revokeObjectURL(value.previewUrl)
    onChange({ file, previewUrl: URL.createObjectURL(file) })
  }

  function remove() {
    if (value && isBlob(value.previewUrl)) URL.revokeObjectURL(value.previewUrl)
    onChange(null)
  }

  return (
    <section className={`slot ${value ? 'slot-filled' : ''}`} aria-label={type.label}>
      <div className="slot-head">
        <h3>{type.label}</h3>
        {value && <span className="slot-tag">Added</span>}
      </div>

      {value ? (
        <img className="slot-img" src={value.previewUrl} alt={`${type.label} preview`} />
      ) : (
        <div className="slot-empty">
          <p>{type.hint}</p>
        </div>
      )}

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={handleFile} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={handleFile} />

      <div className="slot-actions">
        <button type="button" className="btn btn-flag" onClick={() => cameraRef.current.click()}>
          {value ? 'Retake' : 'Take Photo'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => galleryRef.current.click()}>
          Select Photo
        </button>
        {value && (
          <button type="button" className="btn btn-text-danger" onClick={remove}>
            Remove
          </button>
        )}
      </div>
    </section>
  )
}
