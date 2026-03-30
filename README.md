# GroupFlux

> Farmer-first group lending platform powered by M-Pesa and Appwrite.

**Live demo:** [group-flux.vercel.app](https://group-flux.vercel.app)

GroupFlux bridges the gap between smallholder farmers and financial institutions. Farmers join lending groups, repay loans via M-Pesa, and earn verifiable trust scores — unlocking access to formal credit that was previously out of reach.

Built for the **M-Pesa × GoMyCode Hackathon** under the Farmer Payments challenge area.

---

## The Problem

Banks consider smallholder farmers high-risk and rarely issue loans to them. Yet group lending platforms like One Acre Fund report repayment rates above 98% — higher than most retail borrowers. That repayment track record is invisible to the formal financial system.

**GroupFlux makes it visible.**

Every M-Pesa repayment is a timestamped, verifiable event. We aggregate those events into a portable trust score that banks, SACCOs, and investors can independently query — giving farmers a credit identity built on real behaviour, not collateral.

---

## How It Works

Farmers are organised into groups, each with a group leader who determines membership and loan amounts. Group accountability is the core mechanism — if a member defaults, the group leader misses the next lending round, creating strong social incentives for repayment.

```
Lender disburses loan → M-Pesa B2C to farmer wallets
        ↓
Farmer repays → M-Pesa STK Push
        ↓
Safaricom callback → Appwrite Function
        ↓
Transaction recorded → Trust score updated
        ↓
Farmer earns GroupFlux Verified badge
        ↓
Bank / investor queries badge via portal
```

---

## Features

- **Group management** — create and manage lending groups with leaders and members
- **Loan disbursement** — disburse loans to groups via M-Pesa B2C
- **M-Pesa repayments** — collect repayments via STK Push with real-time callback processing
- **Trust score engine** — automatic score calculation based on repayment history and seasons active
- **Farmer profiles** — individual scorecards with repayment timelines and GroupFlux Verified badges
- **Investor dashboard** — portfolio performance, yield projections, and group-level analytics
- **Bank verification portal** — public endpoint for banks to query a farmer's trust score by M-Pesa number or farmer ID

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React, TanStack Router, TanStack Query |
| Styling | Tailwind CSS, shadcn/ui |
| Backend | Appwrite (Database, Auth, Functions, Realtime) |
| Payments | M-Pesa Daraja API (STK Push, B2C, C2B callbacks) |
| Runtime | Bun |
| Deployment | Vercel |
| Testing | Vitest |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
- An [Appwrite](https://appwrite.io) project set up (or use [Appwrite Cloud](https://cloud.appwrite.io))
- M-Pesa Daraja sandbox credentials from [developer.safaricom.co.ke](https://developer.safaricom.co.ke)

### Install dependencies

```bash
bun install
```

### Configure environment variables

```bash
cp .env.example .env
```

Fill in your `.env`:

```env
# Appwrite
APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
APPWRITE_API_KEY=your_appwrite_api_key
APPWRITE_BUCKET_ID=your_bucket_id
APPWRITE_PROJECT_ID=your_project_id

# M-Pesa Daraja
MPESA_CONSUMER_KEY=your_daraja_consumer_key
MPESA_CONSUMER_SECRET=your_daraja_consumer_secret
MPESA_SHORTCODE=your_mpesa_shortcode
MPESA_PASSKEY=your_mpesa_passkey
MPESA_CALLBACK_URL=https://your-domain.com/api/mpesa/callback

# Optional
VITE_INSTRUMENTATION_SCRIPT_SRC=
```

### Run in development

```bash
bun run dev
```

App runs at `http://localhost:3000`.

---

## Database Collections

| Collection | Key fields |
|---|---|
| `farmers` | id, name, phone, mpesaNumber, groupId, role, trustScore, seasonsActive |
| `groups` | id, name, region, crop, leaderId, status, repaymentRate |
| `loans` | id, farmerId, groupId, amount, season, status, disbursedAt, dueDate |
| `transactions` | id, farmerId, loanId, mpesaReceiptNumber, amount, type, callbackPayload |
| `investors` | id, name, email, type, capitalDeployed, targetYield, groupIds |

---

## M-Pesa Integration

GroupFlux uses three Daraja API flows:

**STK Push (C2B)** — farmer repayments. The platform sends a push notification to the farmer's M-Pesa phone. On PIN confirmation, Safaricom hits the callback URL handled by the `mpesa-callback` Appwrite Function, which stores the transaction and updates the trust score in real time.

**B2C** — loan disbursements. The lender triggers a B2C payment sending loan funds directly to each farmer's M-Pesa wallet.

**C2B** — group collections. Supports bulk repayment collection from group members via a shared shortcode.

---

## Trust Score Calculation

```
score = (repaid loans / total loans) × 60
      + min(seasons active × 5, 30)
      + 10 if zero defaults ever
```

Scores range 0–100. Farmers scoring 80 or above earn a **GroupFlux Verified** badge — visible on their profile and queryable via the bank verification portal. This badge is the portable credit credential that unlocks access to formal lenders.

---

## User Roles

| Role | Auth method | Access |
|---|---|---|
| Farmer | Phone OTP | Own profile, repayment history |
| Group Leader | Phone OTP | Group dashboard, member management |
| Lender / Admin | Email + password | All groups, disbursements, full farmer data |
| Investor | Email + password | Portfolio dashboard, group analytics |
| Bank officer | Public portal | Trust score lookup only (no login required) |

---

## Project Structure

```
src/
  routes/
    __root.tsx              # Root layout and nav
    index.tsx               # Lender dashboard / overview
    farmer.$id.tsx          # Individual farmer profile
    investor.tsx            # Investor dashboard
    verify.tsx              # Public bank verification portal
    sign-in.tsx
    sign-up.tsx
    forgot-password.tsx
    reset-password.tsx
  components/
    GroupCard.tsx
    FarmerRow.tsx
    TrustBadge.tsx
    MpesaPanel.tsx
    InvestorTiers.tsx
  lib/
    appwrite.ts             # Appwrite client setup
    trustScore.ts           # Score calculation logic
    mpesa.ts                # Daraja API helpers
  data/
    seed.ts                 # Demo data for hackathon
```

---

## Scripts

```bash
bun run dev           # Start development server
bun run build         # Production build
bun run start         # Run production server
bun run test          # Run tests with Vitest
bun run lint          # Lint with ESLint
bun run format        # Format with Prettier
bun run format:check  # Check formatting
```

---

## Deploying

The project is pre-configured for Vercel (`vercel.json` included). To deploy:

```bash
bun run build
vercel deploy
```

For M-Pesa callbacks to work in production, set `MPESA_CALLBACK_URL` to your Vercel deployment URL and register it with Safaricom's Daraja portal.

---

## Adding UI Components

This project uses shadcn/ui. Add components with:

```bash
pnpx shadcn@latest add button
pnpx shadcn@latest add card
pnpx shadcn@latest add badge
pnpx shadcn@latest add table
```

---

## Team

**Group Flux** — M-Pesa × GoMyCode Hackathon 2026

---

## License

MIT
