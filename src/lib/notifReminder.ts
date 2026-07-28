// Fire-and-forget nudge to remind users to turn on notifications after a key
// action (sending a message, creating or joining a trip). A single
// <NotifReminderHost> (mounted in the protected layout) listens for these and
// shows a small toast — only if notifications aren't already on, and throttled
// so it never nags. Call this from anywhere; no state threading needed.

export type NotifTrigger = 'message' | 'create-trip' | 'join-trip'

export function remindNotifications(trigger: NotifTrigger): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('ta:notif-reminder', { detail: trigger }))
}
