// One-time setup: creates the TripAlong Plus product + prices in Stripe LIVE mode.
// Usage:
//   STRIPE_SECRET_KEY=sk_live_xxx node scripts/setup-stripe-live.js
//
// After it runs, copy the printed price IDs into your production env vars
// (e.g. Vercel → Project Settings → Environment Variables):
//   STRIPE_PLUS_MONTHLY_PRICE_ID
//   STRIPE_PLUS_ANNUAL_PRICE_ID

const Stripe = require('stripe')

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('Missing STRIPE_SECRET_KEY. Run as: STRIPE_SECRET_KEY=sk_live_xxx node scripts/setup-stripe-live.js')
  process.exit(1)
}
if (!key.startsWith('sk_live_')) {
  console.error(`STRIPE_SECRET_KEY doesn't look like a live key (expected sk_live_..., got ${key.slice(0, 8)}...). Aborting so we don't create test-mode products by mistake.`)
  process.exit(1)
}

const stripe = new Stripe(key, { apiVersion: '2026-05-27.dahlia' })

async function main() {
  const product = await stripe.products.create({
    name: 'TripAlong Plus',
    description: 'Unlimited swipes, profile views, and compatibility scores.',
  })
  console.log(`Created product: ${product.id}`)

  const monthly = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: 699, // $6.99
    recurring: { interval: 'month' },
    nickname: 'Plus Monthly',
  })
  console.log(`Created price (monthly, $6.99/mo): ${monthly.id}`)

  const annual = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: 3999, // $39.99
    recurring: { interval: 'year' },
    nickname: 'Plus Annual',
  })
  console.log(`Created price (annual, $39.99/yr): ${annual.id}`)

  console.log('\nSet these in your production environment:')
  console.log(`STRIPE_PLUS_MONTHLY_PRICE_ID=${monthly.id}`)
  console.log(`STRIPE_PLUS_ANNUAL_PRICE_ID=${annual.id}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
