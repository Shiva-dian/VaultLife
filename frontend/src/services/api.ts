import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => { failedQueue.push({ resolve, reject }); })
          .then((token) => { originalRequest.headers.Authorization = `Bearer ${token}`; return api(originalRequest); });
      }
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const res = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
        const newToken = res.data.data.accessToken;
        localStorage.setItem('accessToken', newToken);
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally { isRefreshing = false; }
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  register:         (data: { fullName: string; email: string; phone: string; password: string; otpChannel?: 'email'|'sms' }) => api.post('/auth/register', data),
  verifyRegistration:(data: { userId: string; otp: string; otpChannel?: string }) => api.post('/auth/register/verify', data),
  login:            (data: { identifier: string; password: string }) => api.post('/auth/login', data),
  verifyLoginOTP:   (data: { userId: string; otp: string })          => api.post('/auth/login/verify', data),
  resendOTP:        (data: { userId: string; purpose: string })      => api.post('/auth/resend-otp', data),
  forgotPassword:   (data: { identifier: string })                   => api.post('/auth/forgot-password', data),
  verifyForgotOTP:  (data: { userId: string; otp: string })          => api.post('/auth/forgot-password/verify', data),
  resetPassword:    (data: { userId: string; resetToken: string; newPassword: string }) => api.post('/auth/reset-password', data),
  refresh:          () => api.post('/auth/refresh'),
  logout:           () => api.post('/auth/logout'),
  getMe:            () => api.get('/auth/me'),
};

export const nomineesApi = {
  getAll:  ()                          => api.get('/nominees'),
  add:     (data: any)                 => api.post('/nominees', data),
  update:  (id: string, data: any)     => api.put(`/nominees/${id}`, data),
  remove:  (id: string)                => api.delete(`/nominees/${id}`),
};

export const policiesApi = {
  getAll:           (category?: string) => api.get(`/policies${category && category !== 'all' ? `?category=${category}` : ''}`),
  getNotifications: ()                  => api.get('/policies/notifications'),
  add:              (data: any)         => api.post('/policies', data),
  update:           (id: string, d: any)=> api.put(`/policies/${id}`, d),
  remove:           (id: string)        => api.delete(`/policies/${id}`),
};

export const vaultApi = {
  getProfile:        ()                    => api.get('/vault/profile'),
  updateProfile:     (data: any)           => api.patch('/vault/profile', data),
  getDashboard:      ()                    => api.get('/vault/dashboard'),
  getBankAccounts:   ()                    => api.get('/vault/bank-accounts'),
  addBankAccount:    (data: any)           => api.post('/vault/bank-accounts', data),
  updateBankAccount: (id: string, d: any)  => api.put(`/vault/bank-accounts/${id}`, d),
  deleteBankAccount: (id: string)          => api.delete(`/vault/bank-accounts/${id}`),
  getInvestments:    ()                    => api.get('/vault/investments'),
  addInvestment:     (data: any)           => api.post('/vault/investments', data),
  updateInvestment:  (id: string, d: any)  => api.put(`/vault/investments/${id}`, d),
  deleteInvestment:  (id: string)          => api.delete(`/vault/investments/${id}`),
};


// ── Real Estate API ──────────────────────────────────────────────
export const realEstateApi = {
  getAll:  ()                          => api.get('/properties/real-estate'),
  add:     (data: any)                 => api.post('/properties/real-estate', data),
  update:  (id: string, data: any)     => api.put(`/properties/real-estate/${id}`, data),
  remove:  (id: string)                => api.delete(`/properties/real-estate/${id}`),
};

// ── Liabilities API ──────────────────────────────────────────────
export const liabilitiesApi = {
  getAll:  (direction?: string)        => api.get(`/properties/liabilities${direction && direction!=='all'?`?direction=${direction}`:''}`),
  add:     (data: any)                 => api.post('/properties/liabilities', data),
  update:  (id: string, data: any)     => api.put(`/properties/liabilities/${id}`, data),
  remove:  (id: string)                => api.delete(`/properties/liabilities/${id}`),
};

export default api;

export const commoditiesApi = {
  getAll:  (type?: string) => api.get(`/properties/commodities${type && type !== 'all' ? `?type=${type}` : ''}`),
  add:     (data: any)                 => api.post('/properties/commodities', data),
  update:  (id: string, data: any)     => api.put(`/properties/commodities/${id}`, data),
  remove:  (id: string)                => api.delete(`/properties/commodities/${id}`),
};

// ── Documents API ─────────────────────────────────────────────────
export const documentsApi = {
  getLimits:  ()                           => api.get('/documents/limits'),
  getStats:   ()                           => api.get('/documents/stats'),
  getAll:     (params?: { module?: string; recordId?: string }) =>
    api.get('/documents', { params }),
  add:        (data: {
    module: string; recordId: string; docType?: string; docLabel?: string;
    fileName: string; fileSizeBytes: number; mimeType: string;
    storageUrl?: string; fileHash?: string; notes?: string;
  }) => api.post('/documents', data),
  remove:     (id: string)                 => api.delete(`/documents/${id}`),
};

// ── Policy Analysis API ──────────────────────────────────
export const policyAnalysisApi = {
  /**
   * Upload a PDF and trigger Gemini extraction.
   * @param file  The PDF File object from <input type="file">
   */
  upload: (file: File) => {
    const form = new FormData();
    form.append("pdf", file);
    return api.post("/policy-analysis/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000, // 2 min — Gemini PDF analysis can take time
    });
  },

  /** Fetch the latest (non-expired) analysis for the current user. */
  get: () => api.get("/policy-analysis"),

  /** Delete the current user's analysis. */
  delete: () => api.delete("/policy-analysis"),
};
