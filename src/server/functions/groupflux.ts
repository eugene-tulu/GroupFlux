import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { databases } from '@/server/lib/db'
import type {
  Farmers,
  Groups,
  Loans,
  Transactions,
  Investors,
} from '@/server/lib/appwrite.types'

const DB_ID = 'imagine-project-db'

function db() {
  return databases.use(DB_ID)
}

// ─── Trust Score Calculation ──────────────────────────────────────────────────
export function calcTrustScore(loans: Loans[]): number {
  if (!loans.length) return 0
  const repaid = loans.filter((l) => l.status === 'repaid').length
  const total = loans.length
  const hasDefaults = loans.some((l) => l.status === 'defaulted')
  const seasonsActive = new Set(loans.map((l) => l.season).filter(Boolean)).size

  const repaymentComponent = Math.round((repaid / total) * 60)
  const seasonsComponent = Math.min(seasonsActive * 5, 30)
  const noDefaultBonus = hasDefaults ? 0 : 10

  return Math.min(100, repaymentComponent + seasonsComponent + noDefaultBonus)
}

// ─── Mock M-Pesa Receipt ─────────────────────────────────────────────────────
export function generateMpesaReceipt(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < 10; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

// ─── LENDER DASHBOARD ────────────────────────────────────────────────────────

export type LenderDashboardData = {
  groups: (Groups & {
    memberCount: number
    leaderName: string
    disbursed: number
    repaid: number
  })[]
  farmers: (Farmers & { groupName: string })[]
  stats: {
    totalDisbursed: number
    overallRepaymentRate: number
    activeFarmers: number
    avgTrustScore: number
  }
}

export const getLenderDataFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const [groupsRes, farmersRes, loansRes] = await Promise.all([
      db()
        .use('groups')
        .list({ queries: (q) => [q.limit(100)] }),
      db()
        .use('farmers')
        .list({ queries: (q) => [q.limit(200)] }),
      db()
        .use('loans')
        .list({ queries: (q) => [q.limit(500)] }),
    ])

    const groups = groupsRes.rows
    const farmers = farmersRes.rows
    const loans = loansRes.rows

    const farmerMap = new Map(farmers.map((f) => [f.$id, f]))

    const enrichedGroups = groups.map((g) => {
      const members = farmers.filter((f) => f.groupId === g.$id)
      const leader = g.leaderId ? farmerMap.get(g.leaderId) : null
      const groupLoans = loans.filter((l) => l.groupId === g.$id)
      const disbursed = groupLoans.reduce((sum, l) => sum + l.amount, 0)
      const repaid = groupLoans
        .filter((l) => l.status === 'repaid')
        .reduce((sum, l) => sum + l.amount, 0)
      return {
        ...g,
        memberCount: members.length,
        leaderName: leader?.name ?? 'Unassigned',
        disbursed,
        repaid,
      }
    })

    const enrichedFarmers = farmers.map((f) => {
      const group = groups.find((g) => g.$id === f.groupId)
      return { ...f, groupName: group?.name ?? 'Unassigned' }
    })

    const totalDisbursed = loans.reduce((sum, l) => sum + l.amount, 0)
    const repaidLoans = loans.filter((l) => l.status === 'repaid')
    const overallRepaymentRate =
      loans.length > 0
        ? Math.round((repaidLoans.length / loans.length) * 100)
        : 0
    const activeFarmers = farmers.length
    const avgTrustScore =
      farmers.length > 0
        ? Math.round(
            farmers.reduce((sum, f) => sum + (f.trustScore ?? 0), 0) /
              farmers.length,
          )
        : 0

    return {
      groups: enrichedGroups,
      farmers: enrichedFarmers,
      stats: {
        totalDisbursed,
        overallRepaymentRate,
        activeFarmers,
        avgTrustScore,
      },
    } as LenderDashboardData
  },
)

