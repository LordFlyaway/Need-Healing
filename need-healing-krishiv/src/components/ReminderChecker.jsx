// components/ReminderChecker.jsx
// Mount once at app root - checks every minute
import { useEffect } from 'react'
import { toast } from 'sonner'

export function ReminderChecker({ reminders }) {
  useEffect(() => {
    const check = () => {
      const now = new Date()
      const hhmm = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`
      const day = now.toLocaleDateString('en', { weekday: 'short' }).toLowerCase()

      reminders.forEach(r => {
        if (!r.active) return
        if (r.days.includes(day) && r.times.includes(hhmm)) {
          // Browser notification
          if (Notification.permission === 'granted') {
            new Notification(`Take ${r.med_name}`, {
              body: `Dose: ${r.dosage}`,
              icon: '/icon.png'
            })
          }
          // In-app toast fallback
          toast(`${r.med_name} - ${r.dosage}`)
        }
      })
    }

    // Ask permission once
    Notification.requestPermission()
    const id = setInterval(check, 60_000)
    check() // run immediately
    return () => clearInterval(id)
  }, [reminders])

  return null
}
