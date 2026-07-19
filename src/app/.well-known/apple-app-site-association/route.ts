// Apple Universal Links association file for the TripAlong iOS app.
//
// Must be served at exactly /.well-known/apple-app-site-association — no
// extension, Content-Type: application/json, and no redirect (Apple's swcd
// fetches this once at install/first-launch and caches it; a redirect or
// wrong content-type makes verification silently fail). A Route Handler
// guarantees the header regardless of how static assets are served.
// https://developer.apple.com/documentation/xcode/supporting-associated-domains
//
// Team ID (799QG978R6) comes from the TagAlong provisioning profile
// (application-identifier "799QG978R6.com.vibecode.tagalong") — verify this
// is still the Apple Developer Team used for App Store submission before
// relying on it.
export const dynamic = 'force-static'

const APPLE_TEAM_ID = '799QG978R6'
const BUNDLE_ID = 'com.vibecode.tagalong'

const AASA = {
  applinks: {
    apps: [] as string[],
    details: [
      {
        appID: `${APPLE_TEAM_ID}.${BUNDLE_ID}`,
        paths: ['/trip/*'],
      },
    ],
  },
}

export async function GET() {
  return new Response(JSON.stringify(AASA), {
    headers: {
      'Content-Type': 'application/json',
    },
  })
}
