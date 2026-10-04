import { useNavigate } from 'react-router-dom'

function PinMark() {
  return (
    <svg className="brand-pin" width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
      <path
        d="M16 3c-4.8 0-8.7 3.7-8.7 8.4 0 6.1 8.7 14.6 8.7 14.6s8.7-8.5 8.7-14.6C24.7 6.7 20.8 3 16 3zm0 11.4a3.1 3.1 0 110-6.2 3.1 3.1 0 010 6.2z"
        fill="#FF5A1F"
      />
    </svg>
  )
}

function Chevron() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

// backTo: a path like "/" to go to, a function to run, or true to go back one screen.
export default function Header({ title, backTo, action }) {
  const navigate = useNavigate()
  const goBack = () => {
    if (typeof backTo === 'function') backTo()
    else if (typeof backTo === 'string') navigate(backTo)
    else navigate(-1)
  }

  return (
    <header className="header">
      {backTo ? (
        <button type="button" className="icon-btn" aria-label="Go back" onClick={goBack}>
          <Chevron />
        </button>
      ) : (
        <PinMark />
      )}
      <h1 className="header-title">{title}</h1>
      <div className="header-action">{action}</div>
    </header>
  )
}
