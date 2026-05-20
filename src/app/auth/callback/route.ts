import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  // Session is handled client-side by Supabase — just redirect to feed
  return NextResponse.redirect(`${origin}/feed`)
}
