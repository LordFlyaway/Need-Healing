import React, { useState } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, query, collection, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { toast } from 'sonner';

export default function AuthLogin({ onLogin, mode, setMode }) {
  const [view, setView] = useState('login'); // login, register, forgot
  const [role, setRole] = useState('patient'); // patient, doctor
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [aadhar, setAadhar] = useState('');
  const [fullName, setFullName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 3D Tilt Setup
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["5deg", "-5deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-5deg", "5deg"]);

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const xPct = mouseX / width - 0.5;
    const yPct = mouseY / height - 0.5;
    x.set(xPct);
    y.set(yPct);
  };
  
  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  async function hashAadhar(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  const handleAuth = async () => {
    setError('');
    if (!email || !password) {
      toast.error("Please fill all required fields.");
      return setError("Please fill all required fields.");
    }

    setLoading(true);
    try {
      if (view === 'register') {
        if (password !== confirmPassword) { setLoading(false); toast.error("Passwords do not match."); return setError("Passwords do not match."); }
        if (password.length < 6) { setLoading(false); toast.error("Password must be at least 6 characters."); return setError("Password must be at least 6 characters."); }

        if (role === 'patient') {
          // Patient registration
          if (!fullName.trim()) { setLoading(false); toast.error("Full name is required."); return setError("Full name is required."); }
          if (aadhar.length !== 12) { setLoading(false); toast.error("Aadhaar must be 12 digits."); return setError("Aadhaar must be 12 digits."); }

          const hashedId = await hashAadhar(aadhar);
          const q = query(collection(db, "users"), where("patient_id", "==", hashedId));
          const duplicateCheck = await getDocs(q);
          if (!duplicateCheck.empty) { setLoading(false); toast.error("An account with this Aadhaar already exists."); return setError("An account with this Aadhaar already exists."); }

          const userCred = await createUserWithEmailAndPassword(auth, email, password);
          const publicId = "PAT-" + Math.random().toString(36).substring(2, 8).toUpperCase();

          const newUserData = {
            uid: userCred.user.uid,
            name: fullName,
            email: email,
            patient_id: hashedId,
            public_id: publicId,
            aadhar_last4: aadhar.slice(-4),
            role: "patient",
            created_at: serverTimestamp()
          };
          await setDoc(doc(db, "users", userCred.user.uid), newUserData);
          onLogin(newUserData);

        } else {
          // Doctor registration
          if (!fullName.trim()) { setLoading(false); toast.error("Full name is required."); return setError("Full name is required."); }
          if (!licenseNumber.trim()) { setLoading(false); toast.error("Medical license number is required."); return setError("Medical license number is required."); }
          if (!specialization.trim()) { setLoading(false); toast.error("Specialization is required."); return setError("Specialization is required."); }

          // Check duplicate license
          const q = query(collection(db, "users"), where("license_number", "==", licenseNumber.trim()));
          const duplicateCheck = await getDocs(q);
          if (!duplicateCheck.empty) { setLoading(false); toast.error("An account with this license number already exists."); return setError("An account with this license number already exists."); }

          const userCred = await createUserWithEmailAndPassword(auth, email, password);
          const doctorId = "DOC-" + Math.random().toString(36).substring(2, 8).toUpperCase();

          const newUserData = {
            uid: userCred.user.uid,
            name: fullName,
            email: email,
            doctor_id: doctorId,
            license_number: licenseNumber.trim(),
            specialization: specialization.trim(),
            role: "doctor",
            created_at: serverTimestamp()
          };
          await setDoc(doc(db, "users", userCred.user.uid), newUserData);
          onLogin(newUserData);
        }

      } else if (view === 'login') {
        const userCred = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, "users", userCred.user.uid));
        if (userDoc.exists()) {
          toast.success("Welcome back to MediVault");
          onLogin(userDoc.data());
        }
        else {
          toast.error("User data not found.");
          setError("User data not found.");
        }
      }
    } catch (err) {
      const errText = err.message.replace("Firebase:", "").trim();
      setError(errText);
      toast.error(errText);
    }
    setLoading(false);
  };

  const handleReset = async () => {
    if (!email) { toast.error("Enter your email first."); return setError("Enter your email first."); }
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset email sent! Check your inbox.");
      setError('');
    } catch (err) { 
      setError(err.message); 
      toast.error(err.message);
    }
  };

  const switchView = (newView) => {
    setView(newView);
    setError('');
  };

  return (
    <div className="auth-page">
      {/* Animated background */}
      <div className="auth-bg">
        <div className="auth-bg-orb auth-bg-orb-1"></div>
        <div className="auth-bg-orb auth-bg-orb-2"></div>
        <div className="auth-bg-orb auth-bg-orb-3"></div>
      </div>

      <motion.div 
        className="auth-container fade-up"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-icon shadow-[0_0_20px_rgba(37,99,235,0.4)]">✚</div>
          <div className="auth-logo-text bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent dark:from-blue-400 dark:to-cyan-200">MediVault</div>
          <div className="auth-logo-sub">Secure Health Records</div>
        </div>

        <motion.div 
          className="auth-card"
          style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <h2 className="auth-title">
            {view === 'register' ? 'Create Your Vault' : view === 'login' ? 'Welcome Back' : 'Reset Password'}
          </h2>

          {/* We rely on toast now, but keep error for fallback spacing if desired, removing msg */}
          {error && <div className="auth-error">{error}</div>}

          {/* Role Selector (Register only) */}
          {view === 'register' && (
            <div className="auth-role-selector">
              <button
                onClick={() => setRole('patient')}
                className={`auth-role-btn ${role === 'patient' ? 'active' : ''}`}
              >
                <span className="auth-role-icon">🧑‍⚕️</span>
                <span>Patient</span>
              </button>
              <button
                onClick={() => setRole('doctor')}
                className={`auth-role-btn ${role === 'doctor' ? 'active' : ''}`}
              >
                <span className="auth-role-icon">👨‍⚕️</span>
                <span>Doctor</span>
              </button>
            </div>
          )}

          {/* Common Fields */}
          {view === 'register' && (
            <div className="auth-field">
              <label className="auth-label">Full Name</label>
              <input type="text" placeholder={role === 'doctor' ? "Dr. Full Name" : "Full Name"} value={fullName} onChange={e => setFullName(e.target.value)} className="input-field" />
            </div>
          )}

          {/* Patient-specific: Aadhaar */}
          {view === 'register' && role === 'patient' && (
            <div className="auth-field">
              <label className="auth-label">Aadhaar Number</label>
              <input type="text" maxLength="12" placeholder="12-Digit Aadhaar" value={aadhar} onChange={e => setAadhar(e.target.value.replace(/\D/g, ''))} className="input-field font-mono tracking-widest text-center" />
            </div>
          )}

          {/* Doctor-specific fields */}
          {view === 'register' && role === 'doctor' && (
            <>
              <div className="auth-field">
                <label className="auth-label">Medical License Number</label>
                <input type="text" placeholder="e.g. MCI-12345" value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} className="input-field font-mono" />
              </div>
              <div className="auth-field">
                <label className="auth-label">Specialization</label>
                <select value={specialization} onChange={e => setSpecialization(e.target.value)} className="input-field">
                  <option value="">Select Specialization…</option>
                  <option value="General Medicine">General Medicine</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Dermatology">Dermatology</option>
                  <option value="Endocrinology">Endocrinology</option>
                  <option value="Gastroenterology">Gastroenterology</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Oncology">Oncology</option>
                  <option value="Ophthalmology">Ophthalmology</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Psychiatry">Psychiatry</option>
                  <option value="Pulmonology">Pulmonology</option>
                  <option value="Radiology">Radiology</option>
                  <option value="Surgery">Surgery</option>
                  <option value="Urology">Urology</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </>
          )}

          <div className="auth-field">
            <label className="auth-label">Email Address</label>
            <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} className="input-field" />
          </div>

          {view !== 'forgot' && (
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="input-field" />
            </div>
          )}

          {view === 'register' && (
            <div className="auth-field">
              <label className="auth-label">Confirm Password</label>
              <input type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="input-field" />
            </div>
          )}

          {view !== 'forgot' ? (
            <button onClick={handleAuth} disabled={loading} className="btn-primary w-full auth-submit-btn">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="record-spinner small"></span> Processing…
                </span>
              ) : view === 'register' ? (
                role === 'doctor' ? '🩺 Register as Doctor' : '🔐 Register Securely'
              ) : (
                '🔓 Access Vault'
              )}
            </button>
          ) : (
            <button onClick={handleReset} className="btn-primary w-full auth-submit-btn">Send Reset Email</button>
          )}

          <div className="auth-links">
            <button onClick={() => switchView(view === 'login' ? 'register' : 'login')}>
              {view === 'login' ? "New here? Create account" : "Already registered? Login"}
            </button>
            {view === 'login' && <button onClick={() => switchView('forgot')}>Forgot Password?</button>}
            {view === 'forgot' && <button onClick={() => switchView('login')}>Back to Login</button>}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}