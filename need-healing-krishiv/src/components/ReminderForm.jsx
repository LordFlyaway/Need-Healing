// components/ReminderForm.jsx — add/edit UI
import { useState } from 'react'

const DAYS = ['mon','tue','wed','thu','fri','sat','sun']

export function ReminderForm({ onSave, onClose }) {
  const [form, setForm] = useState({
    med_name: '', dosage: '', times: ['08:00'], days: DAYS
  })

  const addTime = () =>
    setForm(f => ({ ...f, times: [...f.times, '12:00'] }))

  const toggleDay = (d) =>
    setForm(f => ({
      ...f,
      days: f.days.includes(d)
        ? f.days.filter(x => x !== d)
        : [...f.days, d]
    }))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
        <h2 className="text-lg font-semibold mb-4">Add Reminder</h2>
        <input
          placeholder="Medication name"
          className="w-full border rounded-lg px-3 py-2 mb-3 dark:bg-slate-700"
          value={form.med_name}
          onChange={e => setForm(f => ({ ...f, med_name: e.target.value }))}
        />
        <input
          placeholder="Dosage (e.g. 500mg)"
          className="w-full border rounded-lg px-3 py-2 mb-3 dark:bg-slate-700"
          value={form.dosage}
          onChange={e => setForm(f => ({ ...f, dosage: e.target.value }))}
        />
        <div className="flex gap-2 flex-wrap mb-3">
          {DAYS.map(d => (
            <button
              key={d}
              onClick={() => toggleDay(d)}
              className={`px-3 py-1 rounded-full text-sm border transition
                ${form.days.includes(d)
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'border-gray-300 dark:border-slate-600'}`}
            >{d}</button>
          ))}
        </div>
        {form.times.map((t, i) => (
          <input key={i} type="time" value={t}
            onChange={e => {
              const times = [...form.times]
              times[i] = e.target.value
              setForm(f => ({ ...f, times }))
            }}
            className="border rounded-lg px-3 py-2 mb-2 mr-2 dark:bg-slate-700"
          />
        ))}
        <button onClick={addTime} className="text-sm text-teal-600 mb-4 block">
          + Add time
        </button>
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 border rounded-lg py-2">Cancel</button>
          <button onClick={() => { onSave(form); onClose() }}
            className="flex-1 bg-teal-600 text-white rounded-lg py-2 font-medium">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}