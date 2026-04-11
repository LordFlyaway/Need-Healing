import { useEffect, useMemo, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { toast } from 'sonner'

export default function AmbulanceMode() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const uid = params.get('uid')
  const [patient, setPatient] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      if (!uid) {
        setLoading(false)
        return
      }
      try {
        const snap = await getDoc(doc(db, 'users', uid))
        if (snap.exists()) {
          setPatient(snap.data())
        } else {
          toast.error('Patient emergency profile was not found.')
        }
      } catch (error) {
        console.error('Emergency profile lookup failed:', error)
        toast.error('Unable to load emergency profile.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [uid])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <p className="text-2xl animate-pulse text-white">Loading patient data...</p>
    </div>
  )

  if (!patient) {
    return (
      <div className="min-h-screen p-6 font-mono flex items-center justify-center bg-[#0f172a] text-white">
        <div className="max-w-lg text-center p-8 rounded-2xl bg-[#1e293b] border border-[#334155]">
          <h1 className="text-3xl font-bold mb-3">Profile Unavailable</h1>
          <p className="opacity-70">
            This QR code does not have a readable emergency profile attached yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 font-mono flex items-center justify-center bg-[#0f172a] text-white">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="flex flex-col items-center gap-3 mb-10 text-center">
          <span className="bg-red-500/20 text-red-500 border border-red-500/30 text-xs font-bold px-4 py-1.5 rounded-full animate-pulse tracking-widest cursor-default">
            EMERGENCY MODE
          </span>
          <h1 className="text-3xl font-bold tracking-widest text-[#e2e8f0]">PATIENT DATA</h1>
        </div>

      {/* Critical info - large text for paramedics */}
      <div className="grid gap-4">
        <InfoCard label="NAME" value={patient?.name} />
        <InfoCard
          label="BLOOD GROUP"
          value={patient?.blood_group}
          highlight
        />
        <InfoCard
          label="ALLERGIES"
          value={patient?.allergies || 'None known'}
          danger={Boolean(patient?.allergies)}
        />
        <InfoCard
          label="EMERGENCY CONTACT"
          value={`${patient?.emergency_contact?.name || 'Not set'} - ${patient?.emergency_contact?.phone || 'No phone'}`}
          phone={patient?.emergency_contact?.phone}
        />
      </div>

      <p className="mt-12 opacity-50 text-xs text-center tracking-wider">
        Limited access | MediVault Emergency Protocol
      </p>
      </div>
    </div>
  )
}

function InfoCard({ label, value, highlight, danger, phone }) {
  // Use specific hex classes or styles so Tailwind doesn't miss them
  const cardStyle = highlight
    ? { background: '#f59e0b', color: '#000', border: '1px solid #d97706' } // yellow warning
    : danger
    ? { background: '#7f1d1d', color: '#fff', border: '1px solid #991b1b' } // red danger
    : { background: '#1e293b', color: '#fff', border: '1px solid #334155' }; // normal dark blue

  return (
    <div className="rounded-2xl p-6 transition-all" style={cardStyle}>
      <p className="text-xs font-bold tracking-widest opacity-70 mb-1.5 uppercase">{label}</p>
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      {phone && (
        <a href={`tel:${phone}`}
          className="mt-4 inline-block px-5 py-2.5 rounded-xl text-sm font-bold tracking-wide border border-current hover:opacity-80 transition-opacity">
          📞 CALL NOW
        </a>
      )}
    </div>
  )
}
