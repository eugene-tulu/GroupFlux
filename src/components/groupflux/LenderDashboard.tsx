'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from '@tanstack/react-router'
import { getLenderDataFn, disburseLoanFn } from '@/server/functions/groupflux'
import { TrustScoreBadge } from './TrustBadge'
import { formatCurrency } from '@/lib/utils'
import type { Groups, Farmers } from '@/server/lib/appwrite.types'

type EnrichedGroup = Groups & {
  memberCount: number
  leaderName: string
  disbursed: number
  repaid: number
}
type EnrichedFarmer = Farmers & { groupName: string }

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    active: { bg: '#ECFDF5', color: '#1D9E75', label: 'Active' },
    review: { bg: '#FFFBEB', color: '#D97706', label: 'Under Review' },
    suspended: { bg: '#FEF2F2', color: '#DC2626', label: 'Suspended' },
  }
  const s = map[status] ?? map.active
  return (
    <span className="status-badge" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string
}) {
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {sub && <p className="stat-sub">{sub}</p>}
    </motion.div>
  )
}

function DisburseModal({
  group,
  onClose,
  onSuccess,
}: {
  group: EnrichedGroup
  onClose: () => void
  onSuccess: () => void
}) {
  const [amount, setAmount] = useState('')
  const [season, setSeason] = useState('')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (d: { groupId: string; amount: number; season: string }) =>
      disburseLoanFn({ data: d }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lender-data'] })
      onSuccess()
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !season) return
    mutation.mutate({ groupId: group.$id, amount: parseFloat(amount), season })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <motion.div
        className="modal-box"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Disburse Loan</h3>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="modal-sub">
          Group: <strong>{group.name}</strong> · {group.memberCount} member
          {group.memberCount !== 1 ? 's' : ''}
        </p>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Amount per Farmer (KES)
            <input
              type="number"
              placeholder="e.g. 25000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              min={1}
            />
          </label>
          <label>
            Season
            <input
              type="text"
              placeholder="e.g. Long Rains 2025"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              required
            />
          </label>
          {mutation.isError && (
            <p className="form-error">
              Error: {(mutation.error as Error).message}
            </p>
          )}
          {mutation.isSuccess && (
            <p className="form-success">
              ✓ Disbursed to {mutation.data?.loansCreated} farmers
            </p>
          )}
          <button
            type="submit"
            className="btn-primary"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Processing…' : 'Confirm Disbursement'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

function GroupCard({
  group,
  onDisburse,
}: {
  group: EnrichedGroup
  onDisburse: () => void
}) {
  const pct =
    group.disbursed > 0 ? Math.round((group.repaid / group.disbursed) * 100) : 0
  return (
    <motion.div
      className="group-card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="group-card-header">
        <div>
          <h3 className="group-name">{group.name}</h3>
          <p className="group-meta">
            {group.region} · {group.crop}
          </p>
        </div>
        <StatusBadge status={group.status ?? 'active'} />
      </div>
      <div className="group-info-row">
        <span>
          👤 Leader: <strong>{group.leaderName}</strong>
        </span>
        <span>👥 {group.memberCount} Members</span>
      </div>
      <div className="repayment-bar-wrap">
        <div className="repayment-bar-labels">
          <span>Repayment</span>
          <span>{pct}%</span>
        </div>
        <div className="repayment-bar-track">
          <motion.div
            className="repayment-bar-fill"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              background:
                pct >= 80 ? '#1D9E75' : pct >= 60 ? '#D97706' : '#DC2626',
            }}
          />
        </div>
        <div className="repayment-bar-sub">
          {formatCurrency(group.repaid)} / {formatCurrency(group.disbursed)}
        </div>
      </div>
      <button className="btn-disburse" onClick={onDisburse}>
        ⚡ Disburse Loan
      </button>
    </motion.div>
  )
}

function FarmersTable({ farmers }: { farmers: EnrichedFarmer[] }) {
  return (
    <div className="table-wrap">
      <table className="gf-table">
        <thead>
          <tr>
            <th>Farmer</th>
            <th>Group</th>
            <th>Role</th>
            <th>Seasons</th>
            <th>Trust Score</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {farmers.map((f) => (
            <tr key={f.$id}>
              <td className="farmer-name-cell">
                <div className="avatar-sm">{f.name.charAt(0)}</div>
                {f.name}
              </td>
              <td>{f.groupName}</td>
              <td>
                {f.role === 'leader' ? (
                  <span className="leader-badge">Leader</span>
                ) : (
                  <span className="member-text">Member</span>
                )}
              </td>
              <td>{f.seasonsActive ?? 0}</td>
              <td>
                <TrustScoreBadge score={f.trustScore ?? 0} />
              </td>
              <td>
                <Link
                  to="/farmer/$farmerId"
                  params={{ farmerId: f.$id }}
                  className="btn-view"
                >
                  View Profile →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function LenderDashboard() {
  const [disburseGroup, setDisburseGroup] = useState<EnrichedGroup | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['lender-data'],
    queryFn: () => getLenderDataFn(),
  })

  if (isLoading) return <div className="loading-state">Loading dashboard…</div>
  if (error || !data)
    return (
      <div className="error-state">
        Failed to load data. Please try seeding first.
      </div>
    )

  return (
    <div className="dashboard">
      {/* Stats Bar */}
      <section className="stats-bar">
        <StatCard
          label="Total Disbursed"
          value={formatCurrency(data.stats.totalDisbursed)}
          sub="Across all groups"
        />
        <StatCard
          label="Repayment Rate"
          value={`${data.stats.overallRepaymentRate}%`}
          sub="Loans repaid on time"
        />
        <StatCard
          label="Active Farmers"
          value={data.stats.activeFarmers.toString()}
          sub="Enrolled members"
        />
        <StatCard
          label="Avg Trust Score"
          value={data.stats.avgTrustScore.toString()}
          sub="Platform average"
        />
      </section>

      {/* Groups */}
      <section className="section">
        <h2 className="section-title">Farmer Groups</h2>
        {data.groups.length === 0 ? (
          <p className="empty-state">
            No groups found. Seed demo data to get started.
          </p>
        ) : (
          <div className="groups-grid">
            {data.groups.map((g) => (
              <GroupCard
                key={g.$id}
                group={g}
                onDisburse={() => setDisburseGroup(g)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Farmers Table */}
      <section className="section">
        <h2 className="section-title">All Farmers</h2>
        {data.farmers.length === 0 ? (
          <p className="empty-state">No farmers registered yet.</p>
        ) : (
          <FarmersTable farmers={data.farmers} />
        )}
      </section>

      <AnimatePresence>
        {disburseGroup && (
          <DisburseModal
            group={disburseGroup}
            onClose={() => setDisburseGroup(null)}
            onSuccess={() => setDisburseGroup(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
