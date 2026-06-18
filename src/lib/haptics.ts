export function haptic(ms: number | number[]) {
  if (typeof window === 'undefined') return
  // Native bridge: running inside the TripAlong iOS/Android app
  if ((window as any).ReactNativeWebView) {
    ;(window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'haptic', ms }))
    return
  }
  // Android web fallback
  if ('vibrate' in navigator) navigator.vibrate(ms)
}
