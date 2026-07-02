import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const hasBetaCookie = cookieStore.get('ta_access')?.value === 'true'
  const gateSkipped = process.env.NEXT_PUBLIC_SKIP_ACCESS_GATE === 'true'
  if (!hasBetaCookie && !gateSkipped) {
    redirect('/')
  }
  return <>{children}</>
}
