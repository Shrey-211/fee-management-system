import React, { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import StudentDetail from './pages/StudentDetail';
import Payments from './pages/Payments';
import Fines from './pages/Fines';
import Scholarships from './pages/Scholarships';
import Reports from './pages/Reports';
import Reminders from './pages/Reminders';
import Settings from './pages/Settings';
import { api } from './api/client';
import { X, KeyRound, Clock } from 'lucide-react';
import ModalDialog from './components/ModalDialog';

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentForPayment, setStudentForPayment] = useState(null);
  const [studentForFine, setStudentForFine] = useState(null);

  // Inactivity Auto-Logout State
  const [inactivityNotice, setInactivityNotice] = useState('');
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(60);
  const lastActivityRef = useRef(Date.now());

  // Logout Confirm State
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Change Password Modal
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      setUser(JSON.parse(savedUser));
    }

    const handleAuthExpired = () => {
      setUser(null);
    };
    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
  }, []);

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    setShowInactivityModal(false);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setTab('dashboard');
    setInactivityNotice('');
  };

  const handleStaySignedIn = () => {
    lastActivityRef.current = Date.now();
    setShowInactivityModal(false);
  };

  // 15-Minute Inactivity Auto-Logout with 60-Second Warning
  useEffect(() => {
    if (!user) return;

    lastActivityRef.current = Date.now();

    const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 mins total
    const WARNING_THRESHOLD_MS = 14 * 60 * 1000; // 14 mins (triggers 60s warning)

    let lastThrottle = Date.now();
    const handleUserActivity = (e) => {
      // If warning modal is active, passive mouse movements don't dismiss it to avoid mouse jitter
      if (showInactivityModal && e.type === 'mousemove') {
        return;
      }
      const now = Date.now();
      if (now - lastThrottle > 1000) {
        lastThrottle = now;
        lastActivityRef.current = now;
        if (showInactivityModal) {
          setShowInactivityModal(false);
        }
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    events.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;

      if (elapsed >= INACTIVITY_LIMIT_MS) {
        // Auto-logout
        setShowInactivityModal(false);
        setShowLogoutConfirm(false);
        setShowPwdModal(false);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setTab('dashboard');
        setInactivityNotice('You have been automatically logged out due to 15 minutes of inactivity.');
      } else if (elapsed >= WARNING_THRESHOLD_MS) {
        const remaining = Math.max(0, Math.ceil((INACTIVITY_LIMIT_MS - elapsed) / 1000));
        setCountdownSeconds(remaining);
        setShowInactivityModal(true);
      } else {
        if (showInactivityModal) {
          setShowInactivityModal(false);
        }
      }
    }, 1000);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      clearInterval(timer);
    };
  }, [user, showInactivityModal]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdMsg('');
    setPwdError('');

    if (!oldPassword) {
      setPwdError('Current password is required. Please fill in your current password.');
      return;
    }
    if (!newPassword) {
      setPwdError('New password is required. Please fill in your new password.');
      return;
    }
    if (newPassword.length < 4) {
      setPwdError('New password must be at least 4 characters long.');
      return;
    }
    if (oldPassword === newPassword) {
      setPwdError('New password must be different from your current password.');
      return;
    }

    setChangingPwd(true);
    try {
      await api.changePassword(oldPassword, newPassword);
      setPwdMsg('Password updated successfully!');
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => setShowPwdModal(false), 2000);
    } catch (err) {
      setPwdError(err.message || 'Failed to update password. Please check your inputs.');
    } finally {
      setChangingPwd(false);
    }
  };

  if (!user) {
    return (
      <Login
        onLoginSuccess={(u) => {
          setUser(u);
          setInactivityNotice('');
        }}
        inactivityNotice={inactivityNotice}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        user={user}
        onLogout={() => setShowLogoutConfirm(true)}
        onChangePasswordClick={() => {
          setPwdMsg('');
          setPwdError('');
          setShowPwdModal(true);
        }}
      />

      <div className="flex-1 flex w-full">
        <Sidebar
          currentTab={tab}
          setTab={(t) => {
            setTab(t);
            setSelectedStudentId(null);
          }}
          user={user}
        />

        <main className="flex-1 p-4 sm:p-6 overflow-y-auto min-w-0">
          {tab === 'dashboard' && (
            <Dashboard
              setTab={setTab}
              onNewPaymentClick={() => {
                setStudentForPayment(null);
                setTab('payments');
              }}
              onNewFineClick={() => {
                setStudentForFine(null);
                setTab('fines');
              }}
            />
          )}

          {tab === 'students' && !selectedStudentId && (
            <Students
              onSelectStudent={(id) => {
                setSelectedStudentId(id);
                setTab('student-detail');
              }}
              onRecordPayment={(st) => {
                setStudentForPayment(st);
                setTab('payments');
              }}
              user={user}
            />
          )}

          {tab === 'student-detail' && selectedStudentId && (
            <StudentDetail
              studentId={selectedStudentId}
              onBack={() => {
                setSelectedStudentId(null);
                setTab('students');
              }}
              onRecordPayment={(st) => {
                setStudentForPayment(st);
                setTab('payments');
              }}
              onLevyFine={(st) => {
                setStudentForFine(st);
                setTab('fines');
              }}
              user={user}
            />
          )}

          {tab === 'payments' && (
            <Payments
              initialStudent={studentForPayment}
              onClearInitialStudent={() => setStudentForPayment(null)}
              onSelectStudent={(id) => {
                setSelectedStudentId(id);
                setTab('student-detail');
              }}
            />
          )}

          {tab === 'fines' && (
            <Fines
              initialStudent={studentForFine}
              onClearInitialStudent={() => setStudentForFine(null)}
              onSelectStudent={(id) => {
                setSelectedStudentId(id);
                setTab('student-detail');
              }}
            />
          )}

          {tab === 'scholarships' && <Scholarships />}

          {tab === 'reports' && (
            <Reports
              onSelectStudent={(id) => {
                setSelectedStudentId(id);
                setTab('student-detail');
              }}
            />
          )}

          {tab === 'reminders' && <Reminders />}

          {tab === 'settings' && <Settings user={user} />}
        </main>
      </div>

      {/* Change Password Modal */}
      {showPwdModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold">Change Password</h3>
              </div>
              <button
                onClick={() => setShowPwdModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-5 space-y-3 text-xs">
              {pwdError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg">
                  {pwdError}
                </div>
              )}
              {pwdMsg && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg">
                  {pwdMsg}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Current Password *</label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Password *</label>
                <input
                  type="password"
                  required
                  minLength={4}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowPwdModal(false)}
                  className="px-3 py-1.5 border rounded-lg font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={changingPwd}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition disabled:opacity-50"
                >
                  {changingPwd ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inactivity Warning Modal (60-second warning) */}
      {showInactivityModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="p-4 bg-amber-500 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-100 animate-pulse" />
                <h3 className="text-sm font-bold tracking-tight">Session Inactivity Warning</h3>
              </div>
            </div>

            <div className="p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-300 flex items-center justify-center mx-auto text-amber-600 shadow-inner">
                <span className="font-mono text-2xl font-black">{countdownSeconds}s</span>
              </div>

              <div className="space-y-1">
                <h4 className="font-bold text-slate-800 text-base">Are you still there?</h4>
                <p className="text-xs text-slate-600 leading-relaxed">
                  No activity has been detected for 14 minutes. For security, you will be automatically signed out in{' '}
                  <span className="font-bold text-amber-600 font-mono">{countdownSeconds} seconds</span>.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                >
                  Sign Out Now
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={handleStaySignedIn}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow transition flex items-center gap-1.5"
                >
                  Stay Signed In
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      <ModalDialog
        isOpen={showLogoutConfirm}
        type="danger"
        title="Confirm Sign Out"
        message="Are you sure you want to sign out of the Fee Management System station?"
        confirmText="Sign Out"
        cancelText="Stay Signed In"
        confirmVariant="danger"
        onConfirm={handleLogout}
        onClose={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