export const disburseLoanFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      groupId: z.string().min(1),
      amount: z.number().positive(),
      season: z.string().min(1),
      dueDate: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const { groupId, amount, season, dueDate } = data
    const farmersRes = await db()
      .use('farmers')
      .list({ queries: (q) => [q.equal('groupId', groupId), q.limit(100)] })

    const members = farmersRes.rows
    if (!members.length) throw new Error('No members in this group')

    const now = new Date().toISOString()
    const dueDateVal =
      dueDate ?? new Date(Date.now() + 90 * 86400000).toISOString()

    const loanRows = members.map((farmer) => ({
      createdBy: 'admin',
      farmerId: farmer.$id,
      groupId,
      amount,
      season,
      disbursedAt: now,
      dueDate: dueDateVal,
      status: 'active',
    }))

    const loansResult = await db().use('loans').createMany(loanRows)

    // Create disbursement transactions
    const txRows = loansResult.rows.map((loan) => ({
      createdBy: 'admin',
      farmerId: loan.farmerId,
      loanId: loan.$id,
      mpesaReceiptNumber: generateMpesaReceipt(),
      amount: loan.amount,
      type: 'disbursement',
      timestamp: now,
      callbackPayload: JSON.stringify({ source: 'groupflux-admin', season }),
    }))

    await db().use('transactions').createMany(txRows)

    return { loansCreated: loansResult.rows.length }
  })

// ─── FARMER PROFILE ──────────────────────────────────────────────────────────

export type FarmerProfileData = {
  farmer: Farmers & { groupName: string }
  loans: Loans[]
  transactions: Transactions[]
  totalRepaid: number
}

export const getFarmerProfileFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ farmerId: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { farmerId } = data
    const [farmer, loansRes, txRes] = await Promise.all([
      db().use('farmers').get(farmerId),
      db()
        .use('loans')
        .list({
          queries: (q) => [
            q.equal('farmerId', farmerId),
            q.limit(100),
            q.orderDesc('$createdAt'),
          ],
        }),
      db()
        .use('transactions')
        .list({
          queries: (q) => [q.equal('farmerId', farmerId), q.limit(200)],
        }),
    ])

    let groupName = 'Unassigned'
    if (farmer.groupId) {
      try {
        const group = await db().use('groups').get(farmer.groupId)
        groupName = group.name
      } catch {}
    }

    const repaymentTxs = txRes.rows.filter((t) => t.type === 'repayment')
    const totalRepaid = repaymentTxs.reduce((sum, t) => sum + t.amount, 0)

    return {
      farmer: { ...farmer, groupName },
      loans: loansRes.rows,
      transactions: txRes.rows,
      totalRepaid,
    } as FarmerProfileData
  })

export const recordRepaymentFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      farmerId: z.string().min(1),
      loanId: z.string().min(1),
      amount: z.number().positive(),
    }),
  )
  .handler(async ({ data }) => {
    const { farmerId, loanId, amount } = data
    const receipt = generateMpesaReceipt()
    const now = new Date().toISOString()

    // Create transaction
    await db()
      .use('transactions')
      .create({
        createdBy: 'admin',
        farmerId,
        loanId,
        mpesaReceiptNumber: receipt,
        amount,
        type: 'repayment',
        timestamp: now,
        callbackPayload: JSON.stringify({
          source: 'manual-entry',
          mpesa: receipt,
        }),
      })

    // Update loan status to repaid
    await db().use('loans').update(loanId, { status: 'repaid' })

    // Recalculate trust score
    const allLoans = await db()
      .use('loans')
      .list({ queries: (q) => [q.equal('farmerId', farmerId), q.limit(200)] })

    const newScore = calcTrustScore(allLoans.rows)
    const uniqueSeasons = new Set(
      allLoans.rows.map((l) => l.season).filter(Boolean),
    ).size

    await db().use('farmers').update(farmerId, {
      trustScore: newScore,
      seasonsActive: uniqueSeasons,
    })

    return { receipt, newTrustScore: newScore }
  })

// ─── INVESTOR DASHBOARD ──────────────────────────────────────────────────────

export type InvestorDashboardData = {
  investors: Investors[]
  groups: Groups[]
  loans: Loans[]
  stats: {
    avgYield: number
    defaultRate: number
    totalCapital: number
    activeInvestors: number
  }
  seasonRepayment: { season: string; rate: number }[]
}

