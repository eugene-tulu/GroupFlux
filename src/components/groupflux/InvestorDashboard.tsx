'use client'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import {
  getInvestorDataFn,
  recordInvestmentFn,
} from '@/server/functions/groupflux'
import type { Groups } from '@/server/lib/appwrite.types'

const TIERS = [
  {
    key: 'community',
    name: 'Community Lender',
    minInvest: 5000,
    yieldRange: '10–12%',
    targetYield: 11,
    groups: 'Funds 1 group',
    type: 'retail' as const,
    featured: false,
    icon: '🌱',
  },
  {
    key: 'portfolio',
    name: 'Portfolio Lender',
    minInvest: 25000,
    yieldRange: '13–15%',
    targetYield: 14,
    groups: 'Funds 3–5 groups',
    type: 'retail' as const,
    featured: true,
    icon: '📈',
    badge: 'Most Popular',
  },
  {
    key: 'impact',
    name: 'Impact Fund',
    minInvest: 100000,
    yieldRange: '12–14%',
    targetYield: 13,
    groups: 'Funds 10+ groups',
    type: 'institutional' as const,
    featured: false,
    icon: '🌍',
    extra: 'Quarterly reporting',
  },
]

function InvestModal({
  tier,
  groups,
  onClose,
}: {
  tier: (typeof TIERS)[0]
  groups: Groups[]
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState(tier.minInvest.toString())
  const [selectedGroups, setSelectedGroups] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: recordInvestmentFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['investor-data'] })
      setDone(true)
    },
  })

  const toggleGroup = (id: string) => {
    setSelectedGroups((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    mutation.mutate({
      data: {
        name,
        email,
        type: tier.type,
        amount: parseFloat(amount),
        targetYield: tier.targetYield,
        groupIds: selectedGroups,
      },
    })
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
        {done ? (
          <div className="invest-success">
            <div className="invest-success-icon">✓</div>
            <h3>Investment Recorded!</h3>
            <p>Welcome to GroupFlux as a {tier.name}.</p>
            <button className="btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="modal-header">
              <h3>Invest — {tier.name}</h3>
              <button className="modal-close" onClick={onClose}>
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <label>
                Full Name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <label>
                Email Address
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label>
                Investment Amount (KES, min {tier.minInvest.toLocaleString()})
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min={tier.minInvest}
                  required
                />
              </label>
              <label>Select Groups to Fund</label>
              <div className="group-checkboxes">
                {groups.map((g) => (
                  <label key={g.$id} className="group-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedGroups.includes(g.$id)}
                      onChange={() => toggleGroup(g.$id)}
                    />
                    {g.name}
                  </label>
                ))}
              </div>
              {mutation.isError && (
                <p className="form-error">Failed to record investment.</p>
              )}
              <button
                type="submit"
                className="btn-primary"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Processing…' : 'Confirm Investment'}
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  )
}

export function InvestorDashboard() {
  const [activeTier, setActiveTier] = useState<(typeof TIERS)[0] | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['investor-data'],
    queryFn: () => getInvestorDataFn(),
  })

  const stats = data?.stats ?? {
    avgYield: 12.5,
    defaultRate: 3,
    totalCapital: 0,
    activeInvestors: 0,
  }

  return (
    <div className="dashboard">
      {/* Portfolio Stats */}
      <section className="stats-bar">
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="stat-label">Avg Net Yield</p>
          <p className="stat-value">{stats.avgYield}%</p>
          <p className="stat-sub">Annual return</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <p className="stat-label">Default Rate</p>
          <p
            className="stat-value"
            style={{ color: stats.defaultRate > 10 ? '#DC2626' : '#1D9E75' }}
          >
            {stats.defaultRate}%
          </p>
          <p className="stat-sub">Platform-wide</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <p className="stat-label">Capital Deployed</p>
          <p className="stat-value">
            KES {(stats.totalCapital / 1000).toFixed(0)}K
          </p>
          <p className="stat-sub">Total invested</p>
        </motion.div>
        <motion.div
          className="stat-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <p className="stat-label">Active Investors</p>
          <p className="stat-value">{stats.activeInvestors}</p>
          <p className="stat-sub">On the platform</p>
        </motion.div>
      </section>

      {/* Investment Tiers */}
      <section className="section">
        <h2 className="section-title">Investment Tiers</h2>
        <div className="tiers-grid">
          {TIERS.map((tier) => (
            <motion.div
              key={tier.key}
              className={`tier-card ${tier.featured ? 'tier-featured' : ''}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {tier.featured && (
                <div className="tier-featured-badge">{tier.badge}</div>
              )}
              <div className="tier-icon">{tier.icon}</div>
              <h3 className="tier-name">{tier.name}</h3>
              <p className="tier-yield">{tier.yieldRange}</p>
              <p className="tier-yield-label">projected annual yield</p>
              <p className="tier-min">
                Min. KES {tier.minInvest.toLocaleString()}
              </p>
              <p className="tier-groups">{tier.groups}</p>
              {tier.extra && <p className="tier-extra">📋 {tier.extra}</p>}
              <button
                className={`btn-invest ${tier.featured ? 'btn-invest-featured' : ''}`}
                onClick={() => setActiveTier(tier)}
              >
                Invest Now
              </button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Repayment Chart */}
      <section className="section">
        <h2 className="section-title">Repayment Rate by Season</h2>
        <div className="chart-wrap">
          {isLoading ? (
            <div className="loading-state">Loading chart…</div>
          ) : !data?.seasonRepayment.length ? (
            <div className="empty-chart">
              <p>No season data yet. Seed demo data to see the chart.</p>
              <div className="mock-chart-bars">
                {['LR23', 'SR23', 'LR24', 'SR24', 'LR25', 'SR25'].map(
                  (s, i) => (
                    <div key={s} className="mock-bar-wrap">
                      <div
                        className="mock-bar"
                        style={{
                          height: `${60 + i * 6}%`,
                          background: '#1D9E75',
                          opacity: 0.3,
                        }}
                      />
                      <span>{s}</span>
                    </div>
                  ),
                )}
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data.seasonRepayment}
                margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  dataKey="season"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickLine={false}
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, 'Repayment Rate']}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #E5E7EB',
                  }}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {data.seasonRepayment.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.rate >= 80
                          ? '#1D9E75'
                          : entry.rate >= 60
                            ? '#D97706'
                            : '#DC2626'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Groups Performance Table */}
      <section className="section">
        <h2 className="section-title">Group Performance</h2>
        <div className="table-wrap">
          <table className="gf-table">
            <thead>
              <tr>
                <th>Group</th>
                <th>Repayment Rate</th>
                <th>Capital Deployed</th>
                <th>Expected Return</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.groups ?? []).map((g) => {
                const deployed = (data?.investors ?? [])
                  .filter((inv) => inv.groupIds?.includes(g.$id))
                  .reduce((sum, inv) => sum + (inv.capitalDeployed ?? 0), 0)
                const expectedReturn = Math.round(deployed * 0.13)
                return (
                  <tr key={g.$id}>
                    <td>
                      <strong>{g.name}</strong>
                    </td>
                    <td>
                      <span
                        style={{
                          color:
                            (g.repaymentRate ?? 0) >= 80
                              ? '#1D9E75'
                              : (g.repaymentRate ?? 0) >= 60
                                ? '#D97706'
                                : '#DC2626',
                          fontWeight: 600,
                        }}
                      >
                        {g.repaymentRate ?? 0}%
                      </span>
                    </td>
                    <td>KES {deployed.toLocaleString()}</td>
                    <td>KES {expectedReturn.toLocaleString()}</td>
                    <td>
                      <span
                        className={`status-badge ${g.status === 'active' ? 'badge-green' : g.status === 'review' ? 'badge-amber' : 'badge-red'}`}
                      >
                        {g.status}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <AnimatePresence>
        {activeTier && (
          <InvestModal
            tier={activeTier}
            groups={data?.groups ?? []}
            onClose={() => setActiveTier(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
