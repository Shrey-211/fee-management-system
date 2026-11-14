const API_BASE = '/api';

function formatFieldName(rawName) {
  if (!rawName) return '';
  const fieldMap = {
    dob: 'Date of Birth',
    student_code: 'Student ID / Roll Code',
    full_name: 'Full Name',
    concession_type_id: 'Fee Concession Type',
    mobile_number: 'Mobile Number',
    email_address: 'Email Address',
    course_branch: 'Course / Branch',
    current_year: 'Current Year',
    physical_receipt_no: 'Manual Receipt Book #',
    payment_date: 'Receipt Date',
    payment_mode: 'Payment Mode',
    fine_date: 'Date Levied',
    event_name: 'Event / Reason',
    credit_date: 'Credit Date',
    scholarship_name: 'Scholarship Scheme Name',
    amount: 'Amount',
    base_amount: 'Fee Amount',
    old_password: 'Current Password',
    new_password: 'New Password',
  };
  if (fieldMap[rawName]) return fieldMap[rawName];
  return rawName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function parseErrorDetail(errData, statusText) {
  if (!errData) return statusText || 'An unexpected error occurred';
  
  if (typeof errData.detail === 'string' && errData.detail.trim()) {
    return errData.detail.trim();
  }

  if (Array.isArray(errData.detail) && errData.detail.length > 0) {
    const errorLines = errData.detail.map(item => {
      let field = '';
      if (Array.isArray(item.loc) && item.loc.length > 0) {
        field = item.loc[item.loc.length - 1];
      }
      const label = formatFieldName(field);
      const msg = item.msg || '';
      const type = item.type || '';

      if (type.includes('missing') || msg.toLowerCase().includes('required')) {
        return label ? `"${label}" is required. Please fill in all required fields.` : 'Please fill in all required fields.';
      }
      if (type.includes('date') || msg.toLowerCase().includes('date')) {
        return label ? `"${label}" must be a valid date (or leave empty if optional).` : 'Invalid date format.';
      }
      if (msg.toLowerCase().includes('greater than 0') || type.includes('greater_than')) {
        return label ? `"${label}" must be greater than 0.` : 'Amount must be greater than 0.';
      }
      return label ? `${label}: ${msg}` : msg;
    });
    return errorLines.join(' | ');
  }

  if (errData.detail && typeof errData.detail === 'object') {
    if (errData.detail.message && typeof errData.detail.message === 'string') {
      return errData.detail.message;
    }
    return JSON.stringify(errData.detail);
  }

  if (typeof errData.message === 'string' && errData.message.trim()) {
    return errData.message.trim();
  }

  return typeof errData === 'string' ? errData : JSON.stringify(errData);
}

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    ...getAuthHeaders(),
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  
  if (response.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth-expired'));
  }

  if (!response.ok) {
    let errorDetail = 'An error occurred';
    try {
      const errData = await response.json();
      errorDetail = parseErrorDetail(errData, response.statusText);
    } catch (e) {
      errorDetail = response.statusText || 'Network request failed';
    }
    throw new Error(errorDetail);
  }

  // Handle binary downloads (Excel, SQLite files)
  const contentType = response.headers.get('content-type');
  if (contentType && (
    contentType.includes('spreadsheetml') || 
    contentType.includes('sqlite') || 
    contentType.includes('octet-stream')
  )) {
    return response.blob();
  }

  return response.json();
}

export const api = {
  // Auth
  login: (username, password) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  }),
  getMe: () => request('/auth/me'),
  changePassword: (old_password, new_password) => request('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ old_password, new_password })
  }),
  getUsers: () => request('/auth/users'),
  createUser: (data) => request('/auth/users', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateUser: (id, data) => request(`/auth/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  // Students
  getStudents: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/students${q ? `?${q}` : ''}`);
  },
  getStudent: (id) => request(`/students/${id}`),
  createStudent: (data) => request('/students', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateStudent: (id, data) => request(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  // Fees
  getFeeHeads: (academicYear) => request(`/fees/heads${academicYear ? `?academic_year=${academicYear}` : ''}`),
  updateFeeHead: (id, data) => request(`/fees/heads/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  getFeeTypes: (academicYear) => request(`/fees/types${academicYear ? `?academic_year=${academicYear}` : ''}`),
  getFeeType: (id) => request(`/fees/types/${id}`),
  createFeeType: (data) => request('/fees/types', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateFeeType: (id, data) => request(`/fees/types/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteFeeType: (id) => request(`/fees/types/${id}`, {
    method: 'DELETE'
  }),
  reapplyFeeRules: (academicYear) => request(`/fees/reapply-rules${academicYear ? `?academic_year=${academicYear}` : ''}`, {
    method: 'POST'
  }),

  // Payments
  getPayments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/payments${q ? `?${q}` : ''}`);
  },
  createPayment: (data) => request('/payments', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updatePayment: (id, data) => request(`/payments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deletePayment: (id) => request(`/payments/${id}`, {
    method: 'DELETE'
  }),

  // Fines
  getFines: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/fines${q ? `?${q}` : ''}`);
  },
  createFine: (data) => request('/fines', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateFine: (id, data) => request(`/fines/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),

  // Scholarships
  getScholarships: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/scholarships${q ? `?${q}` : ''}`);
  },
  createScholarship: (data) => request('/scholarships', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  markScholarshipReceived: (id, data = {}) => request(`/scholarships/${id}/mark-received`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  markScholarshipPending: (id) => request(`/scholarships/${id}/mark-pending`, {
    method: 'PUT'
  }),
  deleteScholarshipDisbursement: (scholarshipId, disbursementId) => request(`/scholarships/${scholarshipId}/disbursements/${disbursementId}`, {
    method: 'DELETE'
  }),

  // Reports
  getDailyReport: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/reports/daily${q ? `?${q}` : ''}`);
  },
  downloadDailyReportExcel: async (startDate, endDate) => {
    const q = new URLSearchParams({ start_date: startDate, end_date: endDate }).toString();
    const blob = await request(`/reports/daily/excel?${q}`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fee_collection_${startDate}_to_${endDate}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },
  downloadOutstandingExcel: async (academicYear) => {
    const q = academicYear ? `?academic_year=${academicYear}` : '';
    const blob = await request(`/reports/outstanding/excel${q}`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `outstanding_balances.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  // Reminders
  getTemplates: () => request('/reminders/templates'),
  updateTemplate: (id, data) => request(`/reminders/templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  sendReminders: (data) => request('/reminders/send', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getReminderLogs: () => request('/reminders/logs'),
  testSmtp: (data) => request('/reminders/test', {
    method: 'POST',
    body: JSON.stringify(data)
  }),

  // Settings & Backup
  getBackups: () => request('/settings/backups'),
  createBackup: () => request('/settings/backups/create', { method: 'POST' }),
  downloadBackup: async (filename) => {
    const blob = await request(`/settings/backups/download/${filename}`);
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  },
  downloadBackupUrl: (filename) => `${API_BASE}/settings/backups/download/${filename}`,
  getAuditLogs: (limit = 100) => request(`/settings/audit-logs?limit=${limit}`),
  getSmtpSettings: () => request('/settings/smtp'),

  updateSmtpSettings: (data) => request('/settings/smtp', {
    method: 'POST',
    body: JSON.stringify(data)
  })
};