export const getInvestorDataFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const [investorsRes, groupsRes, loansRes] = await Promise.all([
      db()
        .use('investors')
        .list({ queries: (q) => [q.limit(200)] }),
      db()
        .use('groups')
        .list({ queries: (q) => [q.limit(100)] }),
      db()
        .use('loans')
        .list({ queries: (q) => [q.limit(500)] }),
    ])

    const investors = investorsRes.rows
    const groups = groupsRes.rows
    const loans = loansRes.rows

    const totalCapital = investors.reduce(
      (sum, i) => sum + (i.capitalDeployed ?? 0),
      0,
    )
    const avgYield =
      investors.length > 0
        ? investors.reduce((sum, i) => sum + (i.targetYield ?? 0), 0) /
          investors.length
        : 12.5
    const defaultedLoans = loans.filter((l) => l.status === 'defaulted').length
    const defaultRate =
      loans.length > 0 ? Math.round((defaultedLoans / loans.length) * 100) : 0
    const activeInvestors = investors.length

    // Group loans by season
    const seasonMap = new Map<string, { total: number; repaid: number }>()
    loans.forEach((l) => {
      const s = l.season ?? 'Unknown'
      const entry = seasonMap.get(s) ?? { total: 0, repaid: 0 }
      entry.total++
      if (l.status === 'repaid') entry.repaid++
      seasonMap.set(s, entry)
    })

    const seasonRepayment = Array.from(seasonMap.entries())
      .map(([season, { total, repaid }]) => ({
        season,
        rate: total > 0 ? Math.round((repaid / total) * 100) : 0,
      }))
      .slice(-6)

    return {
      investors,
      groups,
      loans,
      stats: {
        avgYield: Math.round(avgYield * 10) / 10,
        defaultRate,
        totalCapital,
        activeInvestors,
      },
      seasonRepayment,
    } as InvestorDashboardData
  },
)

export const recordInvestmentFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      name: z.string().min(1),
      email: z.string().email(),
      type: z.enum(['retail', 'institutional']),
      amount: z.number().positive(),
      targetYield: z.number(),
      groupIds: z.array(z.string()).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const investor = await db()
      .use('investors')
      .create({
        createdBy: 'admin',
        name: data.name,
        email: data.email,
        type: data.type,
        capitalDeployed: data.amount,
        targetYield: data.targetYield,
        groupIds: data.groupIds ?? [],
      })
    return { investor: { id: investor.$id, name: investor.name } }
  })

// ─── BANK VERIFICATION ───────────────────────────────────────────────────────

export type VerificationResult = {
  found: boolean
  farmer?: {
    id: string
    name: string
    phone: string
    mpesaNumber: string | null
    groupName: string
    groupRepaymentRate: number
    trustScore: number
    seasonsActive: number
    totalLoans: number
    repaidLoans: number
    recommendation: 'approve' | 'review' | 'high-risk'
  }
}

export const verifyFarmerFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ query: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { query } = data
    let farmers: Farmers[] = []

    // Try by phone/mpesa
    try {
      const byPhone = await db()
        .use('farmers')
        .list({ queries: (q) => [q.equal('phone', query), q.limit(5)] })
      farmers = byPhone.rows
    } catch {}

    if (!farmers.length) {
      try {
        const byMpesa = await db()
          .use('farmers')
          .list({ queries: (q) => [q.equal('mpesaNumber', query), q.limit(5)] })
        farmers = byMpesa.rows
      } catch {}
    }

    // Try by farmer ID directly
    if (!farmers.length) {
      try {
        const byId = await db().use('farmers').get(query)
        farmers = [byId]
      } catch {}
    }

    if (!farmers.length) return { found: false } as VerificationResult

    const farmer = farmers[0]

    let groupName = 'Unassigned'
    let groupRepaymentRate = 0
    if (farmer.groupId) {
      try {
        const group = await db().use('groups').get(farmer.groupId)
        groupName = group.name
        groupRepaymentRate = group.repaymentRate ?? 0
      } catch {}
    }

    const loansRes = await db()
      .use('loans')
      .list({ queries: (q) => [q.equal('farmerId', farmer.$id), q.limit(200)] })
    const loans = loansRes.rows
    const repaidCount = loans.filter((l) => l.status === 'repaid').length
    const score = farmer.trustScore ?? 0
    const recommendation: 'approve' | 'review' | 'high-risk' =
      score >= 80 ? 'approve' : score >= 60 ? 'review' : 'high-risk'

    return {
      found: true,
      farmer: {
        id: farmer.$id,
        name: farmer.name,
        phone: farmer.phone,
        mpesaNumber: farmer.mpesaNumber ?? null,
        groupName,
        groupRepaymentRate,
        trustScore: score,
        seasonsActive: farmer.seasonsActive ?? 0,
        totalLoans: loans.length,
        repaidLoans: repaidCount,
        recommendation,
      },
    } as VerificationResult
  })

