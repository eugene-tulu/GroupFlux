import { createFileRoute } from '@tanstack/react-router'
import { FarmerProfile } from '@/components/groupflux/FarmerProfile'
import { GroupFluxNav } from '@/components/groupflux/GroupFluxNav'

export const Route = createFileRoute('/_public/farmer/$farmerId')({
  component: FarmerProfilePage,
})

function FarmerProfilePage() {
  const { farmerId } = Route.useParams()
  return (
    <div className="app-shell">
      <GroupFluxNav />
      <main className="main-content">
        <FarmerProfile farmerId={farmerId} />
      </main>
    </div>
  )
}
