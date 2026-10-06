import { useNavigate } from 'react-router-dom'

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg
        width="30"
        height="30"
        viewBox="0 0 32 32"
        fill="none"
      >
        <path
          d="M16 3.5C10.9 3.5 6.8 7.4 6.8 12.3C6.8 18.7 16 27.5 16 27.5s9.2-8.8 9.2-15.2C25.2 7.4 21.1 3.5 16 3.5Z"
          fill="currentColor"
        />

        <circle
          cx="16"
          cy="12.3"
          r="3.6"
          fill="var(--primary)"
        />
      </svg>
    </div>
  )
}

function Chevron() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}

// backTo can be:
// - a string path such as "/"
// - a function
// - true to go back one screen
export default function Header({
  title,
  backTo,
  action,
  showMore = false,
}) {
  const navigate = useNavigate()

  const goBack = () => {
    if (typeof backTo === 'function') {
      backTo()
    } else if (typeof backTo === 'string') {
      navigate(backTo)
    } else {
      navigate(-1)
    }
  }

  return (
    <header className="header">
      <div className="header-left">
        {backTo ? (
          <button
            type="button"
            className="icon-btn"
            aria-label="Go back"
            onClick={goBack}
          >
            <Chevron />
          </button>
        ) : (
          <BrandMark />
        )}
      </div>

      <h1 className="header-title">
        {title}
      </h1>

      <div className="header-action">
        {action}

        {showMore && (
          <button
            type="button"
            className="icon-btn"
            aria-label="More options"
          >
            <MoreIcon />
          </button>
        )}
      </div>
    </header>
  )
}