import Stripe from 'stripe'

// Lazy init — avoids throwing at build time when STRIPE_SECRET_KEY is absent
let _stripe: Stripe | null = null
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!_stripe) {
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-05-27.dahlia' })
    }
    const val = (_stripe as unknown as Record<string | symbol, unknown>)[prop]
    return typeof val === 'function' ? val.bind(_stripe) : val
  },
})

export const PLANS = {
  plus_monthly: {
    priceId: process.env.STRIPE_PLUS_MONTHLY_PRICE_ID!,
    tier: 'plus' as const,
    label: 'Plus Monthly',
    amount: 699,
    interval: 'month' as const,
  },
  plus_annual: {
    priceId: process.env.STRIPE_PLUS_ANNUAL_PRICE_ID!,
    tier: 'plus' as const,
    label: 'Plus Annual',
    amount: 3999,
    interval: 'year' as const,
  },
  pro_monthly: {
    priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID!,
    tier: 'pro' as const,
    label: 'Pro Monthly',
    amount: 1499,
    interval: 'month' as const,
  },
  pro_annual: {
    priceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID!,
    tier: 'pro' as const,
    label: 'Pro Annual',
    amount: 9999,
    interval: 'year' as const,
  },
} as const

export type PlanKey = keyof typeof PLANS
