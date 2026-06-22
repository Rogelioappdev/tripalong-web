import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  if (cookieStore.get('ta_access')?.value !== 'true') {
    redirect('/')
  }
  return <>{children}</>
}
