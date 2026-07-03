import { startCheckout } from './subscription'
import type { PlanKey } from './stripe'

export type BillingInterval = 'monthly' | 'annual'

interface NativePurchaseResult {
  success: boolean
  cancelled?: boolean
  error?: string
}

// Native app (iOS/Android) must use in-app purchase per App Store Review
// Guideline 3.1.1 — routes through RevenueCat via the WebView bridge instead
// of Stripe. Web-only users keep the existing Stripe checkout.
export async function purchasePlus(billing: BillingInterval): Promise<void> {
  const bridge = typeof window !== 'undefined' && (window as any).ReactNativeWebView
  if (bridge) {
    await purchaseViaNative(bridge, billing)
    return
  }
  const planKey: PlanKey = billing === 'annual' ? 'plus_annual' : 'plus_monthly'
  await startCheckout(planKey)
}

function purchaseViaNative(bridge: { postMessage: (msg: string) => void }, billing: BillingInterval): Promise<void> {
  return new Promise((resolve, reject) => {
    ;(window as any).__tripalongPurchaseResult = (result: NativePurchaseResult) => {
      delete (window as any).__tripalongPurchaseResult
      if (result.success) resolve()
      else if (result.cancelled) reject(new Error('cancelled'))
      else reject(new Error(result.error ?? 'Purchase failed. Try again.'))
    }
    bridge.postMessage(JSON.stringify({ type: 'purchase_plus', billing }))
  })
}

// Live check (not the frozen native-app.ts constant) — paywalls can mount
// as soon as any page loads, so this must never read stale.
export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && !!(window as any).ReactNativeWebView
}

// Apple/Google App Store Review requires a Restore Purchases path on any
// screen selling an auto-renewable subscription (Guideline 3.1.2) — native
// only, since Stripe subscriptions are already tied to the logged-in
// account and have nothing to "restore".
export async function restorePurchases(): Promise<void> {
  const bridge = typeof window !== 'undefined' && (window as any).ReactNativeWebView
  if (!bridge) throw new Error('Restore is only available in the app.')

  return new Promise((resolve, reject) => {
    ;(window as any).__tripalongRestoreResult = (result: NativePurchaseResult) => {
      delete (window as any).__tripalongRestoreResult
      if (result.success) resolve()
      else reject(new Error(result.error ?? 'No active purchase found for this account.'))
    }
    bridge.postMessage(JSON.stringify({ type: 'restore_purchases' }))
  })
}

export interface PlusPricing {
  monthly: string | null
  annual: string | null
}

// Native-only: fetches the live, store-formatted price straight from
// RevenueCat/StoreKit, so the paywall always matches what a purchase will
// actually charge (including scheduled App Store price changes) instead of a
// hardcoded string that can silently drift out of date. Resolves null on
// plain web (no bridge) or if the installed app build predates this message
// type — callers should fall back to a static price in that case.
export function getNativePlusPricing(): Promise<PlusPricing | null> {
  const bridge = typeof window !== 'undefined' && (window as any).ReactNativeWebView
  if (!bridge) return Promise.resolve(null)

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      delete (window as any).__tripalongPricingResult
      resolve(null)
    }, 2500)
    ;(window as any).__tripalongPricingResult = (pricing: PlusPricing) => {
      clearTimeout(timeout)
      delete (window as any).__tripalongPricingResult
      resolve(pricing?.monthly && pricing?.annual ? pricing : null)
    }
    bridge.postMessage(JSON.stringify({ type: 'get_plus_pricing' }))
  })
}
