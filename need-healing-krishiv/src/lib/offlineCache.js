// lib/offlineCache.js — IndexedDB wrapper
const DB_NAME = 'medivault'
const STORE = 'emergency_data'

export async function saveEmergencyData(data) {
  const db = await openDB()
  const tx = db.transaction(STORE, 'readwrite')
  tx.objectStore(STORE).put({ id: 'local', ...data })
  return tx.complete
}

export async function getEmergencyData() {
  const db = await openDB()
  return db.transaction(STORE).objectStore(STORE).get('local')
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () =>
      req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = reject
  })
}