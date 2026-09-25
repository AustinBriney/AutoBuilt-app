const BASE = '/api';

// Set by AuthProvider whenever the signed-in token changes. Kept outside
// React state so every api.* call (including ones fired from outside a
// component) always sends the current token without threading it through
// every function signature.
let authToken = null;
export function setAuthToken(token) {
  authToken = token;
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      // ignore parse failure
    }
    throw new Error(message);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  signup: (data) => request('/auth/signup', { method: 'POST', body: JSON.stringify(data) }),
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/auth/me'),

  // Business
  getBusiness: () => request('/business'),
  updateBusiness: (data) => request('/business', { method: 'PATCH', body: JSON.stringify(data) }),
  getIntegrations: () => request('/business/integrations'),
  getCalcomWebhookInfo: () => request('/business/calcom-webhook-info'),
  uploadLogo: (dataUrl) => request('/business/logo', { method: 'POST', body: JSON.stringify({ dataUrl }) }),
  linkServiceToCalcom: (serviceId, calcomEventTypeId) =>
    request('/business/calcom-webhook-info/link-service', { method: 'PATCH', body: JSON.stringify({ serviceId, calcomEventTypeId }) }),

  // Services
  getServices: () => request('/services'),
  createService: (data) => request('/services', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id, data) => request(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteService: (id) => request(`/services/${id}`, { method: 'DELETE' }),

  // Availability
  getAvailability: () => request('/availability'),
  addAvailabilityRule: (data) => request('/availability/rules', { method: 'POST', body: JSON.stringify(data) }),
  updateAvailabilityRule: (id, data) => request(`/availability/rules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAvailabilityRule: (id) => request(`/availability/rules/${id}`, { method: 'DELETE' }),
  addTimeOff: (data) => request('/availability/time-off', { method: 'POST', body: JSON.stringify(data) }),
  deleteTimeOff: (id) => request(`/availability/time-off/${id}`, { method: 'DELETE' }),

  // Customers
  getCustomers: (q) => request(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getCustomer: (id) => request(`/customers/${id}`),
  updateCustomer: (id, data) => request(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCustomer: (id) => request(`/customers/${id}`, { method: 'DELETE' }),

  // Appointments
  getAppointments: (params) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return request(`/appointments${qs}`);
  },
  createAppointment: (data) => request('/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id, data) => request(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAppointment: (id) => request(`/appointments/${id}`, { method: 'DELETE' }),

  // Conversations
  getConversations: () => request('/conversations'),
  getConversation: (id) => request(`/conversations/${id}/messages`),
  sendMessage: (id, body) => request(`/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),

  // Dashboard
  getDashboardSummary: () => request('/dashboard/summary'),

  // Public (simulated external triggers, used by the Settings "test tools" panel).
  // These hit the slug-scoped public routes — same ones a real client site or
  // Twilio webhook would call — so testing here exercises the real path.
  simulateBooking: (slug, data) => request(`/public/${slug}/book`, { method: 'POST', body: JSON.stringify(data) }),
  simulateInboundSms: (slug, data) => request(`/public/${slug}/inbound-sms`, { method: 'POST', body: JSON.stringify(data) }),
  simulateMissedCall: (slug, data) => request(`/public/${slug}/missed-call`, { method: 'POST', body: JSON.stringify(data) }),
};
