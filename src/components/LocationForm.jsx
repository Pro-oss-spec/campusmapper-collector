import { useMemo } from 'react'

import {
  UNIUYO_ACADEMICS,
  UNIUYO_LOCATION_SUGGESTIONS,
} from '../lib/uniuyoAcademics'

const CATEGORY_RULES = {
  'Faculty / Academic Building': {
    academic: true,
    suggestions: UNIUYO_LOCATION_SUGGESTIONS,
  },

  Department: {
    academic: true,
    suggestions: Object.values(UNIUYO_ACADEMICS).flat(),
  },

  Laboratory: {
    suggestions: [
      'Central Laboratory',
      'Science Laboratory',
      'Computer Laboratory',
      'Physics Laboratory',
      'Chemistry Laboratory',
      'Biology Laboratory',
      'Engineering Laboratory',
    ],
  },

  'Lecture Hall': {
    suggestions: [
      'Lecture Theatre 1',
      'Lecture Theatre 2',
      'Lecture Theatre 3',
      'Lecture Theatre 4',
      'Lecture Theatre 5',
      'Large Lecture Theatre',
      'Small Lecture Theatre',
    ],
  },

  'Examination Hall': {
    suggestions: [
      'Main Examination Hall',
      'Examination Hall 1',
      'Examination Hall 2',
      'Examination Hall 3',
      'CBT Examination Hall',
    ],
  },

  'Hostel / Hall of Residence': {
    suggestions: [],
  },

  'Market / Shopping': {
    suggestions: [
      'Campus Market',
      'Main Market',
      'Student Market',
      'Mini Market',
    ],
  },

  Library: {
    suggestions: [
      'University Library',
      'Main Library',
      'Faculty Library',
      'Departmental Library',
    ],
  },

  'Gate / Entrance': {
    suggestions: [
      'Main Gate',
      'Town Campus Gate',
      'Permanent Site Gate',
      'Annex Campus Gate',
      'Back Gate',
    ],
  },

  'Health Centre / Clinic': {
    suggestions: [
      'University Health Centre',
      'Medical Centre',
      'Clinic',
      'Pharmacy',
    ],
  },

  'Bank / ATM': {
    suggestions: [
      'Bank',
      'ATM',
      'Banking Hall',
    ],
  },

  'Sports / Recreation': {
    suggestions: [
      'Sports Complex',
      'Football Field',
      'Basketball Court',
      'Tennis Court',
      'Gymnasium',
    ],
  },
}

const DEFAULT_RULE = {
  academic: false,
  suggestions: [],
}

