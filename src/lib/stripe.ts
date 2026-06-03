import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil',
})

export const PLANS = {
  plus_monthly: {
    priceId: process.env.STRIPE_PLUS_MONTHLY_PRICE_ID!,
    tier: 'plus' as const,
    label: 'Plus Monthly',
    amount: 799,
    interval: 'month' as const,
  },
  plus_annual: {
    priceId: process.env.STRIPE_PLUS_ANNUAL_PRICE_ID!,
    tier: 'plus' as const,
    label: 'Plus Annual',
    amount: 5999,
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
