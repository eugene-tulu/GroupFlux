'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  getFarmerProfileFn,
  recordRepaymentFn,
} from '@/server/functions/groupflux'
import { TrustScoreBadge, GroupFluxVerifiedBadge } from './TrustBadge'
import type { Loans } from '@/server/lib/appwrite.types'

function LoanStatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    repaid: { bg: '#ECFDF5', color: '#1D9E75' },
    active: { bg: '#FFFBEB', color: '#D97706' },
    pending: { bg: '#EFF6FF', color: '#3B82F6' },
    defaulted: { bg: '#FEF2F2', color: '#DC2626' },
  }
  const s = map[status] ?? map.pending
  return (
    <span className="loan-pill" style={{ background: s.bg, color: s.color }}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

function RepaymentPanel({
  farmerId,
  loans,
  onSuccess,
}: {
  farmerId: string
  loans: Loans[]
  onSuccess: () => void
}) {
  const [loanId, setLoanId] = useState('')
  const [amount, setAmount] = useState('')
  const [result, setResult] = useState<{
    receipt: string
    score: number
  } | null>(null)
  const qc = useQueryClient()

  const activeLoans = loans.filter(
    (l) => l.status === 'active' || l.status === 'pending',
  )

  const mutation = useMutation({
    mutationFn: (d: { farmerId: string; loanId: string; amount: number }) =>
      recordRepaymentFn({ data: d }),
    onSuccess: (data) => {
      setResult({ receipt: data.receipt, score: data.newTrustScore })
      qc.invalidateQueries({ queryKey: ['farmer', farmerId] })
      onSuccess()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!loanId || !amount) return
    mutation.mutate({ farmerId, loanId, amount: parseFloat(amount) })
  }

  return (
    <div className="repayment-panel">
      <h3 className="panel-title">Record M-Pesa Repayment</h3>
      {activeLoans.length === 0 ? (
        <p className="empty-state">
          No active loans to record repayment against.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Select Loan
            <select
              value={loanId}
              onChange={(e) => setLoanId(e.target.value)}
              required
            >
              <option value="">Choose a loan…</option>
              {activeLoans.map((l) => (
                <option key={l.$id} value={l.$id}>
                  {l.season ?? 'Unknown Season'} — KES{' '}
                  {l.amount.toLocaleString()} ({l.status})
                </option>
              ))}
            </select>
          </label>
          <label>
            Repayment Amount (KES)
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              required
              min={1}
            />
          </label>
          {mutation.isError && (
            <p className="form-error">Error recording repayment.</p>
          )}
          {result && (
            <div className="repayment-success">
              <p>✓ Repayment recorded</p>
              <p>
                M-Pesa Receipt: <code>{result.receipt}</code>
              </p>
              <p>
                New Trust Score: <strong>{result.score}</strong>
              </p>
            </div>
          )}
          <button
            type="submit"
            className="btn-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending
              ? 'Processing…'
              : '📱 Record Repayment via M-Pesa'}
          </button>
        </form>
      )}
    </div>
  )
}

export function FarmerProfile({ farmerId }: { farmerId: string }) {
  const [refreshKey, setRefreshKey] = useState(0)
  const qc = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['farmer', farmerId, refreshKey],
    queryFn: () => getFarmerProfileFn({ data: { farmerId } }),
  })

  if (isLoading)
    return <div className="loading-state">Loading farmer profile…</div>
  if (error || !data)
    return <div className="error-state">Farmer not found.</div>

  const { farmer, loans, totalRepaid } = data
  const initials = farmer.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const score = farmer.trustScore ?? 0
  const scoreColor =
    score >= 85 ? '#1D9E75' : score >= 70 ? '#D97706' : '#DC2626'
  const scoreBg = score >= 85 ? '#ECFDF5' : score >= 70 ? '#FFFBEB' : '#FEF2F2'

  return (
    <div className="farmer-profile">
      {/* Header */}
      <motion.div
        className="profile-header"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <div className="profile-avatar">{initials}</div>
        <div className="profile-info">
          <div className="profile-name-row">
            <h1 className="profile-name">{farmer.name}</h1>
            <GroupFluxVerifiedBadge score={score} />
          </div>
          <p className="profile-meta">
            📱 {farmer.phone} · 👥 {farmer.groupName}
          </p>
          <p className="profile-id">
            <span
              className={`role-chip ${farmer.role === 'leader' ? 'leader' : ''}`}
            >
              {farmer.role === 'leader' ? '⭐ Group Leader' : 'Member'}
            </span>
            <span className="farmer-id">ID: {farmer.$id.slice(0, 12)}…</span>
          </p>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="profile-stats">
        <motion.div
          className="profile-stat-card"
          style={{ background: scoreBg, border: `1px solid ${scoreColor}30` }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="pstat-label">Trust Score</p>
          <p className="pstat-value" style={{ color: scoreColor }}>
            {score}
          </p>
          <p className="pstat-sub">
            {score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : 'At Risk'}
          </p>
        </motion.div>
        <motion.div
          className="profile-stat-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="pstat-label">Seasons Active</p>
          <p className="pstat-value">{farmer.seasonsActive ?? 0}</p>
          <p className="pstat-sub">Growing seasons</p>
        </motion.div>
        <motion.div
          className="profile-stat-card"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="pstat-label">Total Repaid</p>
          <p className="pstat-value">KES {totalRepaid.toLocaleString()}</p>
          <p className="pstat-sub">Verified via M-Pesa</p>
        </motion.div>
      </div>

      {/* Loan Timeline */}
      <div className="loan-timeline">
        <h2 className="section-title">Repayment History</h2>
        {loans.length === 0 ? (
          <p className="empty-state">No loans recorded yet.</p>
        ) : (
          <div className="timeline">
            {loans.map((loan, i) => (
              <motion.div
                key={loan.$id}
                className="timeline-item"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <div className="timeline-dot" />
                <div className="timeline-content">
                  <div className="timeline-row">
                    <strong>{loan.season ?? 'Unknown Season'}</strong>
                    <LoanStatusPill status={loan.status ?? 'pending'} />
                  </div>
                  <p className="timeline-amount">
                    KES {loan.amount.toLocaleString()}
                  </p>
                  {loan.disbursedAt && (
                    <p className="timeline-date">
                      Disbursed:{' '}
                      {new Date(loan.disbursedAt).toLocaleDateString('en-KE')}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Repayment Panel */}
      <RepaymentPanel
        farmerId={farmerId}
        loans={loans}
        onSuccess={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  )
}
