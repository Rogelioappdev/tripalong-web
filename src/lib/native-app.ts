// True when running inside the TripAlong native app WebView.
// NOTE: evaluated once at module load — safe for pages loaded well after the
// WebView session starts (feed, chat, messages), where the bridge object is
// already guaranteed to exist. For code that runs on the very first page of a
// fresh WebView session (login, or any critical native-bridge decision before
// a session exists), check `(window as any).ReactNativeWebView` live instead —
// this constant can get frozen at `false` if it evaluates before
// react-native-webview finishes injecting the bridge object.
export const isNativeApp =
  typeof window !== 'undefined' && !!(window as any).ReactNativeWebView
