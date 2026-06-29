import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import HangLandingClient from './HangLandingClient'

const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params

  const { data } = await supabasePublic
    .from('hangalongs')
    .select('title, location_name, activity_type, photo_url, description, max_people')
    .eq('id', id)
    .maybeSingle()

  if (!data) {
    return {
      title: 'Join TripAlong',
      description: 'Find your next hangout on TripAlong.',
      openGraph: { title: 'Join TripAlong', description: 'Find your next hangout on TripAlong.', siteName: 'TripAlong' },
    }
  }

  const title = `Join "${data.title}" on TripAlong 🤙`
  const description = data.description?.trim()
    ? data.description.slice(0, 140) + (data.description.length > 140 ? '…' : '')
    : `Hangout in ${data.location_name}. Join us on TripAlong!`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'TripAlong',
      type: 'website',
      ...(data.photo_url && {
        images: [{ url: data.photo_url, width: 1200, height: 630, alt: data.title }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(data.photo_url && { images: [data.photo_url] }),
    },
  }
}

export default function HangPage() {
  return <HangLandingClient />
}
