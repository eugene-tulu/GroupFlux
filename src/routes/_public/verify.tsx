import { createFileRoute } from '@tanstack/react-router'
import { BankVerification } from '@/components/groupflux/BankVerification'

export const Route = createFileRoute('/_public/verify')({
  component: VerifyPage,
})

function VerifyPage() {
  return <BankVerification />
}
