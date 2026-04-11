import React, { useState, useRef, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function QRScanner({ onScan, onClose }) {
  const [mode, setMode] = useState('choose'); // choose, camera, upload
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef(null);
  const html5QrRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      // Cleanup camera on unmount
      if (html5QrRef.current) {
        try {
          const promise = html5QrRef.current.stop();
          if (promise && promise.catch) {
            promise.catch(() => {});
          }
        } catch (e) {
          // ignore error if not scanning
        }
      }
    };
  }, []);

  const parseQRData = (data) => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.patient_id) return parsed.patient_id;
      return null;
    } catch {
      // If it's not JSON, treat the raw string as the patient ID
      return data.trim();
    }
  };

  const startCameraScan = async () => {
    setMode('camera');
    setError('');
    setScanning(true);

    try {
      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          const patientId = parseQRData(decodedText);
          if (patientId) {
            html5QrCode.stop().catch(() => {});
            onScan(patientId);
          } else {
            setError('Invalid QR code format.');
          }
        },
        () => {} // ignore scan failures
      );
    } catch (err) {
      setError('Camera access denied or not available. Try uploading an image instead.');
      setScanning(false);
      setMode('choose');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMode('upload');
    setError('');
    setScanning(true);

    try {
      const html5QrCode = new Html5Qrcode("qr-reader-upload");
      html5QrRef.current = html5QrCode;

      const result = await html5QrCode.scanFile(file, true);
      const patientId = parseQRData(result);

      if (patientId) {
        onScan(patientId);
      } else {
        setError('Could not extract patient ID from this QR code.');
        setScanning(false);
      }
    } catch (err) {
      setError('No QR code found in image. Please try another image.');
      setScanning(false);
    }
  };

  return (
    <div className="qr-scanner-overlay" onClick={onClose}>
      <div className="qr-scanner-modal" onClick={e => e.stopPropagation()}>
        <div className="qr-scanner-header">
          <h2>Scan Patient QR Code</h2>
          <button onClick={onClose} className="self-report-close">✕</button>
        </div>

        {mode === 'choose' && (
          <div className="qr-scanner-options">
            <button onClick={startCameraScan} className="qr-option-card">
              <div className="qr-option-icon">📸</div>
              <div className="qr-option-title">Scan with Camera</div>
              <div className="qr-option-desc">Point your camera at the patient's QR code</div>
            </button>

            <button onClick={() => fileInputRef.current?.click()} className="qr-option-card">
              <div className="qr-option-icon">🖼️</div>
              <div className="qr-option-title">Upload QR Image</div>
              <div className="qr-option-desc">Upload a photo of the patient's QR code</div>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              style={{ display: 'none' }}
            />
          </div>
        )}

        {mode === 'camera' && (
          <div className="qr-camera-container">
            <div id="qr-reader" ref={scannerRef} className="qr-camera-view"></div>
            {scanning && (
              <div className="qr-scanning-indicator">
                <div className="qr-scan-line"></div>
                <p>Point camera at QR code…</p>
              </div>
            )}
          </div>
        )}

        {mode === 'upload' && scanning && (
          <div className="qr-upload-processing">
            <div className="record-spinner large"></div>
            <p>Processing image…</p>
          </div>
        )}

        {/* Hidden element for upload scan */}
        <div id="qr-reader-upload" style={{ position: 'absolute', top: '-9999px', opacity: 0 }}></div>

        {error && (
          <div className="qr-error">
            <span>⚠️</span> {error}
            {mode !== 'choose' && (
              <button onClick={() => { setMode('choose'); setError(''); setScanning(false); }} className="qr-retry-btn">
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
