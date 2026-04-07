import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// ─── CUSTOM ICONS ─────────────────────────────────────────────────────────────
const vehicleHtml = `
  <div style="width: 40px; height: 40px; background: rgba(16, 185, 129, 0.2); border: 2px solid #10b981; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 15px rgba(16, 185, 129, 0.8);">
    <span style="font-size: 20px; filter: drop-shadow(0 0 2px #10b981);">🚑</span>
  </div>
`;
const vehicleIcon = new L.DivIcon({ html: vehicleHtml, className: 'custom-vehicle-icon', iconSize: [40, 40], iconAnchor: [20, 20] });

const pharmacyHtml = `
  <div style="width: 30px; height: 30px; background: rgba(59, 130, 246, 0.2); border: 2px solid #3b82f6; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(59, 130, 246, 0.8);">
    <span style="font-size: 16px;">🏥</span>
  </div>
`;
const pharmacyIcon = new L.DivIcon({ html: pharmacyHtml, className: 'custom-pharmacy-icon', iconSize: [30, 30], iconAnchor: [15, 15] });

const houseHtml = `
  <div style="width: 30px; height: 30px; background: rgba(239, 68, 68, 0.2); border: 2px solid #ef4444; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(239, 68, 68, 0.8);">
    <span style="font-size: 16px;">🏠</span>
  </div>
`;
const houseIcon = new L.DivIcon({ html: houseHtml, className: 'custom-house-icon', iconSize: [30, 30], iconAnchor: [15, 15] });

// ─── HELPERS ──────────────────────────────────────────────────────────────────
// Generate a mock orthogonal (Manhattan) route between two points
function generateManhattanRoute(start, end, steps = 20) {
  const route = [start];
  const totalLats = end[0] - start[0];
  const totalLngs = end[1] - start[1];
  
  let currentLat = start[0];
  let currentLng = start[1];

  for (let i = 1; i <= steps; i++) {
    if (i % 2 === 0) {
      currentLat += (totalLats / (steps / 2));
    } else {
      currentLng += (totalLngs / (steps / 2));
    }
    route.push([currentLat, currentLng]);
  }
  route.push(end);
  return route;
}

