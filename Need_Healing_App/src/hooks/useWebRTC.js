import { useState, useRef, useCallback } from 'react';
import { db } from '../firebase';
import { collection, doc, addDoc, onSnapshot, updateDoc, setDoc, getDoc } from 'firebase/firestore';

const servers = {
  iceServers: [
    { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
  ],
  iceCandidatePoolSize: 10,
};

export function useWebRTC() {
  const [connectionState, setConnectionState] = useState('disconnected');
  const [messages, setMessages] = useState([]);
  const pc = useRef(null);
  const dataChannel = useRef(null);
  const connectionId = useRef('');

  // ─── INITIALIZE PEER CONNECTION ──────────────────────────────────────────────
  const initPC = () => {
    if (pc.current) return;
    const peerConnection = new RTCPeerConnection(servers);
    
    peerConnection.onconnectionstatechange = () => {
      setConnectionState(peerConnection.connectionState);
      console.log('WebRTC State:', peerConnection.connectionState);
    };

    pc.current = peerConnection;
  };

  const setupDataChannel = (channel) => {
    channel.onopen = () => {
      console.log('Data channel open!');
      setConnectionState('connected'); // override
    };
    channel.onclose = () => {
      console.log('Data channel closed');
      setConnectionState('disconnected');
    };
    channel.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, data]);
    };
    dataChannel.current = channel;
  };

  // ─── DOCTOR: CREATE ROOM / LISTEN ────────────────────────────────────────────
  // The doctor creates a room and waits for a patient to join via an ID. 
  // For simplicity, doctors have a permanent "queue room" string based on their ID.
  const createTriageQueue = async (doctorId) => {
    initPC();

    // Doctor creates a data channel (since they initiate the room, but patients will send data)
    const channel = pc.current.createDataChannel('triage_queue_channel');
    setupDataChannel(channel);

    const roomRef = doc(db, 'triage_calls', doctorId);
    const callerCandidatesCollection = collection(roomRef, 'callerCandidates');
    
    // Save ICE candidates
    pc.current.onicecandidate = event => {
      if (!event.candidate) return;
      addDoc(callerCandidatesCollection, event.candidate.toJSON());
    };

    // Create SDP Offer
    const offer = await pc.current.createOffer();
    await pc.current.setLocalDescription(offer);

    const roomWithOffer = {
      offer: { type: offer.type, sdp: offer.sdp },
      isPending: true
    };
    await setDoc(roomRef, roomWithOffer);
    connectionId.current = roomRef.id;

    // Listen for Patient answering the offer
    onSnapshot(roomRef, async snapshot => {
      const data = snapshot.data();
      if (!pc.current.currentRemoteDescription && data && data.answer) {
        const rtcSessionDescription = new RTCSessionDescription(data.answer);
        await pc.current.setRemoteDescription(rtcSessionDescription);
      }
    });

    // Listen for Patient ICE candidates
    onSnapshot(collection(roomRef, 'calleeCandidates'), snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          let data = change.doc.data();
          await pc.current.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });
  };

  // ─── PATIENT: JOIN ROOM ──────────────────────────────────────────────────────
  const joinTriageQueue = async (doctorId) => {
    initPC();

    const roomRef = doc(db, 'triage_calls', doctorId);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      console.warn("No active doctor queue found");
      return false;
    }

    const calleeCandidatesCollection = collection(roomRef, 'calleeCandidates');

    pc.current.onicecandidate = event => {
      if (!event.candidate) return;
      addDoc(calleeCandidatesCollection, event.candidate.toJSON());
    };

    pc.current.ondatachannel = (event) => {
      setupDataChannel(event.channel);
    };

    const offer = roomSnap.data().offer;
    await pc.current.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answer);

    const roomWithAnswer = {
      answer: { type: answer.type, sdp: answer.sdp }
    };
    await updateDoc(roomRef, roomWithAnswer);

    connectionId.current = roomRef.id;

    onSnapshot(collection(roomRef, 'callerCandidates'), snapshot => {
      snapshot.docChanges().forEach(async change => {
        if (change.type === 'added') {
          let data = change.doc.data();
          await pc.current.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });

    return true;
  };

  // ─── SEND DATA ───────────────────────────────────────────────────────────────
  const sendData = (payload) => {
    if (dataChannel.current && dataChannel.current.readyState === 'open') {
      dataChannel.current.send(JSON.stringify(payload));
    } else {
      console.error("Data channel not open");
    }
  };

  // ─── DISCONNECT ──────────────────────────────────────────────────────────────
  const disconnect = () => {
    if (dataChannel.current) {
      dataChannel.current.close();
      dataChannel.current = null;
    }
    if (pc.current) {
      pc.current.close();
      pc.current = null;
    }
    setConnectionState('disconnected');
  };

  return {
    connectionState,
    messages,
    createTriageQueue,
    joinTriageQueue,
    sendData,
    disconnect
  };
}
