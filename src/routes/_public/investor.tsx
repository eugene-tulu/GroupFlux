import { createFileRoute } from '@tanstack/react-router'
import { InvestorDashboard } from '@/components/groupflux/InvestorDashboard'
import { GroupFluxNav } from '@/components/groupflux/GroupFluxNav'

export const Route = createFileRoute('/_public/investor')({
  component: InvestorPage,
})

function InvestorPage() {
  return (
    <div className="app-shell">
      <GroupFluxNav />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">Investor Portal</h1>
          <p className="page-sub">
            Portfolio performance, investment tiers, and group analytics
          </p>
        </div>
        <InvestorDashboard />
      </main>
    </div>
  )
}
