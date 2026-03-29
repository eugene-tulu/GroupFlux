import { createFileRoute } from '@tanstack/react-router'
import { LenderDashboard } from '@/components/groupflux/LenderDashboard'
import { GroupFluxNav } from '@/components/groupflux/GroupFluxNav'

export const Route = createFileRoute('/_public/lender')({
  component: LenderPage,
})

function LenderPage() {
  return (
    <div className="app-shell">
      <GroupFluxNav />
      <main className="main-content">
        <div className="page-header">
          <h1 className="page-title">Lender Dashboard</h1>
          <p className="page-sub">
            Manage groups, farmers, and loan disbursements
          </p>
        </div>
        <LenderDashboard />
      </main>
    </div>
  )
}
