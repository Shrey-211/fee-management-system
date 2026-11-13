import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import { Mail, Send, CheckSquare, Square, Edit3, Clock, CheckCircle2, AlertTriangle, Save, Search } from 'lucide-react';
import ModalDialog from '../components/ModalDialog';

export default function Reminders() {
  const [students, setStudents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [studentSearch, setStudentSearch] = useState('');

  // Selection
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [targetDueDate, setTargetDueDate] = useState('Within 7 Days');

  // Custom Dialog States
  const [confirmSendDialog, setConfirmSendDialog] = useState(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  // Template Editing
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateSavedMsg, setTemplateSavedMsg] = useState('');

  // Dispatch Status
  const [sending, setSending] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sList, tList, lList] = await Promise.all([
        api.getStudents({ has_dues_only: true }),
        api.getTemplates(),
        api.getReminderLogs()
      ]);
      // Filter students with email addresses and dues > 0
      const eligible = sList.filter(s => s.email_address && Number(s.overall_balance) > 0);
      setStudents(eligible);
      setSelectedStudentIds(eligible.map(s => s.id)); // Default select all

      setTemplates(tList);
      if (tList.length > 0) {
        const def = tList.find(t => t.is_default) || tList[0];
        setSelectedTemplate(def);
        setSubject(def.subject);
        setBody(def.body_template);
      }
      setLogs(lList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleSelect = (id) => {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredStudents = students.filter((s) => {
    if (!studentSearch.trim()) return true;
    const q = studentSearch.toLowerCase();
    return (
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.student_code || '').toLowerCase().includes(q) ||
      (s.email_address || '').toLowerCase().includes(q)
    );
  });

  const toggleSelectAll = () => {
    const targetList = studentSearch ? filteredStudents : students;
    if (targetList.length === 0) return;
    const allTargetSelected = targetList.every(s => selectedStudentIds.includes(s.id));
    if (allTargetSelected) {
      const targetIds = new Set(targetList.map(s => s.id));
      setSelectedStudentIds(prev => prev.filter(id => !targetIds.has(id)));
    } else {
      const targetIds = targetList.map(s => s.id);
      setSelectedStudentIds(prev => Array.from(new Set([...prev, ...targetIds])));
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;

    const trimmedSubject = (subject || '').trim();
    const trimmedBody = (body || '').trim();

    if (!trimmedSubject || !trimmedBody) {
      setAlertModal({
        isOpen: true,
        type: 'warning',
        title: 'Missing Template Content',
        message: 'Please fill in both the Subject line and Body Template text before saving.'
      });
      return;
    }

    setSavingTemplate(true);
    setTemplateSavedMsg('');
    try {
      await api.updateTemplate(selectedTemplate.id, {
        subject: trimmedSubject,
        body_template: trimmedBody
      });
      setTemplateSavedMsg('Template saved successfully!');
      setTimeout(() => setTemplateSavedMsg(''), 4000);
    } catch (e) {
      setAlertModal({
        isOpen: true,
        type: 'danger',
        title: 'Save Failed',
        message: e.message || 'Failed to save email template.'
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleOpenSendConfirm = () => {
    if (selectedStudentIds.length === 0) {
      setAlertModal({
        isOpen: true,
        type: 'warning',
        title: 'No Students Selected',
        message: 'Please select at least one student from the recipient list before dispatching reminders.'
      });
      return;
    }
    setConfirmSendDialog(true);
  };

  const handleExecuteSend = async () => {
    setConfirmSendDialog(false);
    setSending(true);
    setDispatchResult(null);
    try {
      const res = await api.sendReminders({
        student_ids: selectedStudentIds,
        template_id: selectedTemplate?.id,
        target_due_date: targetDueDate
      });
      setDispatchResult(res);
      const lList = await api.getReminderLogs();
      setLogs(lList);
    } catch (e) {
      setAlertModal({
        isOpen: true,
        type: 'danger',
        title: 'Dispatch Failed',
        message: e.message || 'Error triggering reminder dispatch.'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-indigo-600" />
            Email Reminders Engine (College SMTP)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Dispatch personalized fee dues reminders using the college's configured SMTP mailbox
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Target Due Date (e.g. Within 7 Days)"
            value={targetDueDate}
            onChange={(e) => setTargetDueDate(e.target.value)}
            className="px-3 py-1.5 text-xs border rounded-lg focus:ring-2 focus:ring-blue-600"
          />
          <button
            onClick={handleOpenSendConfirm}
            disabled={sending || selectedStudentIds.length === 0}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow transition disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Dispatching...' : `Dispatch to (${selectedStudentIds.length}) Students`}
          </button>
        </div>
      </div>

      {dispatchResult && (
        <div className="p-4 bg-slate-900 text-white rounded-xl shadow space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Dispatch Summary: {dispatchResult.total_dispatched} Processed
            </h4>
            <div className="flex items-center gap-3 font-mono">
              <span className="text-emerald-400">Success: {dispatchResult.successful}</span>
              <span className="text-rose-400">Failed / Offline: {dispatchResult.failed}</span>
            </div>
          </div>
          {dispatchResult.failed > 0 && (
            <p className="text-amber-300 text-[11px]">
              Note: Unsuccessful deliveries occur if SMTP credentials are unconfigured or when offline. Delivery status is logged below.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Eligible Students Selector */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between">
          <div>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Students with Outstanding Dues & Valid Emails
                </h3>
                <p className="text-[11px] text-slate-500">
                  {students.length} eligible recipients {studentSearch && `(${filteredStudents.length} matching search)`}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800"
              >
                {filteredStudents.length > 0 && filteredStudents.every(s => selectedStudentIds.includes(s.id))
                  ? 'Deselect All'
                  : 'Select All'}
              </button>
            </div>

            {/* Student Search Bar */}
            <div className="p-2.5 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search recipients by student name, code, or email..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="w-full text-xs bg-white px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {studentSearch && (
                <button
                  type="button"
                  onClick={() => setStudentSearch('')}
                  className="text-xs text-slate-400 hover:text-slate-600 px-1 font-semibold"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5 w-10">Select</th>
                    <th className="px-4 py-2.5">Student</th>
                    <th className="px-4 py-2.5">Email Address</th>
                    <th className="px-4 py-2.5 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-slate-400">
                        No students with pending dues and valid email addresses found.
                      </td>
                    </tr>
                  ) : filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-8 text-center text-slate-400">
                        No students matching "{studentSearch}".
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((s) => {
                      const isChecked = selectedStudentIds.includes(s.id);
                      return (
                        <tr
                          key={s.id}
                          onClick={() => toggleSelect(s.id)}
                          className={`cursor-pointer transition ${isChecked ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-4 py-3">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300" />
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-slate-900 block">{s.full_name}</span>
                            <span className="text-[10px] text-slate-500 font-mono">{s.student_code}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 font-mono text-[11px]">{s.email_address}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-rose-600">
                            ₹{Number(s.overall_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-3 bg-slate-50 border-t border-slate-100 text-xs flex items-center justify-between font-medium text-slate-600">
            <span>Selected Recipients: <strong>{selectedStudentIds.length}</strong></span>
          </div>
        </div>

        {/* Right: Editable Email Template */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Email Template Customizer
                </h3>
                <p className="text-[11px] text-slate-500">
                  Dynamic tags: <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">{'{student_name}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">{'{student_code}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">{'{total_due}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">{'{due_date}'}</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-indigo-700">{'{fee_breakdown}'}</code>
                </p>
              </div>
              <button
                onClick={handleSaveTemplate}
                disabled={savingTemplate}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <Save className="w-3.5 h-3.5" />
                {savingTemplate ? 'Saving...' : 'Save Template'}
              </button>
            </div>

            {templateSavedMsg && (
              <div className="p-2 bg-emerald-50 text-emerald-800 rounded text-[11px] font-medium border border-emerald-200">
                {templateSavedMsg}
              </div>
            )}

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-semibold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Message Body</label>
              <textarea
                rows="11"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-600 font-mono text-[11px] leading-relaxed"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Reminder Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Recent Reminder Dispatch Log
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">
            Last 50 dispatches
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5">Sent Timestamp</th>
                <th className="px-4 py-2.5">Student Name</th>
                <th className="px-4 py-2.5">Recipient Email</th>
                <th className="px-4 py-2.5">Subject</th>
                <th className="px-4 py-2.5 text-center">Status</th>
                <th className="px-4 py-2.5">Error / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-6 text-center text-slate-400">
                    No reminder emails logged yet.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 text-slate-500 font-mono">{l.sent_at?.replace('T', ' ').substring(0, 19)}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{l.student_name}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">{l.recipient_email}</td>
                    <td className="px-4 py-3 text-slate-700 truncate max-w-xs">{l.subject}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.status === 'SENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-[11px] italic">
                      {l.error_message || 'Delivered to SMTP server successfully'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Send Reminders Modal */}
      <ModalDialog
        isOpen={confirmSendDialog}
        type="info"
        title="Confirm Reminder Dispatch"
        message={`Are you sure you want to dispatch fee dues reminder emails to ${selectedStudentIds.length} selected student(s) via the college SMTP mailbox?`}
        confirmText={`Yes, Dispatch (${selectedStudentIds.length}) Reminders`}
        cancelText="Cancel"
        confirmVariant="primary"
        loading={sending}
        onConfirm={handleExecuteSend}
        onClose={() => setConfirmSendDialog(false)}
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

