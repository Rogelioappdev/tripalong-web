import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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
  if (dbError) {
    console.error('Supabase insert error:', dbError)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Email notification via Resend REST API
  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'TripAlong Testers <onboarding@resend.dev>',
        to: ['roger072040@gmail.com'],
        subject: `New tester request — ${name}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="margin:0 0 4px">New tester request ✈️</h2>
            <p style="color:#666;margin:0 0 24px">Someone wants to test TripAlong.</p>
            <table style="width:100%;border-collapse:collapse">
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#999;width:80px">Name</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600">${name}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#999">Age</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600">${age}</td></tr>
              <tr><td style="padding:10px 0;border-bottom:1px solid #eee;color:#999">Email</td><td style="padding:10px 0;border-bottom:1px solid #eee;font-weight:600"><a href="mailto:${email}">${email}</a></td></tr>
              <tr><td style="padding:10px 0;color:#999;vertical-align:top">Why</td><td style="padding:10px 0;line-height:1.6">${reason}</td></tr>
            </table>
          </div>
        `,
      }),
    })
  }

  return NextResponse.json({ ok: true })
}
