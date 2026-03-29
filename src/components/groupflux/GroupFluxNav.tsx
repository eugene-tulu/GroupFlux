import { Link } from '@tanstack/react-router'

export function GroupFluxNav() {
  return (
    <nav className="gf-nav">
      <div className="gf-nav-inner">
        <Link to="/" className="gf-logo">
          <span className="gf-logo-icon">⬡</span>
          <span>
            Group<strong>Flux</strong>
          </span>
        </Link>
        <div className="gf-nav-links">
          <Link to="/lender" className="gf-nav-link">
            Lender
          </Link>
          <Link to="/investor" className="gf-nav-link">
            Investor
          </Link>
          <Link to="/verify" className="gf-nav-link">
            Verify
          </Link>
        </div>
      </div>
    </nav>
  )
}