export default function LocationForm({
  values,
  onChange,
  campuses,
  categories,
  mode = 'all',
  lockCampus = false,
  placeSuggestions = [],
}) {
  const showDetails = mode !== 'notes'
  const showNotes = mode !== 'details'

  const campus = campuses.find(
    (c) => c.id === values.campusId
  )

  const rule =
    CATEGORY_RULES[values.category] || DEFAULT_RULE

  const facultyList = Object.keys(UNIUYO_ACADEMICS)

  const departments = useMemo(() => {
    if (!values.faculty) return []

    return UNIUYO_ACADEMICS[values.faculty] || []
  }, [values.faculty])

  const suggestions = useMemo(() => {
    const base = rule.suggestions || []

    return [
      ...new Set([
        ...base,
        ...UNIUYO_LOCATION_SUGGESTIONS,
        ...placeSuggestions,
      ]),
    ]
  }, [rule, placeSuggestions])

  function handleCategoryChange(category) {
    const nextRule =
      CATEGORY_RULES[category] || DEFAULT_RULE

    onChange({
      category,
      faculty: nextRule.academic
        ? values.faculty
        : '',
      department: nextRule.academic
        ? values.department
        : '',
    })
  }

  function handleFacultyChange(faculty) {
    onChange({
      faculty,
      department: '',
    })
  }

  return (
    <div className="form">
      {showDetails && (
        <>
          {/* CAMPUS */}
          <div className="field">
            <label
              className="field-label"
              htmlFor="campus"
            >
              Campus
            </label>

            {lockCampus ? (
              <div className="static-value">
                {campus
                  ? campus.name
                  : 'Unknown campus'}
              </div>
            ) : (
              <select
                id="campus"
                value={values.campusId}
                onChange={(e) =>
                  onChange({
                    campusId: e.target.value,
                  })
                }
              >
                {campuses.map((c) => (
                  <option
                    key={c.id}
                    value={c.id}
                  >
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* PLACE NAME */}
          <div className="field">
            <label
              className="field-label"
              htmlFor="place-name"
            >
              Place name
            </label>

            <input
              id="place-name"
              type="text"
              list="campusmapper-location-suggestions"
              value={values.name}
              placeholder="For example: Faculty of Law"
              autoComplete="off"
              autoCapitalize="words"
              enterKeyHint="done"
              onChange={(e) =>
                onChange({
                  name: e.target.value,
                })
              }
            />

            <datalist
              id="campusmapper-location-suggestions"
            >
              {suggestions.map((suggestion) => (
                <option
                  key={suggestion}
                  value={suggestion}
                />
              ))}
            </datalist>
          </div>

          {/* CATEGORY */}
          <fieldset className="field">
            <legend className="field-label">
              Category
            </legend>

            <div className="chips">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className="chip"
                  aria-pressed={
                    values.category === cat.name
                  }
                  onClick={() =>
                    handleCategoryChange(cat.name)
                  }
                >
                  <span aria-hidden="true">
                    {cat.icon}
                  </span>{' '}
                  {cat.name}
                </button>
              ))}
            </div>
          </fieldset>

          {/* FACULTY */}
          {rule.academic && (
            <div className="field">
              <label
                className="field-label"
                htmlFor="faculty"
              >
                Faculty{' '}
                <span className="optional">
                  optional
                </span>
              </label>

              <select
                id="faculty"
                value={values.faculty || ''}
                onChange={(e) =>
                  handleFacultyChange(
                    e.target.value
                  )
                }
              >
                <option value="">
                  Select faculty
                </option>

                {facultyList.map((faculty) => (
                  <option
                    key={faculty}
                    value={faculty}
                  >
                    {faculty}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* DEPARTMENT */}
          {rule.academic &&
            values.faculty && (
              <div className="field">
                <label
                  className="field-label"
                  htmlFor="department"
                >
                  Department{' '}
                  <span className="optional">
                    optional
                  </span>
                </label>

                <select
                  id="department"
                  value={values.department || ''}
                  onChange={(e) =>
                    onChange({
                      department:
                        e.target.value,
                    })
                  }
                >
                  <option value="">
                    Select department
                  </option>

                  {departments.map(
                    (department) => (
                      <option
                        key={department}
                        value={department}
                      >
                        {department}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}

          {/* DESCRIPTION */}
          <div className="field">
            <label
              className="field-label"
              htmlFor="description"
            >
              Description{' '}
              <span className="optional">
                optional
              </span>
            </label>

            <textarea
              id="description"
              rows={3}
              value={values.description}
              placeholder="What is this place used for?"
              onChange={(e) =>
                onChange({
                  description:
                    e.target.value,
                })
              }
            />
          </div>
        </>
      )}

      {/* NOTES */}
      {showNotes && (
        <div className="field">
          <label
            className="field-label"
            htmlFor="field-notes"
          >
            Field notes{' '}
            <span className="optional">
              optional
            </span>
          </label>

          <textarea
            id="field-notes"
            rows={5}
            value={values.fieldNotes}
            placeholder="Opening hours, access routes, what you saw, anything the map should know."
            onChange={(e) =>
              onChange({
                fieldNotes:
                  e.target.value,
              })
            }
          />
        </div>
      )}
    </div>
  )
}