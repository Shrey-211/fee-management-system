import React, { useState, useEffect } from 'react';
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
import { X, KeyRound } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('dashboard');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [studentForPayment, setStudentForPayment] = useState(null);
  const [studentForFine, setStudentForFine] = useState(null);

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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setTab('dashboard');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwdMsg('');
    setPwdError('');
    setChangingPwd(true);
    try {
      await api.changePassword(oldPassword, newPassword);
      setPwdMsg('Password updated successfully!');
      setOldPassword('');
      setNewPassword('');
      setTimeout(() => setShowPwdModal(false), 2000);
    } catch (err) {
      setPwdError(err.message || 'Failed to update password');
    } finally {
      setChangingPwd(false);
    }
  };

  if (!user) {
    return <Login onLoginSuccess={(u) => setUser(u)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        user={user}
        onLogout={handleLogout}
        onChangePasswordClick={() => {
          setPwdMsg('');
          setPwdError('');
          setShowPwdModal(true);
        }}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto">
        <Sidebar
          currentTab={tab}
          setTab={(t) => {
            setTab(t);
            setSelectedStudentId(null);
          }}
          user={user}
        />

        <main className="flex-1 p-6 overflow-y-auto">
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
    </div>
  );
}
