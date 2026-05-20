'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import { createProfile, updateProfile } from '@/lib/queries'

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Australia','Austria','Bangladesh','Belgium','Bolivia','Brazil',
  'Cambodia','Canada','Chile','China','Colombia','Croatia','Czech Republic','Denmark','Ecuador','Egypt',
  'Ethiopia','Finland','France','Germany','Ghana','Greece','Guatemala','Honduras','Hungary','India',
  'Indonesia','Iran','Iraq','Ireland','Israel','Italy','Japan','Jordan','Kenya','South Korea',
  'Malaysia','Mexico','Morocco','Myanmar','Nepal','Netherlands','New Zealand','Nigeria','Norway','Pakistan',
  'Panama','Peru','Philippines','Poland','Portugal','Romania','Russia','Saudi Arabia','Senegal','Serbia',
  'Singapore','South Africa','Spain','Sri Lanka','Sweden','Switzerland','Taiwan','Tanzania','Thailand',
  'Turkey','Uganda','Ukraine','United Kingdom','United States','Uruguay','Uzbekistan','Venezuela','Vietnam','Zimbabwe',
]

const CITIES: Record<string, string[]> = {
  'United States': ['New York','Los Angeles','Chicago','Houston','Phoenix','Philadelphia','San Antonio','San Diego','Dallas','San Jose','Austin','San Francisco','Seattle','Denver','Boston','Miami','Atlanta','Minneapolis','Portland','Las Vegas'],
  'United Kingdom': ['London','Birmingham','Manchester','Glasgow','Liverpool','Bristol','Sheffield','Leeds','Edinburgh','Leicester'],
  'Canada': ['Toronto','Montreal','Vancouver','Calgary','Edmonton','Ottawa','Winnipeg','Quebec City','Hamilton','Kitchener'],
  'Australia': ['Sydney','Melbourne','Brisbane','Perth','Adelaide','Gold Coast','Canberra','Hobart','Darwin'],
  'Germany': ['Berlin','Hamburg','Munich','Cologne','Frankfurt','Stuttgart','Düsseldorf','Dortmund','Essen','Leipzig'],
  'France': ['Paris','Marseille','Lyon','Toulouse','Nice','Nantes','Strasbourg','Montpellier','Bordeaux','Lille'],
  'Spain': ['Madrid','Barcelona','Valencia','Seville','Zaragoza','Málaga','Murcia','Palma','Las Palmas','Bilbao'],
  'Italy': ['Rome','Milan','Naples','Turin','Palermo','Genoa','Bologna','Florence','Bari','Catania'],
  'Brazil': ['São Paulo','Rio de Janeiro','Brasília','Salvador','Fortaleza','Belo Horizonte','Manaus','Curitiba','Recife','Porto Alegre'],
  'Mexico': ['Mexico City','Guadalajara','Monterrey','Puebla','Tijuana','León','Juárez','Zapopan','Mérida','Cancún'],
  'Japan': ['Tokyo','Osaka','Nagoya','Sapporo','Fukuoka','Kobe','Kyoto','Kawasaki','Saitama','Hiroshima'],
  'China': ['Shanghai','Beijing','Guangzhou','Shenzhen','Chengdu','Wuhan','Xi\'an','Hangzhou','Chongqing','Nanjing'],
  'India': ['Mumbai','Delhi','Bangalore','Hyderabad','Ahmedabad','Chennai','Kolkata','Pune','Jaipur','Surat'],
  'Argentina': ['Buenos Aires','Córdoba','Rosario','Mendoza','La Plata','Tucumán','Mar del Plata','Salta','Santa Fe','San Juan'],
  'Colombia': ['Bogotá','Medellín','Cali','Barranquilla','Cartagena','Cúcuta','Bucaramanga','Pereira','Santa Marta','Manizales'],
}

