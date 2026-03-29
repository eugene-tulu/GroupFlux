'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { seedDemoDataFn } from '@/server/functions/groupflux'

export function LandingPage() {
  const [seeded, setSeeded] = useState(false)

  const seedMutation = useMutation({
    mutationFn: () => seedDemoDataFn(),
    onSuccess: () => setSeeded(true),
  })

  return (
    <div className="landing">
      {/* Hero */}
      <header className="landing-hero">
        <nav className="landing-nav">
          <span className="gf-logo">
            <span className="gf-logo-icon">⬡</span>
            Group<strong>Flux</strong>
          </span>
          <div className="landing-nav-links">
            <Link to="/lender" className="nav-link-ghost">
              Lender Dashboard
            </Link>
            <Link to="/investor" className="nav-link-ghost">
              Investor Portal
            </Link>
            <Link to="/verify" className="nav-link-ghost">
              Verify Farmer
            </Link>
          </div>
        </nav>
        <div className="hero-content">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="hero-kicker">Kenya's Farmer Lending OS</span>
            <h1 className="hero-title">
              Credit infrastructure
              <br />
              built for <span className="hero-accent">group farming</span>
            </h1>
            <p className="hero-body">
              GroupFlux connects farmers, group leaders, lenders, and investors
              through a trust score engine verified by M-Pesa transaction data.
              Transparent. Accountable. Designed for Kenya.
            </p>
            <div className="hero-ctas">
              <Link to="/lender" className="btn-hero-primary">
                Lender Dashboard →
              </Link>
              <Link to="/investor" className="btn-hero-secondary">
                Investor Portal
              </Link>
            </div>

            {!seeded && (
              <div className="seed-prompt">
                <button
                  className="btn-seed"
                  onClick={() => seedMutation.mutate()}
                  disabled={seedMutation.isPending}
                >
                  {seedMutation.isPending
                    ? '⏳ Seeding demo data…'
                    : '🌱 Load Demo Data (First Time Setup)'}
                </button>
                {seedMutation.isError && (
                  <p className="form-error">
                    Seed failed — data may already exist.
                  </p>
                )}
              </div>
            )}
            {seeded && (
              <motion.p
                className="seed-success"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                ✓ Demo data loaded! Explore the dashboards above.
              </motion.p>
            )}
          </motion.div>
        </div>
      </header>

      {/* Roles Grid */}
      <section className="roles-section">
        <h2 className="roles-title">Four Roles. One Platform.</h2>
        <div className="roles-grid">
          {[
            {
              icon: '🌾',
              role: 'Farmer',
              desc: 'Build your trust score season by season. Phone OTP login, M-Pesa repayments.',
            },
            {
              icon: '⭐',
              role: 'Group Leader',
              desc: 'Manage your cooperative, oversee disbursements, and maintain group standing.',
            },
            {
              icon: '🏦',
              role: 'Lender / Admin',
              desc: 'Disburse loans to whole groups instantly. Monitor repayment across your portfolio.',
            },
            {
              icon: '📈',
              role: 'Investor',
              desc: 'Choose investment tiers. View seasonal yield charts. Deploy capital at scale.',
            },
          ].map((r, i) => (
            <motion.div
              key={r.role}
              className="role-card"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 + 0.3 }}
            >
              <div className="role-icon">{r.icon}</div>
              <h3>{r.role}</h3>
              <p>{r.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Trust Score Callout */}
      <section className="trust-callout">
        <div className="trust-callout-inner">
          <h2>The GroupFlux Trust Score</h2>
          <p>
            Every farmer on GroupFlux has a 0–100 trust score, automatically
            calculated from their repayment history, season tenure, and default
            record — all verified via M-Pesa callbacks.
          </p>
          <Link
            to="/verify"
            className="btn-hero-secondary"
            style={{ marginTop: 16, display: 'inline-block' }}
          >
            Bank Verification Portal →
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <p>GroupFlux © 2025 · Built for Kenyan Farmers</p>
      </footer>
    </div>
  )
}
