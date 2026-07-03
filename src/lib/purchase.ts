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
