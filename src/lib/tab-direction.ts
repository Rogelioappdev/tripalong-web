const TAB_ROUTES = ['/messages', '/feed', '/profile']

let _dir = 0

// Consume-once: a tab click sets _dir for the single navigation it causes.
// If reading it didn't reset it, it would keep leaking into every later
// navigation for the rest of the session — including router.back() out of a
// chat/DM, which isn't a tab switch and should never animate — and template.tsx
// would keep re-wrapping unrelated pages in the slide/fade transition.
export function getTabDir() {
  const dir = _dir
  _dir = 0
  return dir
}

export function setTabDir(from: string, to: string) {
  const fi = TAB_ROUTES.findIndex(r => from === r || from.startsWith(r + '/'))
  const ti = TAB_ROUTES.findIndex(r => to === r || to.startsWith(r + '/'))
  _dir = fi === -1 || ti === -1 || fi === ti ? 0 : ti > fi ? 1 : -1
}