// ─── SEED DATA ───────────────────────────────────────────────────────────────

export const seedDemoDataFn = createServerFn({ method: 'POST' }).handler(
  async () => {
    // Create groups
    const groups = await db()
      .use('groups')
      .createMany([
        {
          createdBy: 'admin',
          name: 'Kiambu Maize Cooperative',
          region: 'Kiambu',
          crop: 'Maize',
          status: 'active',
          repaymentRate: 92,
        },
        {
          createdBy: 'admin',
          name: 'Nakuru Dairy Farmers',
          region: 'Nakuru',
          crop: 'Dairy',
          status: 'active',
          repaymentRate: 87,
        },
        {
          createdBy: 'admin',
          name: 'Meru Tea Growers',
          region: 'Meru',
          crop: 'Tea',
          status: 'review',
          repaymentRate: 73,
        },
        {
          createdBy: 'admin',
          name: 'Kisumu Fishing Circle',
          region: 'Kisumu',
          crop: 'Fish',
          status: 'active',
          repaymentRate: 95,
        },
        {
          createdBy: 'admin',
          name: 'Machakos Vegetable Guild',
          region: 'Machakos',
          crop: 'Vegetables',
          status: 'suspended',
          repaymentRate: 41,
        },
      ])

    const g = groups.rows

    // Create farmers
    const farmerData = [
      {
        name: 'Wanjiru Kamau',
        phone: '+254712345678',
        mpesaNumber: '+254712345678',
        role: 'leader',
        groupId: g[0].$id,
        trustScore: 92,
        seasonsActive: 6,
      },
      {
        name: 'Kipchoge Mutai',
        phone: '+254723456789',
        mpesaNumber: '+254723456789',
        role: 'member',
        groupId: g[0].$id,
        trustScore: 85,
        seasonsActive: 4,
      },
      {
        name: 'Achieng Otieno',
        phone: '+254734567890',
        mpesaNumber: '+254734567890',
        role: 'member',
        groupId: g[0].$id,
        trustScore: 78,
        seasonsActive: 3,
      },
      {
        name: 'Muthoni Njoroge',
        phone: '+254745678901',
        mpesaNumber: '+254745678901',
        role: 'leader',
        groupId: g[1].$id,
        trustScore: 88,
        seasonsActive: 5,
      },
      {
        name: 'Ochieng Odhiambo',
        phone: '+254756789012',
        mpesaNumber: '+254756789012',
        role: 'member',
        groupId: g[1].$id,
        trustScore: 65,
        seasonsActive: 2,
      },
      {
        name: 'Njeri Waweru',
        phone: '+254767890123',
        mpesaNumber: '+254767890123',
        role: 'member',
        groupId: g[1].$id,
        trustScore: 91,
        seasonsActive: 7,
      },
      {
        name: 'Karanja Mwangi',
        phone: '+254778901234',
        mpesaNumber: '+254778901234',
        role: 'leader',
        groupId: g[2].$id,
        trustScore: 72,
        seasonsActive: 3,
      },
      {
        name: 'Fatuma Hassan',
        phone: '+254789012345',
        mpesaNumber: '+254789012345',
        role: 'member',
        groupId: g[2].$id,
        trustScore: 58,
        seasonsActive: 2,
      },
      {
        name: 'Otieno Odera',
        phone: '+254790123456',
        mpesaNumber: '+254790123456',
        role: 'leader',
        groupId: g[3].$id,
        trustScore: 96,
        seasonsActive: 8,
      },
      {
        name: 'Mwangi Gitau',
        phone: '+254701234567',
        mpesaNumber: '+254701234567',
        role: 'member',
        groupId: g[3].$id,
        trustScore: 82,
        seasonsActive: 4,
      },
      {
        name: 'Amina Wekesa',
        phone: '+254711234567',
        mpesaNumber: '+254711234567',
        role: 'member',
        groupId: g[4].$id,
        trustScore: 44,
        seasonsActive: 1,
      },
      {
        name: 'Simiyu Barasa',
        phone: '+254722345678',
        mpesaNumber: '+254722345678',
        role: 'leader',
        groupId: g[4].$id,
        trustScore: 38,
        seasonsActive: 1,
      },
    ]

    const farmersResult = await db()
      .use('farmers')
      .createMany(farmerData.map((f) => ({ createdBy: 'admin', ...f })))

    // Update group leaders
    const farmersRows = farmersResult.rows
    const leader0 = farmersRows.find(
      (f) => f.groupId === g[0].$id && f.role === 'leader',
    )
    const leader1 = farmersRows.find(
      (f) => f.groupId === g[1].$id && f.role === 'leader',
    )
    const leader2 = farmersRows.find(
      (f) => f.groupId === g[2].$id && f.role === 'leader',
    )
    const leader3 = farmersRows.find(
      (f) => f.groupId === g[3].$id && f.role === 'leader',
    )
    const leader4 = farmersRows.find(
      (f) => f.groupId === g[4].$id && f.role === 'leader',
    )

    await Promise.all([
      leader0 && db().use('groups').update(g[0].$id, { leaderId: leader0.$id }),
      leader1 && db().use('groups').update(g[1].$id, { leaderId: leader1.$id }),
      leader2 && db().use('groups').update(g[2].$id, { leaderId: leader2.$id }),
      leader3 && db().use('groups').update(g[3].$id, { leaderId: leader3.$id }),
      leader4 && db().use('groups').update(g[4].$id, { leaderId: leader4.$id }),
    ])

    // Create loans for each farmer
    const seasons = [
      'Long Rains 2023',
      'Short Rains 2023',
      'Long Rains 2024',
      'Short Rains 2024',
    ]
    const loanRows = farmersRows.flatMap((farmer) =>
      seasons.slice(0, farmer.seasonsActive ?? 1).map((season, i) => ({
        createdBy: 'admin',
        farmerId: farmer.$id,
        groupId: farmer.groupId ?? g[0].$id,
        amount: 15000 + Math.floor(Math.random() * 35000),
        season,
        disbursedAt: new Date(
          2023 + Math.floor(i / 2),
          (i % 2) * 6,
          1,
        ).toISOString(),
        dueDate: new Date(
          2023 + Math.floor(i / 2),
          (i % 2) * 6 + 3,
          1,
        ).toISOString(),
        status:
          farmer.trustScore >= 80
            ? 'repaid'
            : i < (farmer.seasonsActive ?? 1) - 1
              ? 'repaid'
              : 'active',
      })),
    )

    await db().use('loans').createMany(loanRows)

    // Create investors
    await db()
      .use('investors')
      .createMany([
        {
          createdBy: 'admin',
          name: 'Equity Ventures Ltd',
          email: 'equity@example.co.ke',
          type: 'institutional',
          capitalDeployed: 500000,
          targetYield: 13.5,
          groupIds: [g[0].$id, g[1].$id, g[3].$id],
        },
        {
          createdBy: 'admin',
          name: 'James Kariuki',
          email: 'james@example.co.ke',
          type: 'retail',
          capitalDeployed: 25000,
          targetYield: 11.0,
          groupIds: [g[0].$id],
        },
        {
          createdBy: 'admin',
          name: 'Safaricom Impact Fund',
          email: 'impact@safaricom.ke',
          type: 'institutional',
          capitalDeployed: 1200000,
          targetYield: 12.0,
          groupIds: [g[0].$id, g[1].$id, g[2].$id, g[3].$id],
        },
        {
          createdBy: 'admin',
          name: 'Grace Wambui',
          email: 'grace@example.co.ke',
          type: 'retail',
          capitalDeployed: 8000,
          targetYield: 10.5,
          groupIds: [g[1].$id],
        },
      ])

    return { success: true, groups: g.length, farmers: farmersRows.length }
  },
)
