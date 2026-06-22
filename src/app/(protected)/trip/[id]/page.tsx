import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import TripLandingClient from './TripLandingClient'

const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params

  const { data } = await supabasePublic
    .from('trips')
    .select(`
      destination, country, cover_image, description,
      members:trip_members(count)
    `)
    .eq('id', id)
    .single()

  if (!data) {
    return {
      title: 'Join TripAlong',
      description: 'Find your travel crew on TripAlong.',
      openGraph: {
        title: 'Join TripAlong',
        description: 'Find your travel crew on TripAlong.',
        siteName: 'TripAlong',
      },
    }
  }

  const place = `${data.destination}${data.country ? `, ${data.country}` : ''}`
  const count = (data.members as any)?.[0]?.count ?? 0

  const title = `Join our trip to ${place}! 🌍`
  const description = data.description?.trim()
    ? data.description.slice(0, 140) + (data.description.length > 140 ? '…' : '')
    : `${count > 0 ? `${count} travelers are heading to ${place}` : `Trip to ${place}`}. Come join us on TripAlong!`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'TripAlong',
      type: 'website',
      ...(data.cover_image && {
        images: [{ url: data.cover_image, width: 1200, height: 630, alt: `Trip to ${place}` }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(data.cover_image && { images: [data.cover_image] }),
    },
  }
}

export default function TripPage() {
  return <TripLandingClient />
}
