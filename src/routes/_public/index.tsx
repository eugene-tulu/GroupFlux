import { createFileRoute } from '@tanstack/react-router'
import { LandingPage } from '@/components/groupflux/LandingPage'

export const Route = createFileRoute('/_public/')({
  component: Index,
})

function Index() {
  return <LandingPage />
}
