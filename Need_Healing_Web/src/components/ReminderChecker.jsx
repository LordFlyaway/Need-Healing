import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

export function ReminderChecker({ reminders }) {
  const triggeredTimes = useRef(new Set()); // Track triggered times to prevent multi-fires

  useEffect(() => {
    const check = () => {
      const now = new Date()
      const hhmm = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`
      const day = now.toLocaleDateString('en', { weekday: 'short' }).toLowerCase()

      reminders.forEach(r => {
        if (!r.active) return
        if (r.days.includes(day) && r.times.includes(hhmm)) {
          const triggerId = `${r.id}-${hhmm}-${now.getDate()}`; // unique per med, time, and day-of-month
          if (!triggeredTimes.current.has(triggerId)) {
            triggeredTimes.current.add(triggerId);
            
            // Browser notification
            if (Notification.permission === 'granted') {
              new Notification(`Take ${r.med_name}`, {
                body: `Dose: ${r.dosage}`,
                icon: '/vite.svg'
              })
            }
            // In-app toast fallback
            toast.warning(`Reminder: Take ${r.med_name} - ${r.dosage}`);
          }
        }
      })
    }

    // Ask permission once
    if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission()
    }
    
    // Check every 10 seconds to ensure we don't skip the minute mark, 
    // but the `triggeredTimes` Set ensures it only fires once per trigger window.
    const id = setInterval(check, 10000)
    check() // run immediately
    return () => clearInterval(id)
  }, [reminders])

  return null
}
