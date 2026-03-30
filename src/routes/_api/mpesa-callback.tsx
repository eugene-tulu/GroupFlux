import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { databases } from '@/server/lib/db'
import { calcTrustScore } from '@/server/functions/groupflux'

const DB_ID = 'imagine-project-db'

const callbackSchema = z.object({
  TransactionType: z.string(),
  TransID: z.string(),
  TransTime: z.string(),
  TransAmount: z.string(),
  BusinessShortCode: z.string(),
  BillRefNumber: z.string().optional(),
  InvoiceNumber: z.string().optional(),
  OrgAccountBalance: z.string().optional(),
  ThirdPartyTransID: z.string().optional(),
  MSISDN: z.string(),
  FirstName: z.string().optional(),
  MiddleName: z.string().optional(),
  LastName: z.string().optional(),
})

function db() {
  return databases.use(DB_ID)
}

export const Route = createFileRoute('/_api/mpesa-callback')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = await request.text()
          const payload = JSON.parse(body)

          const result = callbackSchema.safeParse(payload)
          if (!result.success) {
            return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400 })
          }

          const { MSISDN: phone, TransID: mpesaTransactionId, TransAmount, BillRefNumber } = result.data

          // Find farmer by phone
          const farmersRes = await db()
            .use('farmers')
            .list({ queries: (q) => [q.or(q.equal('phone', phone), q.equal('mpesaNumber', phone)), q.limit(1)] })
          
          if (!farmersRes.rows.length) {
            return new Response(JSON.stringify({ status: 'ignored', reason: 'farner not found' }), { status: 200 })
          }
          const farmer = farmersRes.rows[0]

          // Find active/overdue loans for farmer
          const loansRes = await db()
            .use('loans')
            .list({ queries: (q) => [
              q.equal('farmerId', farmer.$id),
              q.or(q.equal('status', 'active'), q.equal('status', 'overdue')),
              q.limit(10)
            ] })

          let loanToUpdate = null
          if (BillRefNumber && loansRes.rows.length > 0) {
            // Try to match by BillRefNumber (loan ID)
            loanToUpdate = loansRes.rows.find((l: any) => l.$id === BillRefNumber)
          }
          if (!loanToUpdate && loansRes.rows.length === 1) {
            // If only one active loan, use it
            loanToUpdate = loansRes.rows[0]
          }

          if (!loanToUpdate) {
            return new Response(JSON.stringify({ status: 'ignored', reason: 'no matching loan' }), { status: 200 })
          }

          // Check if transaction already exists (idempotency)
          const existingTx = await db()
            .use('transactions')
            .list({ queries: (q) => [q.equal('mpesaReceiptNumber', mpesaTransactionId), q.limit(1)] })
          if (existingTx.rows.length > 0) {
            return new Response(JSON.stringify({ status: 'already processed' }), { status: 200 })
          }

          const amount = parseFloat(TransAmount)
          const now = new Date().toISOString()

          // Create transaction record
          await db().use('transactions').create({
            createdBy: 'mpesa-callback',
            farmerId: farmer.$id,
            loanId: loanToUpdate.$id,
            mpesaReceiptNumber: mpesaTransactionId,
            amount,
            type: 'repayment',
            timestamp: now,
            callbackPayload: JSON.stringify({ source: 'c2b-callback', phone, payload: result.data }),
          })

          // Update loan status to repaid
          await db().use('loans').update(loanToUpdate.$id, { status: 'repaid' })

          // Recalculate trust score
          const allLoans = await db()
            .use('loans')
            .list({ queries: (q) => [q.equal('farmerId', farmer.$id), q.limit(200)] })
          const newScore = calcTrustScore(allLoans.rows)
          const uniqueSeasons = new Set(allLoans.rows.map((l: any) => l.season).filter(Boolean)).size
          await db().use('farmers').update(farmer.$id, {
            trustScore: newScore,
            seasonsActive: uniqueSeasons,
          })

          return new Response(JSON.stringify({ 
            status: 'ok', 
            loanId: loanToUpdate.$id, 
            trustScore: newScore 
          }), { status: 200 })
        } catch (error) {
          console.error('M-Pesa callback error:', error)
          return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
        }
      },
    },
  },
})
