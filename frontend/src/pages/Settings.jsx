import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  Settings as SettingsIcon, Database, Shield, 
  Mail, Users, Download, Plus, CheckCircle, RefreshCw, Save 
} from 'lucide-react';

export default function Settings({ user }) {
  const [activeTab, setActiveTab] = useState('fees'); // 'fees' | 'users' | 'backups' | 'smtp'

  // Fee Heads
  const [feeHeads, setFeeHeads] = useState([]);
  const [editingHead, setEditingHead] = useState(null);
  const [headAmount, setHeadAmount] = useState('');

  // Backups
  const [backups, setBackups] = useState([]);
  const [backupMsg, setBackupMsg] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);

  // Users
  const [userList, setUserList] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('clerk');
  const [userMsg, setUserMsg] = useState('');

  // SMTP Settings
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpName, setSmtpName] = useState('');
  const [smtpTls, setSmtpTls] = useState(true);
  const [testEmailTo, setTestEmailTo] = useState('');
  const [smtpMsg, setSmtpMsg] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);

  const loadData = async () => {
    try {
      const [heads, bList, uList, smtp] = await Promise.all([
        api.getFeeHeads('2026-2027'),
        api.getBackups(),
        api.getUsers(),
        api.getSmtpSettings()
      ]);
      setFeeHeads(heads);
      setBackups(bList);
      setUserList(uList);

      setSmtpHost(smtp.smtp_host || '');
      setSmtpPort(smtp.smtp_port || 587);
      setSmtpUser(smtp.smtp_username || '');
      setSmtpFrom(smtp.smtp_from_email || '');
      setSmtpName(smtp.smtp_from_name || '');
      setSmtpTls(smtp.smtp_use_tls !== false);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateFeeHead = async (head) => {
    const amt = parseFloat(headAmount);
    if (isNaN(amt) || amt < 0) {
      alert('Please enter a valid amount');
      return;
    }
    try {
      await api.updateFeeHead(head.id, { base_amount: amt });
      setEditingHead(null);
      loadData();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    setBackupMsg('');
    try {
      const res = await api.createBackup();
      setBackupMsg('Database snapshot created successfully!');
      const bList = await api.getBackups();
      setBackups(bList);
      setTimeout(() => setBackupMsg(''), 5000);
    } catch (e) {
      alert(e.message);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserMsg('');
    try {
      await api.createUser({
        username: newUsername.trim(),
        password: newPassword,
        full_name: newFullName.trim(),
        role: newRole
      });
      setUserMsg('User account created successfully!');
      setNewUsername('');
      setNewFullName('');
      setNewPassword('');
      const uList = await api.getUsers();
      setUserList(uList);
      setTimeout(() => setUserMsg(''), 4000);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    setSmtpMsg('');
    try {
      await api.updateSmtpSettings({
        smtp_host: smtpHost.trim(),
        smtp_port: parseInt(smtpPort),
        smtp_username: smtpUser.trim(),
        smtp_password: smtpPass,
        smtp_from_email: smtpFrom.trim(),
        smtp_from_name: smtpName.trim(),
        use_tls: smtpTls
      });
      setSmtpMsg('SMTP Settings saved successfully!');
      setTimeout(() => setSmtpMsg(''), 4000);
    } catch (e) {
      alert(e.message);
    }
  };

  const handleTestSmtp = async () => {
    if (!testEmailTo) {
      alert('Please enter a test recipient email');
      return;
    }
    setTestingSmtp(true);
    setSmtpMsg('');
    try {
      const res = await api.testSmtp({
        test_email: testEmailTo.trim(),
        smtp_host: smtpHost.trim(),
        smtp_port: parseInt(smtpPort),
        smtp_username: smtpUser.trim(),
        smtp_password: smtpPass,
        smtp_from_email: smtpFrom.trim(),
        smtp_from_name: smtpName.trim(),
        use_tls: smtpTls
      });
      setSmtpMsg(res.message);
    } catch (e) {
      alert('SMTP Test Failed: ' + e.message);
    } finally {
      setTestingSmtp(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('fees')}
          className={`py-3 px-6 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'fees'
              ? 'border-blue-600 text-blue-700 bg-blue-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <SettingsIcon className="w-4 h-4" />
          Fee Head Configuration
        </button>

        <button
          onClick={() => setActiveTab('backups')}
          className={`py-3 px-6 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'backups'
              ? 'border-blue-600 text-blue-700 bg-blue-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          Offline Backups & Storage
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`py-3 px-6 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-700 bg-blue-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Staff User Accounts
        </button>

        <button
          onClick={() => setActiveTab('smtp')}
          className={`py-3 px-6 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'smtp'
              ? 'border-blue-600 text-blue-700 bg-blue-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Mail className="w-4 h-4" />
          College SMTP Settings
        </button>
      </div>

      {/* 1. FEE HEADS CONFIGURATION */}
      {activeTab === 'fees' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="border-b pb-3">
            <h3 className="text-sm font-bold text-slate-900">Standard Academic Fee Heads</h3>
            <p className="text-xs text-slate-500">
              Configure base amounts for academic year 2026-2027. Waivers calculate automatically based on rules.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                <tr>
                  <th className="px-4 py-3">Fee Head Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Base Amount (₹)</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {feeHeads.map((head) => (
                  <tr key={head.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-bold text-slate-900">{head.name}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{head.code}</td>
                    <td className="px-4 py-3">
                      {head.allows_waiver ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          Waiver Eligible (Girls/SC/ST/EBC)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                          Compulsory (All Students)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                      {editingHead?.id === head.id ? (
                        <input
                          type="number"
                          step="0.01"
                          value={headAmount}
                          onChange={(e) => setHeadAmount(e.target.value)}
                          className="w-32 px-2 py-1 border rounded text-right font-mono text-xs focus:ring-1 focus:ring-blue-600"
                        />
                      ) : (
                        `₹${Number(head.base_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {editingHead?.id === head.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleUpdateFeeHead(head)}
                            className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-semibold"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingHead(null)}
                            className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px]"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingHead(head);
                            setHeadAmount(String(head.base_amount));
                          }}
                          className="text-blue-600 hover:text-blue-800 font-semibold"
                        >
                          Edit Base Fee
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. OFFLINE BACKUPS */}
      {activeTab === 'backups' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-600" />
                Offline SQLite Database Backups
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                The system automatically creates daily rolling snapshots. You can also generate an instant backup and save it to a USB pen drive.
              </p>
            </div>
            <button
              onClick={handleCreateBackup}
              disabled={creatingBackup}
              className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${creatingBackup ? 'animate-spin' : ''}`} />
              {creatingBackup ? 'Creating Snapshot...' : 'Backup Database Now'}
            </button>
          </div>

          {backupMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-600" />
              {backupMsg}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Available Database Backup Snapshots ({backups.length})
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="px-4 py-3">Snapshot Filename</th>
                    <th className="px-4 py-3">Creation Timestamp</th>
                    <th className="px-4 py-3">File Size</th>
                    <th className="px-4 py-3 text-right">Download Snapshot</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {backups.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-slate-400">
                        No backups generated yet.
                      </td>
                    </tr>
                  ) : (
                    backups.map((b) => (
                      <tr key={b.filename} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{b.filename}</td>
                        <td className="px-4 py-3 text-slate-600">{b.created_at}</td>
                        <td className="px-4 py-3 text-slate-500 font-mono">{b.size_kb} KB</td>
                        <td className="px-4 py-3 text-right">
                          <a
                            href={api.downloadBackupUrl(b.filename)}
                            download
                            className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold border"
                          >
                            <Download className="w-3 h-3" />
                            Download .db
                          </a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. STAFF USERS */}
      {activeTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Configured Staff User Accounts</h3>
              <p className="text-xs text-slate-500">Three user roles: Admin (Mr. Shrikant), Accountant, Clerk</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                  <tr>
                    <th className="px-4 py-3">Full Name</th>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">Assigned Role</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {userList.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-bold text-slate-900">{u.full_name}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{u.username}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 border">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Create Staff User</h3>
            <p className="text-xs text-slate-500 mb-4">Grant access to staff member</p>

            {userMsg && (
              <div className="p-2.5 mb-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
                {userMsg}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Staff Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Anand Joshi"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Username *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. anand"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Password *</label>
                <input
                  type="password"
                  required
                  placeholder="At least 4 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">User Role *</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white"
                >
                  <option value="clerk">Clerk (Cashier & Lookups)</option>
                  <option value="accountant">Accountant (Batches & Reports)</option>
                  <option value="admin">Admin (Full Control)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow transition"
              >
                Create Account
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 4. SMTP SETTINGS */}
      {activeTab === 'smtp' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 max-w-2xl text-xs">
          <div className="border-b pb-3">
            <h3 className="text-sm font-bold text-slate-900">College SMTP Mailbox Settings</h3>
            <p className="text-xs text-slate-500">
              Credentials are saved securely in your local environment and used for email due reminders.
            </p>
          </div>

          {smtpMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-medium">
              {smtpMsg}
            </div>
          )}

          <form onSubmit={handleSaveSmtp} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">SMTP Host Server</label>
                <input
                  type="text"
                  placeholder="smtp.gmail.com"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">SMTP Port</label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">SMTP Username / Email</label>
                <input
                  type="text"
                  placeholder="college.fees@gmail.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">App Password / Password</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">From Email Address</label>
                <input
                  type="email"
                  placeholder="accounts@college.edu"
                  value={smtpFrom}
                  onChange={(e) => setSmtpFrom(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Sender Display Name</label>
                <input
                  type="text"
                  placeholder="College Fee Administration"
                  value={smtpName}
                  onChange={(e) => setSmtpName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow transition"
            >
              Save SMTP Configuration
            </button>
          </form>

          {/* Test SMTP */}
          <div className="pt-4 border-t space-y-3">
            <h4 className="font-bold text-slate-800">Verify SMTP Credentials</h4>
            <div className="flex items-center gap-3">
              <input
                type="email"
                placeholder="Enter recipient email for test..."
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={handleTestSmtp}
                disabled={testingSmtp}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-bold transition disabled:opacity-50"
              >
                {testingSmtp ? 'Sending Test...' : 'Send Test Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
