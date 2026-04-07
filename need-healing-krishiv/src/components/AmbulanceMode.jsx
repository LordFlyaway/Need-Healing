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
    <div className="min-h-screen bg-red-900 flex items-center justify-center">
      <p className="text-white text-2xl animate-pulse">Loading patient data...</p>
    </div>
  )

  if (!patient) {
    return (
      <div className="min-h-screen bg-red-900 text-white p-6 font-mono flex items-center justify-center">
        <div className="max-w-lg text-center">
          <h1 className="text-3xl font-bold mb-3">Emergency Profile Unavailable</h1>
          <p className="text-red-100">
            This QR code does not have a readable emergency profile attached yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-red-900 text-white p-6 font-mono">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse">
          EMERGENCY
        </span>
        <h1 className="text-2xl font-bold tracking-wide">PATIENT DATA</h1>
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

      <p className="mt-8 text-red-300 text-xs text-center">
        Limited access | MediVault Emergency Mode
      </p>
    </div>
  )
}

function InfoCard({ label, value, highlight, danger, phone }) {
  return (
    <div className={`rounded-2xl p-5 ${
      highlight ? 'bg-yellow-400 text-black' :
      danger    ? 'bg-red-700' :
                  'bg-red-800'
    }`}>
      <p className="text-xs font-bold tracking-widest opacity-70 mb-1">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      {phone && (
        <a href={`tel:${phone}`}
          className="mt-2 inline-block bg-white/20 px-4 py-2 rounded-lg text-sm">
          Call now
        </a>
      )}
    </div>
  )
}
