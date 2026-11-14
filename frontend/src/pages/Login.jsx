import React, { useState } from 'react';
import { api } from '../api/client';
import { ShieldCheck, Lock, User, WifiOff, ArrowRight } from 'lucide-react';
import collegeLogo from '../assets/college_logo_sm.png';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmedUser = (username || '').trim();
    if (!trimmedUser && !password) {
      setError('Please enter both username and password.');
      return;
    }
    if (!trimmedUser) {
      setError('Username is required. Please enter your username.');
      return;
    }
    if (!password) {
      setError('Password is required. Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.login(trimmedUser, password);
      localStorage.setItem('token', res.access_token);
      localStorage.setItem('user', JSON.stringify(res.user));
      onLoginSuccess(res.user);
    } catch (err) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
        <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900 p-8 text-white text-center">
          <div className="w-20 h-20 bg-white rounded-2xl mx-auto flex items-center justify-center shadow-xl border-2 border-blue-400/40 p-1.5 mb-3">
            <img src={collegeLogo} alt="College Logo" className="w-full h-full object-contain rounded-xl" />
          </div>
          <p className="text-[11px] font-bold tracking-wider uppercase text-amber-300">
            Krishna Foundation's
          </p>
          <h2 className="text-sm sm:text-base font-extrabold tracking-tight text-white leading-snug mt-0.5">
            Shrimant Jayshreemaladevi Naik Nimbalkar Institute of Management Studies, Phaltan
          </h2>
          <div className="mt-2.5 pt-2 border-t border-blue-800/60">
            <p className="text-xs font-semibold text-blue-100">Student Fee Management System</p>
            <p className="text-[10px] text-blue-300">Designated Offline Station — Mr. Shrikant's PC</p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/80 border border-blue-400/20 text-[10px] text-emerald-300 mt-2.5">
            <WifiOff className="w-3 h-3 text-emerald-400" />
            100% Offline Single-PC Secure Deployment
          </div>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="Enter staff username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  placeholder="Enter password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : (
                <>
                  <span>Sign In to Fee System</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

