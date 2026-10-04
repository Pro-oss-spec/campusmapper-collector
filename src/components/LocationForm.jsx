// Text fields for a location.
// mode: "details" (campus, name, category, description),
//       "notes" (field notes only) or "all".
// onChange receives a partial object, for example { name: "Library" }.
export default function LocationForm({ values, onChange, campuses, categories, mode = 'all', lockCampus = false }) {
  const showDetails = mode !== 'notes'
  const showNotes = mode !== 'details'
  const campus = campuses.find((c) => c.id === values.campusId)

  return (
    <div className="form">
      {showDetails && (
        <>
          <div className="field">
            <label className="field-label" htmlFor="campus">
              Campus
            </label>
            {lockCampus ? (
              <div className="static-value">{campus ? campus.name : 'Unknown campus'}</div>
            ) : (
              <select id="campus" value={values.campusId} onChange={(e) => onChange({ campusId: e.target.value })}>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="place-name">
              Place name
            </label>
            <input
              id="place-name"
              type="text"
              value={values.name}
              placeholder="For example: Faculty of Law"
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="done"
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>

          <fieldset className="field">
            <legend className="field-label">Category</legend>
            <div className="chips">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className="chip"
                  aria-pressed={values.category === cat.name}
                  onClick={() => onChange({ category: cat.name })}
                >
                  <span aria-hidden="true">{cat.icon}</span> {cat.name}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="field">
            <label className="field-label" htmlFor="description">
              Description <span className="optional">optional</span>
            </label>
            <textarea
              id="description"
              rows={3}
              value={values.description}
              placeholder="What is this place used for?"
              onChange={(e) => onChange({ description: e.target.value })}
            />
          </div>
        </>
      )}

      {showNotes && (
        <div className="field">
          <label className="field-label" htmlFor="field-notes">
            Field notes <span className="optional">optional</span>
          </label>
          <textarea
            id="field-notes"
            rows={5}
            value={values.fieldNotes}
            placeholder="Opening hours, access routes, what you saw, anything the map should know."
            onChange={(e) => onChange({ fieldNotes: e.target.value })}
          />
        </div>
      )}
    </div>
  )
}
