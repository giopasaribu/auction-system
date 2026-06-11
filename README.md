# Guild Bid System

A web-based auction system for distributing guild items among members using a points-based bidding model.

## Features

- Admin manages players, point balances, and auction items
- Players bid on multiple live auctions simultaneously using held-points
- Hard cutoff and anti-snipe timer modes per item
- Public dashboard with live bid history and results
- Atomic bid transactions — no double-spend or race conditions

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS)
- **Prisma 7** + **PostgreSQL** (Neon)
- **shadcn/ui** (base-ui) for components
- **SWR** for real-time polling
- **iron-session** for lightweight auth

## Getting Started

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in your database URL and secrets.

3. Run the database migration:
   ```bash
   npx prisma migrate dev --name init
   ```

4. Start the dev server:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000).

## Deploy

Designed to deploy for free on **Vercel** (app) + **Neon** (database). Add `DATABASE_URL`, `ADMIN_PASSWORD`, and `SESSION_SECRET` to your Vercel project environment variables.

## License

MIT
