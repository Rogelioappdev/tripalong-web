// True when running inside the TripAlong native app WebView
export const isNativeApp =
  typeof window !== 'undefined' && !!(window as any).ReactNativeWebView
