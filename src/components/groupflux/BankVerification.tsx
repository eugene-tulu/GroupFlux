'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { verifyFarmerFn } from '@/server/functions/groupflux'
import type { VerificationResult } from '@/server/functions/groupflux'

const RECOMMENDATION_CONFIG = {
  approve: {
    label: 'Recommend Approval',
    color: '#1D9E75',
    bg: '#ECFDF5',
    border: '#1D9E75',
    icon: '✓',
  },
  review: {
    label: 'Further Review Required',
    color: '#D97706',
    bg: '#FFFBEB',
    border: '#D97706',
    icon: '⚠',
  },
  'high-risk': {
    label: 'High Risk',
    color: '#DC2626',
    bg: '#FEF2F2',
    border: '#DC2626',
    icon: '✕',
  },
}

function TrustMeter({ score }: { score: number }) {
  const color = score >= 80 ? '#1D9E75' : score >= 60 ? '#D97706' : '#DC2626'
  return (
    <div className="trust-meter">
      <svg width="140" height="70" viewBox="0 0 140 70">
        <path
          d="M10 70 A60 60 0 0 1 130 70"
          fill="none"
          stroke="#E5E7EB"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M10 70 A60 60 0 0 1 130 70"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 188.5} 188.5`}
        />
        <text
          x="70"
          y="62"
          textAnchor="middle"
          fill={color}
          fontSize="22"
          fontWeight="700"
        >
          {score}
        </text>
      </svg>
    </div>
  )
}