const GUIDELINES = [
  { emoji: '✈️', title: 'Real trips only', body: 'Only post genuine travel plans. No fake or promotional trips.' },
  { emoji: '🤝', title: 'Respect the crew', body: 'Treat every traveler with respect. No harassment or discrimination.' },
  { emoji: '📸', title: 'Be yourself', body: 'Use real photos. Authentic profiles build better connections.' },
  { emoji: '🔒', title: 'Keep it safe', body: 'Never share personal financial info or meet in unsafe situations.' },
  { emoji: '🌍', title: 'Leave it better', body: 'Travel responsibly — respect local cultures and the environment.' },
]

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className="h-1.5 rounded-full transition-all duration-300"
          style={{
            width: i === step ? 28 : 6,
            background: i === step ? '#F0EBE3' : 'rgba(255,255,255,0.2)',
          }}
        />
      ))}
    </div>
  )
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [name, setName] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [birthMonth, setBirthMonth] = useState('')
  const [birthDay, setBirthDay] = useState('')
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [countrySearch, setCountrySearch] = useState('')
  const [citySearch, setCitySearch] = useState('')
  const [cityMode, setCityMode] = useState(false)
  const [expandedGuideline, setExpandedGuideline] = useState<number | null>(null)
  const [agreed, setAgreed] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.user_metadata?.full_name) setName(data.user.user_metadata.full_name)
      else if (data.user?.user_metadata?.name) setName(data.user.user_metadata.name)
    })
  }, [])

  const currentYear = new Date().getFullYear()
  const age = birthYear ? currentYear - parseInt(birthYear) - (
    birthMonth && birthDay
      ? new Date(currentYear, parseInt(birthMonth) - 1, parseInt(birthDay)) > new Date() ? 1 : 0
      : 0
  ) : null

  const ageValid = age !== null && age >= 16

  const filteredCountries = COUNTRIES.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  )
  const availableCities = CITIES[country] ?? []
  const filteredCities = availableCities.filter(c =>
    c.toLowerCase().includes(citySearch.toLowerCase())
  )

  const goNext = () => {
    setDirection(1)
    setStep(s => s + 1)
    setError('')
  }
  const goBack = () => {
    setDirection(-1)
    setStep(s => s - 1)
    setError('')
  }

  const handlePhotoUpload = async (file: File) => {
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const ext = file.name.split('.').pop()
      const path = `${user.id}/profile.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      setPhotoUrl(publicUrl)
    } catch (e) {
      setError('Photo upload failed. Try again.')
    } finally {
      setUploading(false)
    }
  }

  const handleComplete = async () => {
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const ageNum = age!
      // Calculate actual birthdate
      const birthDate = birthYear && birthMonth && birthDay
        ? `${birthYear}-${birthMonth.padStart(2,'0')}-${birthDay.padStart(2,'0')}`
        : null

      await createProfile(user.id, user.email ?? '', name.trim(), ageNum)
      await updateProfile(user.id, {
        city: city || null,
        country: country || null,
        ...(photoUrl ? { profile_photo: photoUrl } : {}),
      })
      router.replace('/travel-dna')
    } catch (e) {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const steps = [
    // Step 0: Name + Birthday
    <div key="step0" className="flex flex-col gap-6">
      <ProgressDots step={0} total={4} />
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Basic info</h1>
        <p className="text-white/40 text-sm">Let's get started with your profile</p>
      </div>
      <div>
        <label className="text-white/50 text-xs mb-2 block font-semibold">Your name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Traveler"
          className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3.5 text-white placeholder-white/25 text-sm outline-none focus:border-white/30"
        />
      </div>
      <div>
        <label className="text-white/50 text-xs mb-2 block font-semibold">Birthday</label>
        <div className="grid grid-cols-3 gap-2">
          <select value={birthDay} onChange={e => setBirthDay(e.target.value)}
            className="bg-white/6 border border-white/12 rounded-2xl px-3 py-3.5 text-white text-sm outline-none [color-scheme:dark]">
            <option value="">Day</option>
            {Array.from({length:31},(_,i)=><option key={i+1} value={String(i+1)}>{i+1}</option>)}
          </select>
          <select value={birthMonth} onChange={e => setBirthMonth(e.target.value)}
            className="bg-white/6 border border-white/12 rounded-2xl px-3 py-3.5 text-white text-sm outline-none [color-scheme:dark]">
            <option value="">Month</option>
            {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m,i)=>
              <option key={i} value={String(i+1)}>{m}</option>)}
          </select>
          <select value={birthYear} onChange={e => setBirthYear(e.target.value)}
            className="bg-white/6 border border-white/12 rounded-2xl px-3 py-3.5 text-white text-sm outline-none [color-scheme:dark]">
            <option value="">Year</option>
            {Array.from({length:80},(_,i)=>currentYear-16-i).map(y=>
              <option key={y} value={String(y)}>{y}</option>)}
          </select>
        </div>
        {birthYear && !ageValid && (
          <p className="text-red-400 text-xs mt-2">Must be 16 or older to use TripAlong</p>
        )}
        {ageValid && (
          <p className="text-white/30 text-xs mt-2">Your profile will show your age, not your birth date</p>
        )}
      </div>
      <button
        onClick={goNext}
        disabled={!name.trim() || name.trim().length < 2 || !ageValid}
        className="w-full bg-accent text-black font-bold py-4 rounded-2xl text-sm disabled:opacity-30 mt-2"
      >
        Continue
      </button>
    </div>,

    // Step 1: Location
    <div key="step1" className="flex flex-col gap-4 min-h-0">
      <ProgressDots step={1} total={4} />
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-1">
          {cityMode ? `Cities in ${country}` : 'Where are you based?'}
        </h1>
        <p className="text-white/40 text-sm">
          {cityMode ? 'Select your city' : 'Select your country'}
        </p>
      </div>
      {cityMode ? (
        <>
          <button onClick={() => { setCityMode(false); setCity(''); setCitySearch('') }}
            className="text-accent text-sm self-start">← Change country</button>
          <input value={citySearch} onChange={e => setCitySearch(e.target.value)}
            placeholder="Search cities..."
            className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm outline-none focus:border-white/30" />
          <div className="overflow-y-auto max-h-64 flex flex-col gap-1">
            {filteredCities.length === 0 && citySearch && (
              <button onClick={() => setCity(citySearch)}
                className="text-left px-4 py-3 rounded-2xl border border-dashed border-white/20 text-white/50 text-sm">
                Use "{citySearch}"
              </button>
            )}
            {filteredCities.map(c => (
              <button key={c} onClick={() => setCity(c)}
                className={`text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                  city === c ? 'bg-white/10 text-accent' : 'text-white/60 hover:text-white'
                }`}>
                {city === c && '✓ '}{c}
              </button>
            ))}
          </div>
          <button
            onClick={goNext}
            disabled={!city}
            className="w-full bg-accent text-black font-bold py-4 rounded-2xl text-sm disabled:opacity-30 mt-auto"
          >
            Continue
          </button>
        </>
      ) : (
        <>
          <input value={countrySearch} onChange={e => setCountrySearch(e.target.value)}
            placeholder="Search countries..."
            className="w-full bg-white/6 border border-white/12 rounded-2xl px-4 py-3 text-white placeholder-white/25 text-sm outline-none focus:border-white/30" />
          <div className="overflow-y-auto max-h-72 flex flex-col gap-1">
            {filteredCountries.map(c => (
              <button key={c} onClick={() => { setCountry(c); setCityMode(true); setCitySearch('') }}
                className={`text-left px-4 py-3 rounded-2xl text-sm font-medium transition-all ${
                  country === c ? 'bg-white/10 text-accent' : 'text-white/60 hover:text-white'
                }`}>
                {c}
              </button>
            ))}
          </div>
          <button onClick={goNext} className="text-white/30 text-sm py-2 text-center">Skip for now →</button>
        </>
      )}
    </div>,

    // Step 2: Community guidelines
    <div key="step2" className="flex flex-col gap-4">
      <ProgressDots step={2} total={4} />
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-1">The TripAlong Code</h1>
        <p className="text-white/40 text-sm">Our community standards</p>
      </div>
      <div className="flex flex-col gap-2">
        {GUIDELINES.map((g, i) => (
          <div key={i} className="bg-white/4 border border-white/8 rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandedGuideline(expandedGuideline === i ? null : i)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            >
              <span className="text-xl">{g.emoji}</span>
              <span className="text-white font-semibold text-sm flex-1">{g.title}</span>
              <span className="text-white/30 text-xs">{expandedGuideline === i ? '▲' : '▼'}</span>
            </button>
            {expandedGuideline === i && (
              <div className="px-4 pb-4">
                <p className="text-white/50 text-sm leading-relaxed">{g.body}</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        onClick={() => setAgreed(!agreed)}
        className="flex items-center gap-3 mt-2"
      >
        <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
          agreed ? 'bg-accent border-transparent' : 'border-white/30 bg-transparent'
        }`}>
          {agreed && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
        </div>
        <span className="text-white/60 text-sm">I agree to the TripAlong community guidelines</span>
      </button>
      <button
        onClick={goNext}
        disabled={!agreed}
        className="w-full bg-accent text-black font-bold py-4 rounded-2xl text-sm disabled:opacity-30 mt-2"
      >
        I'm In
      </button>
    </div>,

    // Step 3: Profile photo
    <div key="step3" className="flex flex-col gap-6">
      <ProgressDots step={3} total={4} />
      <div>
        <h1 className="text-3xl font-extrabold text-white mb-1">Put a face to your adventure</h1>
        <p className="text-white/40 text-sm">Profiles with photos get 3× more connections</p>
      </div>
      <button
        onClick={() => fileRef.current?.click()}
        className="mx-auto w-48 aspect-[3/4] rounded-3xl border-2 border-dashed border-white/20 overflow-hidden flex flex-col items-center justify-center gap-3 relative"
      >
        {photoUrl ? (
          <>
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute top-2 right-2 bg-green-500 rounded-full w-6 h-6 flex items-center justify-center text-xs text-white font-bold">✓</div>
          </>
        ) : uploading ? (
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <span className="text-3xl">📷</span>
            <span className="text-white/40 text-sm">Add your photo</span>
          </>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f) }} />
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      <button
        onClick={handleComplete}
        disabled={!photoUrl || loading}
        className="w-full bg-accent text-black font-bold py-4 rounded-2xl text-sm disabled:opacity-30"
      >
        {loading ? 'Setting up...' : 'Start Exploring →'}
      </button>
      <button onClick={handleComplete} disabled={loading}
        className="text-white/25 text-sm text-center py-2">
        Skip for now
      </button>
    </div>,
  ]

  return (
    <main className="min-h-screen bg-black flex flex-col">
      <div className="flex-1 flex flex-col max-w-sm mx-auto w-full px-6 py-12 min-h-0">
        {step > 0 && (
          <button onClick={goBack} className="text-white/30 text-sm mb-4 self-start">← Back</button>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <AnimatePresence custom={direction} mode="wait">
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {steps[step]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </main>
  )
}