// Find a mock hospital near the user
function getNearestHospital(lat, lng) {
  return [lat + (Math.random() > 0.5 ? 0.015 : -0.015), lng + (Math.random() > 0.5 ? 0.015 : -0.015)];
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function DeliveryTrackingMap({ onClose }) {
  // Use Geolocation if available, otherwise fallback
  const [patientPosition, setPatientPosition] = useState([40.7282, -73.9942]);
  const [pharmacyPosition, setPharmacyPosition] = useState([40.7128, -74.0060]);
  const [route, setRoute] = useState([]);
  
  const [currentPosition, setCurrentPosition] = useState(pharmacyPosition);
  const [progress, setProgress] = useState(0); // 0 to 1
  const [status, setStatus] = useState('Locating user...');

  useEffect(() => {
    // 1. Locate User
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLoc = [pos.coords.latitude, pos.coords.longitude];
          setPatientPosition(userLoc);
          const hospitalLoc = getNearestHospital(userLoc[0], userLoc[1]);
          setPharmacyPosition(hospitalLoc);
          setRoute(generateManhattanRoute(hospitalLoc, userLoc));
          setStatus('Connecting to hospital...');
        },
        () => {
          const defaultRoute = generateManhattanRoute(pharmacyPosition, patientPosition);
          setRoute(defaultRoute);
        }
      );
    } else {
      setRoute(generateManhattanRoute(pharmacyPosition, patientPosition));
    }
  }, []);

  useEffect(() => {
    if (route.length === 0) return;
    setStatus('Dispensing Medication...');
    
    // Stage 1: Dispensing
    const timer1 = setTimeout(() => {
      setStatus('Vehicle Dispatched');
      
        // Stage 2: Moving along route segments
        let pointIndex = 0;
        let segmentProgress = 0;
        
        const interval = setInterval(() => {
          if (pointIndex >= route.length - 1) {
            clearInterval(interval);
            setProgress(1);
            setStatus('Delivered via Road! ✅');
            return;
          }

          segmentProgress += 0.05; // speed per step
          if (segmentProgress >= 1) {
            segmentProgress = 0;
            pointIndex++;
          }
          
          if (pointIndex < route.length - 1) {
            const startP = route[pointIndex];
            const endP = route[pointIndex + 1];
            const curLat = startP[0] + (endP[0] - startP[0]) * segmentProgress;
            const curLng = startP[1] + (endP[1] - startP[1]) * segmentProgress;
            setCurrentPosition([curLat, curLng]);
            
            const totalProgress = (pointIndex + segmentProgress) / (route.length - 1);
            setProgress(totalProgress);
          }
        }, 50);

      return () => clearInterval(interval);
    }, 2000);

    return () => clearTimeout(timer1);
  }, []);

  return (
    <motion.div 
      className="fixed inset-0 z-[200] flex flex-col md:flex-row bg-[#020617]"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
    >
      {/* ─── HUD OVERLAY (Stats & Controls) ─── */}
      <div className="w-full md:w-96 bg-[#0f172a] shadow-2xl flex flex-col p-6 z-[210] overflow-y-auto border-b md:border-b-0 md:border-r border-slate-800">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent flex items-center gap-2">
            <span>📡</span> Live Tracking
          </h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/20 text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl">
            <h3 className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Status</h3>
            <div className="text-xl font-bold flex items-center gap-2">
              <span className={status.includes('Delivered') ? 'text-green-400' : 'text-emerald-400 animate-pulse'}>
                {status.includes('Delivered') ? '✓' : '●'}
              </span>
              <span className="text-white">{status}</span>
            </div>
            
            <div className="w-full h-2 bg-slate-800 rounded-full mt-4 overflow-hidden">
              <div 
                className="h-full bg-emerald-500 transition-all duration-75"
                style={{ width: `${Math.max(5, progress * 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl text-center">
              <h3 className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">ETA</h3>
              <div className="text-2xl font-mono font-bold text-white">
                {progress === 1 ? 'Arrived' : `${Math.ceil((1 - progress) * 15)}m`}
              </div>
            </div>
            <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl text-center">
              <h3 className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Method</h3>
              <div className="text-lg font-bold text-blue-400 mt-1">Ground Road Nav</div>
            </div>
          </div>
          
          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-start gap-4">
            <div className="text-2xl mt-1">🛡️</div>
            <div>
              <h4 className="font-bold text-blue-300">Secure Protocol Active</h4>
              <p className="text-sm text-slate-400 leading-snug mt-1">Connecting natively via hospital mesh network. Delivery driver will verify patient identity via QR.</p>
            </div>
          </div>
        </div>

        <div className="mt-auto pt-8">
           <button 
             onClick={onClose}
             className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all shadow-lg active:scale-95"
           >
             Close Tracking
           </button>
        </div>
      </div>

      {/* ─── MAP RENDERING ─── */}
      <div className="flex-1 relative bg-black">
        <MapContainer 
          center={patientPosition} 
          zoom={14} 
          zoomControl={false}
          className="w-full h-full"
        >
          {/* CartoDB Dark Matter TileLayer for stunning dark mode */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          {/* Route path (Manhattan road) */}
          <Polyline 
            positions={route} 
            pathOptions={{ color: '#0d9488', weight: 4, opacity: 0.8 }} 
          />
          
          {/* Pharmacy Marker */}
          <Marker position={pharmacyPosition} icon={pharmacyIcon} />
          
          {/* Destination Marker */}
          <Marker position={patientPosition} icon={houseIcon} />
          
          {/* Vehicle Marker */}
          <Marker position={currentPosition} icon={vehicleIcon} zIndexOffset={100} />

        </MapContainer>
        
        {/* Map Overlay Glow Effect */}
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_10px_rgba(2,6,23,1)] z-[190]"></div>
      </div>
    </motion.div>
  );
}