export function BankVerification() {
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await verifyFarmerFn({ data: { query: query.trim() } })
      setResult(res)
    } catch {
      setError('Search failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="verify-page">
      {/* Hero */}
      <div className="verify-hero">
        <div className="verify-hero-inner">
          <span className="verify-kicker">Bank Verification Portal</span>
          <h1 className="verify-title">
            GroupFlux Trust
            <br />
            Verification System
          </h1>
          <p className="verify-sub">
            Instant farmer creditworthiness reports powered by M-Pesa
            transaction history and the GroupFlux trust score engine.
          </p>
          {/* Search */}
          <form className="verify-search-form" onSubmit={handleSearch}>
            <div className="verify-search-wrap">
              <input
                className="verify-search-input"
                type="text"
                placeholder="Enter M-Pesa number or Farmer ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                required
              />
              <button
                type="submit"
                className="verify-search-btn"
                disabled={loading}
              >
                {loading ? '…' : 'Search'}
              </button>
            </div>
          </form>
          {error && (
            <p className="form-error" style={{ marginTop: 8 }}>
              {error}
            </p>
          )}
        </div>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            className="verify-result-wrap"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {!result.found ? (
              <div className="verify-not-found">
                <p>
                  🔍 No farmer found for <strong>"{query}"</strong>
                </p>
                <p>Try a different M-Pesa number or farmer ID.</p>
              </div>
            ) : (
              <div className="verify-report">
                <div className="report-header">
                  <div className="report-avatar">
                    {result
                      .farmer!.name.split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="report-info">
                    <h2>{result.farmer!.name}</h2>
                    <p>ID: {result.farmer!.id.slice(0, 16)}…</p>
                    <p>📱 {result.farmer!.phone}</p>
                    <p className="verified-via">
                      <span className="verified-check">✓</span>
                      Verified via M-Pesa Transaction Log
                    </p>
                  </div>
                  <div className="report-trust">
                    <TrustMeter score={result.farmer!.trustScore} />
                    <p className="trust-label-text">Trust Score</p>
                  </div>
                </div>

                <div className="report-grid">
                  <div className="report-item">
                    <p className="ri-label">Group</p>
                    <p className="ri-value">{result.farmer!.groupName}</p>
                  </div>
                  <div className="report-item">
                    <p className="ri-label">Group Repayment Rate</p>
                    <p className="ri-value" style={{ color: '#1D9E75' }}>
                      {result.farmer!.groupRepaymentRate}%
                    </p>
                  </div>
                  <div className="report-item">
                    <p className="ri-label">Seasons Completed</p>
                    <p className="ri-value">{result.farmer!.seasonsActive}</p>
                  </div>
                  <div className="report-item">
                    <p className="ri-label">Loans Repaid</p>
                    <p className="ri-value">
                      {result.farmer!.repaidLoans} / {result.farmer!.totalLoans}
                    </p>
                  </div>
                </div>

                {(() => {
                  const rec =
                    RECOMMENDATION_CONFIG[result.farmer!.recommendation]
                  return (
                    <div
                      className="recommendation-badge"
                      style={{
                        background: rec.bg,
                        borderColor: rec.border,
                        color: rec.color,
                      }}
                    >
                      <span className="rec-icon">{rec.icon}</span>
                      <span className="rec-label">{rec.label}</span>
                    </div>
                  )
                })()}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Methodology */}
      <div className="methodology-section">
        <h2 className="section-title">GroupFlux Trust Score Methodology</h2>
        <div className="methodology-grid">
          <div className="method-card">
            <div className="method-icon">📊</div>
            <h3>Repayment History (60 pts)</h3>
            <p>
              The largest component — 60 points based on the ratio of repaid
              loans to total loans. A farmer who repays every loan scores the
              full 60 points.
            </p>
          </div>
          <div className="method-card">
            <div className="method-icon">🌱</div>
            <h3>Season Tenure (up to 30 pts)</h3>
            <p>
              5 points per completed growing season, capped at 30. Longer
              membership demonstrates commitment and establishes a reliable
              credit history.
            </p>
          </div>
          <div className="method-card">
            <div className="method-icon">🏆</div>
            <h3>Clean Record Bonus (10 pts)</h3>
            <p>
              10 bonus points are awarded to farmers with zero defaults ever.
              This rewards disciplined borrowers and incentivises timely
              repayment.
            </p>
          </div>
          <div className="method-card">
            <div className="method-icon">📱</div>
            <h3>M-Pesa Verification</h3>
            <p>
              All repayments are recorded with M-Pesa receipt numbers and
              callback payloads. Each transaction is immutably logged — no
              manual adjustments are possible.
            </p>
          </div>
        </div>
        <div className="methodology-note">
          <strong>What this means for lenders:</strong> A score of 80+ indicates
          a borrower with a strong, verified repayment track record across
          multiple growing seasons. Scores below 60 warrant additional due
          diligence before extending credit.
        </div>
      </div>

      {/* API Reference */}
      <div className="api-section">
        <h2 className="section-title">API Reference</h2>
        <p className="api-intro">
          Banks and microfinance institutions can query the GroupFlux Trust
          Score API programmatically using a standard REST call.
        </p>
        <div className="api-block">
          <p className="api-method">
            GET /api/verify?query=&#123;mpesa_or_id&#125;
          </p>
        </div>
        <h3 className="api-subtitle">Example Response</h3>
        <pre className="api-code">{`{
  "found": true,
  "farmer": {
    "id": "6721abc9def01234",
    "name": "Wanjiru Kamau",
    "phone": "+254712345678",
    "mpesaNumber": "+254712345678",
    "groupName": "Kiambu Maize Cooperative",
    "groupRepaymentRate": 92,
    "trustScore": 92,
    "seasonsActive": 6,
    "totalLoans": 6,
    "repaidLoans": 6,
    "recommendation": "approve"
  }
}`}</pre>
        <div className="api-recs-table">
          <h3 className="api-subtitle">Recommendation Values</h3>
          <table className="gf-table">
            <thead>
              <tr>
                <th>Value</th>
                <th>Score Range</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code style={{ color: '#1D9E75' }}>approve</code>
                </td>
                <td>80–100</td>
                <td>Strong credit profile. Recommend approval.</td>
              </tr>
              <tr>
                <td>
                  <code style={{ color: '#D97706' }}>review</code>
                </td>
                <td>60–79</td>
                <td>Acceptable history. Further review recommended.</td>
              </tr>
              <tr>
                <td>
                  <code style={{ color: '#DC2626' }}>high-risk</code>
                </td>
                <td>0–59</td>
                <td>High default risk. Extended due diligence required.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
