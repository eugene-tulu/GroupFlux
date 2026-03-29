export function TrustScoreBadge({ score }: { score: number }) {
  const color = score >= 85 ? '#1D9E75' : score >= 70 ? '#D97706' : '#DC2626'
  const bg = score >= 85 ? '#ECFDF5' : score >= 70 ? '#FFFBEB' : '#FEF2F2'
  const label = score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : 'At Risk'
  return (
    <span
      className="trust-pill"
      style={{ color, background: bg, border: `1px solid ${color}30` }}
    >
      {score} · {label}
    </span>
  )
}

export function GroupFluxVerifiedBadge({ score }: { score: number }) {
  if (score < 80) return null
  return (
    <div className="verified-badge">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <path d="M9 12l2 2 4-4" />
        <path d="M12 2l2.4 2.4L17 3l1 2.7 2.7 1L20 9.4 22 12l-2 2.6.7 2.7-2.7 1-1 2.7-2.6-.7L12 22l-2.4-2-2.6.7-1-2.7-2.7-1 .7-2.7L2 12l2-2.6-.7-2.7 2.7-1 1-2.7 2.6.7z" />
      </svg>
      GroupFlux Verified
    </div>
  )
}
