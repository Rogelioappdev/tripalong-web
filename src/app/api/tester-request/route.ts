import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const FORMSPREE = 'https://formspree.io/f/xgojwbgp'

export async function POST(req: NextRequest) {
  const { name, age, email, reason } = await req.json()

  if (!name || !age || !email || !reason) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  }

  // Save to Supabase
  const { error: dbError } = await supabase.from('tester_requests').insert({
    name: name.trim(),
    age: Number(age),
    contact: email.trim(),
    reason: reason.trim(),
  })
  if (dbError) console.error('Supabase insert error:', dbError)

  // Forward to Formspree → emails roger072040@gmail.com
  await fetch(FORMSPREE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ name, age, email, reason }),
  })

  return NextResponse.json({ ok: true })
}
