// hooks/useReminders.js
import { useEffect, useState } from 'react'
import { db } from '../firebase'
import {
  collection, onSnapshot, addDoc,
  updateDoc, doc, serverTimestamp
} from 'firebase/firestore'

export function useReminders(patientId) {
  const [reminders, setReminders] = useState([])

  useEffect(() => {
    if (!patientId) return
    const ref = collection(db, 'users', patientId, 'reminders')
    return onSnapshot(ref, snap =>
      setReminders(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
  }, [patientId])

  const addReminder = (data) =>
    addDoc(collection(db, 'users', patientId, 'reminders'), {
      ...data, active: true, created_at: serverTimestamp()
    })

  const toggleReminder = (id, active) =>
    updateDoc(doc(db, 'users', patientId, 'reminders', id), { active })

  return { reminders, addReminder, toggleReminder }
}