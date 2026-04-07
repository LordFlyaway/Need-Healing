import React, { useState, useEffect } from 'react';
import AuthLogin from './components/AuthLogin';
import PatientDashboard from './components/PatientDashboard';
import DoctorDashboard from './components/DoctorDashboard';
import AmbulanceMode from './components/AmbulanceMode';
import { auth, firebaseConfigError } from './firebase';
import { signOut } from 'firebase/auth';
import { Toaster } from 'sonner';

export default function App() {
  const [mode, setMode] = useState("dark");
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (mode === "dark") document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, [mode]);

  if (firebaseConfigError) {
    return (
      <div className="auth-page">
        <div className="auth-bg">
          <div className="auth-bg-orb auth-bg-orb-1"></div>
          <div className="auth-bg-orb auth-bg-orb-2"></div>
          <div className="auth-bg-orb auth-bg-orb-3"></div>
        </div>

        <div className="auth-container fade-up">
          <div className="auth-logo">
            <div className="auth-logo-icon shadow-[0_0_20px_rgba(37,99,235,0.4)]">+</div>
            <div className="auth-logo-text bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent dark:from-blue-400 dark:to-cyan-200">MediVault</div>
            <div className="auth-logo-sub">Configuration Required</div>
          </div>

          <div className="auth-card">
            <h2 className="auth-title">Firebase setup is missing</h2>
            <div className="auth-error">{firebaseConfigError}</div>
            <p className="text-sm leading-6 text-text3">
              Create a <code>.env</code> file in the project root, copy the keys from <code>.env.template</code>, and paste your Firebase project values there. Then restart <code>npm run dev</code>.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (window.location.pathname.startsWith('/ambulance')) {
    return (
      <>
        <Toaster position="top-right" theme={mode} richColors toastOptions={{ style: { background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text)' } }} />
        <AmbulanceMode />
      </>
    );
  }

  if (!currentUser) {
    return <AuthLogin onLogin={setCurrentUser} mode={mode} setMode={setMode} />;
  }

  const handleLogout = async () => {
    await signOut(auth);
    setCurrentUser(null);
  };

  const sidebarSubtext = () => {
    if (currentUser.role === 'doctor') {
      return currentUser.specialization || 'Verified Physician';
    }
    return `Aadhaar: **** ${currentUser.aadhar_last4}`;
  };

  return (
    <div className="flex min-h-screen">
      <Toaster position="top-right" theme={mode} richColors toastOptions={{ style: { background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text)' } }} />
      <aside className="w-[240px] flex flex-col fixed inset-y-0 left-0 z-50 bg-nav border-r border-white/5 transition-colors">
        <div className="p-5 pb-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg text-white bg-primary">+</div>
          <div>
            <div className="text-[15px] font-bold text-white tracking-wide">MediVault</div>
            <div className="text-[10px] mt-0.5 opacity-60 text-nav-text uppercase tracking-wider">{currentUser.role} Portal</div>
          </div>
        </div>

        <div className="p-4 border-b border-white/10">
          <div className="text-[13px] font-semibold text-white">
            {currentUser.role === 'doctor' ? `Dr. ${currentUser.name}` : currentUser.name}
          </div>
          <div className="text-[10px] font-mono mt-0.5 opacity-60 text-nav-text">
            {sidebarSubtext()}
          </div>
          {currentUser.role === 'doctor' && currentUser.doctor_id && (
            <div className="text-[10px] font-mono mt-1 opacity-40 text-nav-text">
              {currentUser.doctor_id}
            </div>
          )}
        </div>

        <div className="flex-1 p-3">
          <div className="p-2.5 rounded-lg bg-white/10 text-white text-[13px] font-medium flex items-center gap-2.5">
            <span>{currentUser.role === 'patient' ? 'Pt' : 'Dr'}</span>
            Dashboard
          </div>
        </div>

        <div className="mt-auto p-4 border-t border-white/10">
          <button onClick={() => setMode(mode === "light" ? "dark" : "light")} className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-medium bg-white/5 text-nav-text hover:bg-white/10 transition-all">
            <span>{mode === "light" ? "Moon" : "Sun"}</span> {mode === "light" ? "Dark Mode" : "Light Mode"}
          </button>
          <button onClick={handleLogout} className="w-full flex items-center gap-1.5 p-2 mt-2 rounded-lg text-xs opacity-70 text-nav-text hover:opacity-100 hover:bg-white/10 transition-all">
            <span>Out</span> Secure Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-[240px] p-8 pb-12 min-h-screen">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-text">
            Welcome, {currentUser.role === 'doctor' ? `Dr. ${currentUser.name}` : currentUser.name}
          </h1>
          <p className="text-sm mt-1 text-text3">
            {currentUser.role === 'patient' ? 'Your medical data, fully controlled by you.' : 'Access and update patient vaults securely.'}
          </p>
        </div>

        {currentUser.role === 'patient' ? (
          <PatientDashboard user={currentUser} />
        ) : (
          <DoctorDashboard user={currentUser} />
        )}
      </main>
    </div>
  );
}
