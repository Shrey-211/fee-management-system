const API_BASE = '/api';

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
      errorDetail = errData.detail || JSON.stringify(errData);
    } catch (e) {
      errorDetail = response.statusText;
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

  // Payments & Cash
  getPayments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/payments${q ? `?${q}` : ''}`);
  },
  createPayment: (data) => request('/payments', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  getCashStatus: () => request('/batches/cash-status'),
  getBatches: () => request('/batches'),
  createBatch: (data) => request('/batches', {
    method: 'POST',
    body: JSON.stringify(data)
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
  downloadBackupUrl: (filename) => `${API_BASE}/settings/download-backup/${filename}`,
  getSmtpSettings: () => request('/settings/smtp'),
  updateSmtpSettings: (data) => request('/settings/smtp', {
    method: 'POST',
    body: JSON.stringify(data)
  })
};
