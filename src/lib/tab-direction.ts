const TAB_ROUTES = ['/messages', '/feed', '/profile']

let _dir = 0

export function getTabDir() { return _dir }

export function setTabDir(from: string, to: string) {
  const fi = TAB_ROUTES.findIndex(r => from === r || from.startsWith(r + '/'))
  const ti = TAB_ROUTES.findIndex(r => to === r || to.startsWith(r + '/'))
  _dir = fi === -1 || ti === -1 || fi === ti ? 0 : ti > fi ? 1 : -1
}
