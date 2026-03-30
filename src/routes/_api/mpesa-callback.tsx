import { createFileRoute } from '@tanstack/react-router'
import { databases } from '@/server/lib/db'
import { calcTrustScore } from '@/server/functions/groupflux'

const DB_ID = 'imagine-project-db'

function db() {
  return databases.use(DB_ID)
}

export const Route = createFileRoute('/_api/mpesa-callback')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get('content-type') || ''
          let body: any
          if (contentType.includes('application/json')) {
            body = await request.json()
          } else {
            const formData = await request.formData()
            body = Object.fromEntries(formData.entries())
          }

          // Normalize keys
          const normalized: any = {}
          for (const [k, v] of Object.entries(body)) {
            const lower = k.toLowerCase()
            if (lower === 'transid') normalized.TransID = v
            if (lower === 'transamount') normalized.TransAmount = v
            if (lower === 'businessshortcode') normalized.BusinessShortCode = v
            if (lower === 'billrefnumber') normalized.BillRefNumber = v
            if (lower === 'msisdn' || lower === 'phone') normalized.MSISDN = v
            if (lower === 'transtime') normalized.TransTime = v
            if (lower === 'firstname') normalized.FirstName = v
            if (lower === 'middlename') normalized.MiddleName = v
            if (lower === 'lastname') normalized.LastName = v
          }

          if (!normalized.TransID || !normalized.TransAmount || !normalized.BusinessShortCode || !normalized.MSISDN) {
            return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 })
          }

          const mpesaTransactionId = normalized.TransID
          const amount = Number(normalized.TransAmount)
          const phone = normalized.MSISDN
          const shortcode = normalized.BusinessShortCode
          const billRef = normalized.BillRefNumber

          const expectedShortcode = import.meta.env.MPESA_SHORTCODE
          if (expectedShortcode && shortcode !== expectedShortcode) {
            return new Response(JSON.stringify({ error: 'Shortcode mismatch' }), { status: 400 })
          }

          // Find farmer
          const farmersRes = await db()
            .use('farmers')
            .list({ queries: (q) => [q.or(q.equal('phone', phone), q.equal('mpesaNumber', phone)), q.limit(1)] })
          if (farmersRes.rows.length === 0) {
            return new Response(JSON.stringify({ status: 'ignored', reason: 'farmer not found' }), { status: 200 })
          }
          const farmer = farmersRes.rows[0]

          // Find active loan
          const loansRes = await db()
            .use('loans')
            .list({ queries: (q) => [
              q.equal('farmerId', farmer.$id),
              q.or(q.equal('status', 'active'), q.equal('status', 'overdue')),
              q.limit(10)
            ] })

          let loanToUpdate: any = null
          if (billRef) {
            loanToUpdate = loansRes.rows.find((l: any) => l.$id === billRef)
          }
          if (!loanToUpdate && loansRes.rows.length > 0) {
            loanToUpdate = loansRes.rows.sort((a: any, b: any) =>
              new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime()
            )[0]
          }

          if (!loanToUpdate) {
            return new Response(JSON.stringify({ status: 'ignored', reason: 'no matching active loan' }), { status: 200 })
          }

          // Idempotency
          const existingTxRes = await db()
            .use('transactions')
            .list({ queries: (q) => [q.equal('mpesaReceiptNumber', mpesaTransactionId), q.limit(1)] })
          if (existingTxRes.rows.length > 0) {
            return new Response(JSON.stringify({ status: 'already processed' }), { status: 200 })
          }

          const now = new Date().toISOString()
          await db().use('transactions').create({
            createdBy: 'mpesa-callback',
            farmerId: farmer.$id,
            loanId: loanToUpdate.$id,
            mpesaReceiptNumber: mpesaTransactionId,
            amount,
            type: 'repayment',
            timestamp: now,
            callbackPayload: JSON.stringify({
              source: 'c2b-callback',
              phone,
              shortcode,
              billRef,
              raw: normalized,
            }),
          })

          await db().use('loans').update(loanToUpdate.$id, { status: 'repaid' })

          // Recalculate trust score
          const allLoansRes = await db()
            .use('loans')
            .list({ queries: (q) => [q.equal('farmerId', farmer.$id), q.limit(200)] })
          const allLoans = allLoansRes.rows
          const newScore = calcTrustScore(allLoans)
          const uniqueSeasons = new Set(allLoans.map((l: any) => l.season).filter(Boolean)).size
          await db().use('farmers').update(farmer.$id, {
            trustScore: newScore,
            seasonsActive: uniqueSeasons,
          })

          return new Response(JSON.stringify({
            status: 'ok',
            loanId: loanToUpdate.$id,
            trustScore: newScore,
            transactionId: mpesaTransactionId,
          }), { status: 200 })
        } catch (err) {
          console.error('C2B callback error:', err)
          return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 })
        }
      },
    },
  },
})
