import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';

export function useAccessRequest(patientId) {
  const [request, setRequest] = useState(null);

  useEffect(() => {
    if (!patientId) return;
    const q = query(
      collection(db, "access_requests"),
      where("patientId", "==", patientId),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setRequest({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      } else {
        setRequest(null);
      }
    });

    return () => unsubscribe();
  }, [patientId]);

  const respondToRequest = async (requestId, approved) => {
    const requestRef = doc(db, "access_requests", requestId);
    await updateDoc(requestRef, { status: approved ? "approved" : "denied" });
    setRequest(null);
  };

  return { request, respondToRequest };
}
