import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { 
  Settings as SettingsIcon, Database, Shield, 
  Mail, Users, Download, Plus, CheckCircle, RefreshCw, Save,
  Layers, Edit2, Trash2, X, AlertTriangle, ArrowRight, Check,
  GraduationCap
} from 'lucide-react';
import ModalDialog from '../components/ModalDialog';

export default function Settings({ user }) {
  const [activeTab, setActiveTab] = useState('fees'); // 'fees' | 'users' | 'backups' | 'smtp'
  const [feeYearTab, setFeeYearTab] = useState(1); // 1 = 1st Year (MBA-I), 2 = 2nd Year (MBA-II)
  const [modalYearTab, setModalYearTab] = useState(1); // 1 = 1st Year, 2 = 2nd Year inside modal

  // Custom Popup Dialog States
  const [deleteTypeDialog, setDeleteTypeDialog] = useState({ isOpen: false, typeId: null, typeName: '', loading: false });
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  // Fee Heads
  const [feeHeads, setFeeHeads] = useState([]);
  const [editingHead, setEditingHead] = useState(null);
  const [headAmount, setHeadAmount] = useState('');

  // Fee Concession Types
  const [feeTypes, setFeeTypes] = useState([]);
  const [typeFilter, setTypeFilter] = useState('ALL'); // 'ALL' | 'CASTE' | 'GENDER' | 'CUSTOM'
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeFormName, setTypeFormName] = useState('');
  const [typeFormCode, setTypeFormCode] = useState('');
  const [typeFormGroup, setTypeFormGroup] = useState('CASTE');
  const [typeFormDesc, setTypeFormDesc] = useState('');
  const [typeHeadRules, setTypeHeadRules] = useState({});
  const [savingType, setSavingType] = useState(false);
  const [typeError, setTypeError] = useState('');
  const [reapplyingRules, setReapplyingRules] = useState(false);
  const [reapplyMsg, setReapplyMsg] = useState('');

  // Backups
  const [backups, setBackups] = useState([]);
  const [backupMsg, setBackupMsg] = useState('');
  const [creatingBackup, setCreatingBackup] = useState(false);

  const handleDownloadBackup = async (filename) => {
    try {
      await api.downloadBackup(filename);
    } catch (err) {
      setBackupMsg(`Failed to download backup: ${err.message}`);
    }
  };


  // Users
  const [userList, setUserList] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('clerk');
  const [userMsg, setUserMsg] = useState('');
  const [userError, setUserError] = useState('');

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
  const [smtpError, setSmtpError] = useState('');
  const [testingSmtp, setTestingSmtp] = useState(false);

  // Security Audit Trail
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const logs = await api.getAuditLogs(100);
      setAuditLogs(logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAudit(false);
    }
  };


  const loadData = async () => {
    try {
      const [heads, bList, uList, smtp, types] = await Promise.all([
        api.getFeeHeads('2026-2027'),
        api.getBackups(),
        api.getUsers(),
        api.getSmtpSettings(),
        api.getFeeTypes('2026-2027')
      ]);
      setFeeHeads(heads);
      setBackups(bList);
      setUserList(uList);
      setFeeTypes(types || []);

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

  const handleOpenAddType = () => {
    setModalYearTab(feeYearTab);
    setEditingType(null);
    setTypeFormName('');
    setTypeFormCode('');
    setTypeFormGroup('CASTE');
    setTypeFormDesc('');
    setTypeError('');

    // Prepopulate rules mapping for every fee head with 0% waiver
    const rulesMap = {};
    feeHeads.forEach(h => {
      rulesMap[h.id] = {
        waiver_percent: '0',
        waiver_amount: '0',
        applicable_fee: String(h.base_amount),
        reason: ''
      };
    });
    setTypeHeadRules(rulesMap);
    setShowTypeModal(true);
  };

  const handleOpenEditType = (type) => {
    setModalYearTab(feeYearTab);
    setEditingType(type);
    setTypeFormName(type.name);
    setTypeFormCode(type.code);
    setTypeFormGroup(type.type_group || 'CASTE');
    setTypeFormDesc(type.description || '');
    setTypeError('');

    const rulesMap = {};
    feeHeads.forEach(h => {
      const existingRule = (type.rules || []).find(r => r.fee_head_id === h.id);
      const baseAmt = Number(h.base_amount);
      const pct = existingRule ? Number(existingRule.waiver_percent || 0) : 0;
      const fixAmt = existingRule ? Number(existingRule.waiver_amount || 0) : 0;
      const discount = Math.max(baseAmt * (pct / 100), fixAmt);
      const netDue = Math.max(0, baseAmt - discount);

      rulesMap[h.id] = {
        waiver_percent: existingRule ? String(existingRule.waiver_percent) : '0',
        waiver_amount: existingRule ? String(existingRule.waiver_amount) : '0',
        applicable_fee: String(Math.round(netDue * 100) / 100),
        reason: existingRule ? (existingRule.reason || '') : ''
      };
    });
    setTypeHeadRules(rulesMap);
    setShowTypeModal(true);
  };

  const handleApplicableFeeChange = (headId, val, baseAmt) => {
    if (val === '') {
      setTypeHeadRules(prev => ({
        ...prev,
        [headId]: {
          ...prev[headId],
          applicable_fee: '',
          waiver_percent: '0',
          waiver_amount: '0'
        }
      }));
      return;
    }

    const numVal = parseFloat(val);
    if (isNaN(numVal)) {
      setTypeHeadRules(prev => ({
        ...prev,
        [headId]: {
          ...prev[headId],
          applicable_fee: val
        }
      }));
      return;
    }

    const cappedFee = Math.max(0, Math.min(baseAmt, numVal));
    const discountAmt = Math.max(0, baseAmt - cappedFee);
    const calculatedPct = baseAmt > 0 ? ((discountAmt / baseAmt) * 100) : 0;
    const roundedPct = Math.round(calculatedPct * 100) / 100;

    let defaultReason = '';
    if (roundedPct === 100) defaultReason = `100% Waived (${typeFormName || 'Scheme'})`;
    else if (roundedPct > 0) defaultReason = `${roundedPct}% Concession (Fee: ₹${cappedFee.toLocaleString('en-IN')})`;
    else defaultReason = 'Standard Fee';

    setTypeHeadRules(prev => ({
      ...prev,
      [headId]: {
        ...prev[headId],
        applicable_fee: val,
        waiver_percent: String(roundedPct),
        waiver_amount: String(Math.round(discountAmt * 100) / 100),
        reason: prev[headId]?.reason || defaultReason
      }
    }));
  };

  const handleWaiverPercentChange = (headId, val, baseAmt) => {
    if (val === '') {
      setTypeHeadRules(prev => ({
        ...prev,
        [headId]: {
          ...prev[headId],
          waiver_percent: '',
          waiver_amount: '0',
          applicable_fee: String(baseAmt)
        }
      }));
      return;
    }

    const numPct = parseFloat(val);
    if (isNaN(numPct)) {
      setTypeHeadRules(prev => ({
        ...prev,
        [headId]: {
          ...prev[headId],
          waiver_percent: val
        }
      }));
      return;
    }

    const cappedPct = Math.max(0, Math.min(100, numPct));
    const discountAmt = baseAmt * (cappedPct / 100);
    const netDue = Math.max(0, baseAmt - discountAmt);

    let defaultReason = '';
    if (cappedPct === 100) defaultReason = `100% Waived (${typeFormName || 'Scheme'})`;
    else if (cappedPct > 0) defaultReason = `${cappedPct}% Discount (${typeFormName || 'Scheme'})`;
    else defaultReason = 'Standard Fee';

    setTypeHeadRules(prev => ({
      ...prev,
      [headId]: {
        ...prev[headId],
        waiver_percent: val,
        waiver_amount: String(Math.round(discountAmt * 100) / 100),
        applicable_fee: String(Math.round(netDue * 100) / 100),
        reason: prev[headId]?.reason || defaultReason
      }
    }));
  };

  const handleRuleChange = (headId, field, val) => {
    setTypeHeadRules(prev => ({
      ...prev,
      [headId]: {
        ...prev[headId],
        [field]: val
      }
    }));
  };

  const handleApplyPreset = (headId, percent, defaultReason, baseAmt) => {
    const discountAmt = baseAmt * (percent / 100);
    const netDue = Math.max(0, baseAmt - discountAmt);
    setTypeHeadRules(prev => ({
      ...prev,
      [headId]: {
        ...prev[headId],
        waiver_percent: String(percent),
        waiver_amount: String(Math.round(discountAmt * 100) / 100),
        applicable_fee: String(Math.round(netDue * 100) / 100),
        reason: defaultReason
      }
    }));
  };

  const handleSaveTypeSubmit = async (e) => {
    e.preventDefault();
    setTypeError('');

    const trimmedName = (typeFormName || '').trim();
    const trimmedCode = (typeFormCode || '').trim().toUpperCase();

    if (!trimmedName && !trimmedCode) {
      setTypeError('Please fill in all required fields (*): Fee Type Name and Code.');
      return;
    }
    if (!trimmedName) {
      setTypeError('Fee Type Name (*) is required. Please fill in this field.');
      return;
    }
    if (!trimmedCode) {
      setTypeError('Fee Type Code (*) is required. Please fill in this field.');
      return;
    }

    let invalidRuleMsg = null;
    const rulesList = [];
    for (const [headId, r] of Object.entries(typeHeadRules)) {
      const pct = parseFloat(r.waiver_percent) || 0;
      const amt = parseFloat(r.waiver_amount) || 0;
      if (pct < 0 || pct > 100) {
        invalidRuleMsg = 'Waiver percentage must be between 0% and 100%.';
        break;
      }
      if (amt < 0) {
        invalidRuleMsg = 'Fixed waiver amount cannot be negative.';
        break;
      }
      rulesList.push({
        fee_head_id: parseInt(headId),
        waiver_percent: pct,
        waiver_amount: amt,
        reason: (r.reason || '').trim() || null
      });
    }

    if (invalidRuleMsg) {
      setTypeError(invalidRuleMsg);
      return;
    }

    setSavingType(true);
    try {
      const payload = {
        name: trimmedName,
        code: trimmedCode,
        type_group: typeFormGroup,
        academic_year: '2026-2027',
        description: (typeFormDesc || '').trim() || null,
        is_active: true,
        rules: rulesList
      };

      if (editingType) {
        await api.updateFeeType(editingType.id, payload);
      } else {
        await api.createFeeType(payload);
      }

      setShowTypeModal(false);
      const updatedTypes = await api.getFeeTypes('2026-2027');
      setFeeTypes(updatedTypes);
      
      await api.reapplyFeeRules('2026-2027');
      setReapplyMsg(`Fee Type "${payload.name}" saved! All student ledgers have been re-evaluated with updated waiver rules.`);
      setTimeout(() => setReapplyMsg(''), 7000);
    } catch (err) {
      setTypeError(err.message || 'Failed to save Fee Type. Please check input values.');
    } finally {
      setSavingType(false);
    }
  };

  const handleOpenDeleteTypeConfirm = (typeId, typeName) => {
    setDeleteTypeDialog({
      isOpen: true,
      typeId,
      typeName,
      loading: false
    });
  };

  const handleConfirmDeleteType = async () => {
    if (!deleteTypeDialog.typeId) return;
    setDeleteTypeDialog(prev => ({ ...prev, loading: true }));
    try {
      await api.deleteFeeType(deleteTypeDialog.typeId);
      const updatedTypes = await api.getFeeTypes('2026-2027');
      setFeeTypes(updatedTypes);
      await api.reapplyFeeRules('2026-2027');
      setDeleteTypeDialog({ isOpen: false, typeId: null, typeName: '', loading: false });
      setReapplyMsg(`Fee Type "${deleteTypeDialog.typeName}" deleted and student ledgers updated.`);
      setTimeout(() => setReapplyMsg(''), 5000);
    } catch (err) {
      setDeleteTypeDialog({ isOpen: false, typeId: null, typeName: '', loading: false });
      setAlertModal({
        isOpen: true,
        type: 'danger',
        title: 'Delete Failed',
        message: err.message || 'Failed to delete fee type.'
      });
    }
  };

  const handleManualReapplyRules = async () => {
    setReapplyingRules(true);
    setReapplyMsg('');
    try {
      const res = await api.reapplyFeeRules('2026-2027');
      setReapplyMsg(`Success: ${res.message}`);
      setTimeout(() => setReapplyMsg(''), 6000);
    } catch (err) {
      setReapplyMsg(`Failed: ${err.message || 'Error recalculating fees'}`);
      setTimeout(() => setReapplyMsg(''), 6000);
    } finally {
      setReapplyingRules(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateFeeHead = async (head) => {
    const amt = parseFloat(headAmount);
    if (isNaN(amt) || amt < 0) {
      setAlertModal({
        isOpen: true,
        type: 'warning',
        title: 'Invalid Fee Amount',
        message: 'Fee amount must be a valid number greater than or equal to ₹0.'
      });
      return;
    }
    try {
      await api.updateFeeHead(head.id, { base_amount: amt });
      setEditingHead(null);
      loadData();
      setReapplyMsg(`Base fee for "${head.name}" updated to ₹${amt.toLocaleString('en-IN')}! All student fee ledgers synchronized.`);
      setTimeout(() => setReapplyMsg(''), 6000);
    } catch (e) {
      setAlertModal({
        isOpen: true,
        type: 'danger',
        title: 'Update Failed',
        message: e.message || 'Failed to update fee head.'
      });
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
      setBackupMsg(`Error: ${e.message || 'Failed to create backup snapshot'}`);
      setTimeout(() => setBackupMsg(''), 6000);
    } finally {
      setCreatingBackup(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserMsg('');
    setUserError('');

    const u = (newUsername || '').trim();
    const fn = (newFullName || '').trim();
    const pw = newPassword || '';

    if (!fn) {
      setUserError('Full Staff Name (*) is required. Please fill in this field.');
      return;
    }
    if (!u || u.length < 3) {
      setUserError('Username (*) is required and must be at least 3 characters.');
      return;
    }
    if (!pw || pw.length < 4) {
      setUserError('Password (*) is required and must be at least 4 characters.');
      return;
    }

    try {
      await api.createUser({
        username: u,
        password: pw,
        full_name: fn,
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
      setUserError(e.message || 'Failed to create user account.');
    }
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    setSmtpMsg('');
    setSmtpError('');

    const port = parseInt(smtpPort);
    if (isNaN(port) || port < 1 || port > 65535) {
      setSmtpError('Please enter a valid SMTP port number (e.g. 587 or 465).');
      return;
    }

    try {
      await api.updateSmtpSettings({
        smtp_host: (smtpHost || '').trim(),
        smtp_port: port,
        smtp_username: (smtpUser || '').trim(),
        smtp_password: smtpPass,
        smtp_from_email: (smtpFrom || '').trim(),
        smtp_from_name: (smtpName || '').trim(),
        use_tls: smtpTls
      });
      setSmtpMsg('SMTP Settings saved successfully!');
      setTimeout(() => setSmtpMsg(''), 4000);
    } catch (e) {
      setSmtpError(e.message || 'Failed to save SMTP settings.');
    }
  };

  const handleTestSmtp = async () => {
    setSmtpMsg('');
    setSmtpError('');

    const trimmedTest = (testEmailTo || '').trim();
    if (!trimmedTest) {
      setSmtpError('Please enter a recipient email address for testing.');
      return;
    }

    setTestingSmtp(true);
    try {
      const res = await api.testSmtp({
        test_email: trimmedTest,
        smtp_host: (smtpHost || '').trim(),
        smtp_port: parseInt(smtpPort),
        smtp_username: (smtpUser || '').trim(),
        smtp_password: smtpPass,
        smtp_from_email: (smtpFrom || '').trim(),
        smtp_from_name: (smtpName || '').trim(),
        use_tls: smtpTls
      });
      setSmtpMsg(res.message);
    } catch (e) {
      setSmtpError('SMTP Test Failed: ' + (e.message || 'Unknown network error'));
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

        <button
          onClick={() => {
            setActiveTab('audit');
            loadAuditLogs();
          }}
          className={`py-3 px-6 text-xs font-bold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'audit'
              ? 'border-blue-600 text-blue-700 bg-blue-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          Security Audit Trail
        </button>
      </div>


      {/* 1. FEE HEADS CONFIGURATION */}
      {activeTab === 'fees' && (
        <div className="space-y-4">
          {/* Dedicated Sub-Tab Bar to switch between 1st and 2nd Year fees */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2 pr-1">
                Select Year:
              </span>
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setEditingHead(null);
                    setFeeYearTab(1);
                  }}
                  className={`py-2 px-5 rounded-md text-xs font-bold transition flex items-center gap-2 ${
                    feeYearTab === 1
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  1st Year Fees (MBA-I)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingHead(null);
                    setFeeYearTab(2);
                  }}
                  className={`py-2 px-5 rounded-md text-xs font-bold transition flex items-center gap-2 ${
                    feeYearTab === 2
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  2nd Year Fees (MBA-II)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pr-3 text-xs">
              <span className="text-slate-500 font-medium">
                Total {feeYearTab === 1 ? '1st Year' : '2nd Year'} Base Fee:
              </span>
              <span className="font-mono font-bold text-sm text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                ₹{feeHeads
                  .filter(h => (h.year_of_study || 1) === feeYearTab)
                  .reduce((acc, h) => acc + Number(h.base_amount || 0), 0)
                  .toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="border-b pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Standard Academic Fee Heads — {feeYearTab === 1 ? '1st Year (MBA-I)' : '2nd Year (MBA-II)'}
                </h3>
                <p className="text-xs text-slate-500">
                  Configure base amounts for {feeYearTab === 1 ? '1st Year (MBA-I)' : '2nd Year (MBA-II)'} (Academic Year 2026-2027). Waivers calculate automatically based on rules.
                </p>
              </div>
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
                  {feeHeads
                    .filter(h => (h.year_of_study || 1) === feeYearTab)
                    .map((head) => (
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

          {/* 1.2 FEE CONCESSION TYPES & WAIVER MATRIX */}
          <div className="pt-6 border-t border-slate-200 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  Student Categories & Fee Concession Types (Waiver Rules)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Define what gets waived or applied for each category (e.g. Girls, SC/ST, EBC, Open, TFWS) across all fee heads.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleManualReapplyRules}
                  disabled={reapplyingRules}
                  title="Re-calculate all enrolled students using current waiver rules"
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition border border-slate-300 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${reapplyingRules ? 'animate-spin text-blue-600' : ''}`} />
                  {reapplyingRules ? 'Recalculating...' : 'Recalculate All Student Fees'}
                </button>

                <button
                  type="button"
                  onClick={handleOpenAddType}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add New Fee Type
                </button>
              </div>
            </div>

            {reapplyMsg && (
              <div className="p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl flex items-center gap-2 font-medium">
                <CheckCircle className="w-4 h-4 text-blue-600 shrink-0" />
                {reapplyMsg}
              </div>
            )}

            {/* Type Group Filter Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2 text-xs">
              <span className="text-slate-400 font-semibold text-[11px] uppercase mr-1">Filter Types:</span>
              {[
                { key: 'ALL', label: `All Types (${feeTypes.length})` },
                { key: 'CASTE', label: `Caste / Category (${feeTypes.filter(t => t.type_group === 'CASTE').length})` },
                { key: 'GENDER', label: `Gender Rules (${feeTypes.filter(t => t.type_group === 'GENDER').length})` },
                { key: 'CUSTOM', label: `Special / Custom (${feeTypes.filter(t => t.type_group === 'CUSTOM').length})` }
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setTypeFilter(tab.key)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition ${
                    typeFilter === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Types Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {feeTypes
                .filter(t => typeFilter === 'ALL' || t.type_group === typeFilter)
                .map(t => (
                  <div
                    key={t.id}
                    className="p-4 bg-slate-50/60 rounded-xl border border-slate-200 shadow-sm space-y-3 hover:border-slate-300 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{t.name}</span>
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                            {t.code}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            t.type_group === 'CASTE'
                              ? 'bg-purple-100 text-purple-800'
                              : t.type_group === 'GENDER'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {t.type_group}
                          </span>
                        </div>
                        {t.description && (
                          <p className="text-[11px] text-slate-500 mt-1">{t.description}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditType(t)}
                          title="Edit Waiver Rules for this Type"
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {t.type_group === 'CUSTOM' && (
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteTypeConfirm(t.id, t.name)}
                            title="Delete Fee Type"
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Breakdown across fee heads */}
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 space-y-1.5 text-[11px]">
                      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                        Configured Waivers ({feeYearTab === 1 ? '1st Year' : '2nd Year'}):
                      </div>
                      {feeHeads.filter(h => (h.year_of_study || 1) === feeYearTab).map(h => {
                        const rule = (t.rules || []).find(r => r.fee_head_id === h.id);
                        const pct = rule ? Number(rule.waiver_percent) : 0;
                        const amt = rule ? Number(rule.waiver_amount) : 0;
                        const isWaived = pct > 0 || amt > 0;
                        return (
                          <div key={h.id} className="flex items-center justify-between py-0.5">
                            <span className="text-slate-600 truncate max-w-[170px]">{h.name}:</span>
                            <span className={`font-mono font-bold ${isWaived ? 'text-emerald-700' : 'text-slate-400'}`}>
                              {pct >= 100
                                ? '100% Waived (₹0 Net)'
                                : pct > 0
                                ? `${pct}% Waived`
                                : amt > 0
                                ? `₹${amt} Discount`
                                : '0% (Full Fee)'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
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
                          <button
                            type="button"
                            onClick={() => handleDownloadBackup(b.filename)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold border cursor-pointer transition"
                          >
                            <Download className="w-3 h-3" />
                            Download .db
                          </button>
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
            {userError && (
              <div className="p-2.5 mb-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg font-medium">
                {userError}
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
          {smtpError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-medium">
              {smtpError}
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

      {/* 5. SECURITY AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">System & Financial Audit Trail</h3>
              <p className="text-xs text-slate-500">
                Immutable, timestamped record of administrative overrides, payments, fine waivers, and user mutations.
              </p>
            </div>
            <button
              type="button"
              onClick={loadAuditLogs}
              disabled={loadingAudit}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAudit ? 'animate-spin' : ''}`} />
              Refresh Audit Trail
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                <tr>
                  <th className="px-4 py-3">Timestamp (UTC)</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Target Entity</th>
                  <th className="px-4 py-3">User ID</th>
                  <th className="px-4 py-3">Transaction Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-4 py-8 text-center text-slate-400 italic">
                      No audit logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => {
                    let badgeColor = 'bg-slate-100 text-slate-700';
                    if (log.action.includes('PAYMENT')) badgeColor = 'bg-emerald-100 text-emerald-800';
                    else if (log.action.includes('WAIVE')) badgeColor = 'bg-amber-100 text-amber-800';
                    else if (log.action.includes('DELETE')) badgeColor = 'bg-rose-100 text-rose-800';
                    else if (log.action.includes('BACKUP') || log.action.includes('USER')) badgeColor = 'bg-blue-100 text-blue-800';

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeColor}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-800 uppercase text-[11px]">
                          {log.entity_name}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600">
                          {log.user_id ? `User #${log.user_id}` : 'System'}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-600 max-w-md truncate" title={log.details}>
                          {log.details || '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {/* 5. MODAL: ADD / EDIT FEE CONCESSION TYPE */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in fade-in-50 duration-150 max-h-[90vh] flex flex-col">
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">
                  {editingType ? `Edit Fee Concession Type: ${editingType.name}` : 'Create New Fee Concession Type'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Configure waiver percentage (%) or fixed discount for each fee head
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTypeModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTypeSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              {typeError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg font-medium">
                  {typeError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Type Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EBC or Girl Student"
                    value={typeFormName}
                    onChange={(e) => setTypeFormName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-semibold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Code / Identifier *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. EBC or FEMALE"
                    value={typeFormCode}
                    onChange={(e) => setTypeFormCode(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Type Group *</label>
                  <select
                    value={typeFormGroup}
                    onChange={(e) => setTypeFormGroup(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 bg-white font-semibold"
                  >
                    <option value="CASTE">Caste / Social Category</option>
                    <option value="GENDER">Gender-Based Rule</option>
                    <option value="CUSTOM">Special / Custom Quota</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Description / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. 50% discount on Tuition fee for Economically Backward Class"
                  value={typeFormDesc}
                  onChange={(e) => setTypeFormDesc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Fee Heads Waiver Rules Matrix */}
              <div className="pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200">
                  <label className="block font-bold text-slate-800 uppercase text-[11px] tracking-wider">
                    Fee Heads Waiver Matrix:
                  </label>
                  <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setModalYearTab(1)}
                      className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                        modalYearTab === 1
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      1st Year Heads (MBA-I)
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalYearTab(2)}
                      className={`px-3 py-1 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                        modalYearTab === 2
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      2nd Year Heads (MBA-II)
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {feeHeads
                    .filter((head) => (head.year_of_study || 1) === modalYearTab)
                    .map((head) => {
                    const rule = typeHeadRules[head.id] || { waiver_percent: '0', waiver_amount: '0', reason: '' };
                    const baseAmt = Number(head.base_amount);
                    const pct = Number(rule.waiver_percent) || 0;
                    const discountAmt = Math.min(baseAmt, (baseAmt * (pct / 100)));
                    const netAmt = Math.max(0, baseAmt - discountAmt);

                    return (
                      <div key={head.id} className="p-3 bg-slate-50/50 hover:bg-slate-50 transition space-y-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <span className="font-bold text-slate-900">{head.name}</span>
                            <span className="text-slate-500 font-mono text-[11px] ml-2">
                              (Base: ₹{baseAmt.toLocaleString('en-IN')})
                            </span>
                            {!head.allows_waiver && (
                              <span className="ml-2 text-[10px] px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded font-semibold">
                                Typically Compulsory
                              </span>
                            )}
                          </div>

                          {/* Quick Presets */}
                          <div className="flex items-center gap-1.5 self-start sm:self-auto">
                            <span className="text-[10px] text-slate-400 font-semibold mr-1">Presets:</span>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(head.id, 100, `100% Waived (${typeFormName || 'Scheme'})`, baseAmt)}
                              className="px-2 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-bold rounded"
                            >
                              100% Waived (₹0)
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(head.id, 50, `50% Discount (${typeFormName || 'Scheme'})`, baseAmt)}
                              className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 text-[10px] font-bold rounded"
                            >
                              50% (₹{(baseAmt / 2).toLocaleString('en-IN')})
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApplyPreset(head.id, 0, `Standard Fee`, baseAmt)}
                              className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold rounded"
                            >
                              Full Fee (₹{baseAmt.toLocaleString('en-IN')})
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div>
                            <div className="flex items-center justify-between mb-0.5">
                              <label className="text-[10px] font-bold text-blue-900">
                                Applicable Fee (₹)
                              </label>
                              <span className="text-[9px] text-blue-600 font-bold bg-blue-50 px-1 rounded">Direct Entry</span>
                            </div>
                            <input
                              type="number"
                              min="0"
                              max={baseAmt}
                              step="0.01"
                              placeholder={`e.g. ${baseAmt}`}
                              value={rule.applicable_fee !== undefined ? rule.applicable_fee : String(netAmt)}
                              onChange={(e) => handleApplicableFeeChange(head.id, e.target.value, baseAmt)}
                              className="w-full px-2.5 py-1.5 border-2 border-blue-400 focus:border-blue-600 rounded-lg focus:ring-1 focus:ring-blue-600 font-mono font-black text-xs text-blue-950 bg-blue-50/20"
                            />
                            <div className="text-[9px] text-slate-500 mt-0.5">
                              Amount student pays personally
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-0.5">
                              <label className="text-[10px] font-semibold text-slate-600">
                                Waiver % / Discount
                              </label>
                              {discountAmt > 0 && (
                                <span className="text-[9px] text-emerald-700 font-bold">
                                  -₹{discountAmt.toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={rule.waiver_percent}
                              onChange={(e) => handleWaiverPercentChange(head.id, e.target.value, baseAmt)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 font-mono font-bold text-xs bg-white"
                            />
                            <div className="text-[9px] text-slate-500 mt-0.5">
                              {discountAmt > 0 ? `Govt/Quota saves ₹${discountAmt.toLocaleString('en-IN')}` : 'Standard full fee'}
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Reason / Display Note</label>
                            <input
                              type="text"
                              placeholder="e.g. 50% OBC Concession"
                              value={rule.reason}
                              onChange={(e) => handleRuleChange(head.id, 'reason', e.target.value)}
                              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-600 text-xs bg-white"
                            />
                            <div className="text-[9px] text-slate-400 mt-0.5">
                              Shown on student ledger & voucher
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowTypeModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-100 font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingType}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow transition disabled:opacity-50"
                >
                  {savingType ? 'Saving & Applying...' : (editingType ? 'Save & Apply Rules' : 'Create & Apply Type')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Fee Type Confirmation Modal */}
      <ModalDialog
        isOpen={deleteTypeDialog.isOpen}
        type="danger"
        title="Delete Fee Concession Type"
        message={`Are you sure you want to permanently delete the Fee Type "${deleteTypeDialog.typeName}"? All enrolled student ledgers will automatically re-evaluate under standard baseline rules.`}
        confirmText="Yes, Delete Fee Type"
        cancelText="Cancel"
        confirmVariant="danger"
        loading={deleteTypeDialog.loading}
        onConfirm={handleConfirmDeleteType}
        onClose={() => setDeleteTypeDialog({ isOpen: false, typeId: null, typeName: '', loading: false })}
      />

      {/* Action / Error Notification Modal */}
      <ModalDialog
        isOpen={alertModal.isOpen}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        confirmText="Close"
        confirmVariant={alertModal.type === 'danger' ? 'danger' : (alertModal.type === 'warning' ? 'warning' : 'primary')}
        onClose={() => setAlertModal({ isOpen: false, title: '', message: '', type: 'info' })}
      />
    </div>
  );
}

