import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'

import {
  fetchCampuses,
  fetchCategories,
} from '../lib/places'

const AppContext = createContext(null)

const CAMPUS_KEY = 'campusmapper.campusId'

export function AppProvider({ children }) {
  const [campuses, setCampuses] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [campusId, setCampusIdState] = useState(() =>
    localStorage.getItem(CAMPUS_KEY)
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [c, cat] = await Promise.all([
        fetchCampuses(),
        fetchCategories(),
      ])

      setCampuses(c)
      setCategories(cat)
    } catch (err) {
      setError(
        err.message || 'Could not load campuses'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Make Town Campus the default campus
  useEffect(() => {
    if (!campuses.length) return

    const savedCampusExists = campuses.some(
      (campus) => campus.id === campusId
    )

    if (savedCampusExists) return

    const townCampus = campuses.find((campus) =>
      campus.name
        ?.toLowerCase()
        .includes('town')
    )

    const defaultCampus =
      townCampus || campuses[0]

    if (defaultCampus) {
      localStorage.setItem(
        CAMPUS_KEY,
        defaultCampus.id
      )

      setCampusIdState(defaultCampus.id)
    }
  }, [campuses, campusId])

  const setCampusId = (id) => {
    if (!id) return

    localStorage.setItem(
      CAMPUS_KEY,
      id
    )

    setCampusIdState(id)
  }

  const currentCampus =
    campuses.find(
      (campus) => campus.id === campusId
    ) || null

  return (
    <AppContext.Provider
      value={{
        campuses,
        categories,
        currentCampus,
        setCampusId,
        loading,
        error,
        reload: load,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}