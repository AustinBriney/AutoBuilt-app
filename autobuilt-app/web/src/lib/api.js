const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
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
  // Business
  getBusiness: () => request('/business'),
  updateBusiness: (data) => request('/business', { method: 'PATCH', body: JSON.stringify(data) }),
  getIntegrations: () => request('/business/integrations'),

  // Services
  getServices: () => request('/services'),
  createService: (data) => request('/services', { method: 'POST', body: JSON.stringify(data) }),
  updateService: (id, data) => request(`/services/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteService: (id) => request(`/services/${id}`, { method: 'DELETE' }),

  // Availability
  getAvailability: () => request('/availability'),
  addAvailabilityRule: (data) => request('/availability/rules', { method: 'POST', body: JSON.stringify(data) }),
  deleteAvailabilityRule: (id) => request(`/availability/rules/${id}`, { method: 'DELETE' }),
  addTimeOff: (data) => request('/availability/time-off', { method: 'POST', body: JSON.stringify(data) }),
  deleteTimeOff: (id) => request(`/availability/time-off/${id}`, { method: 'DELETE' }),

  // Customers
  getCustomers: (q) => request(`/customers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  getCustomer: (id) => request(`/customers/${id}`),
  updateCustomer: (id, data) => request(`/customers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Appointments
  getAppointments: (params) => {
    const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
    return request(`/appointments${qs}`);
  },
  createAppointment: (data) => request('/appointments', { method: 'POST', body: JSON.stringify(data) }),
  updateAppointment: (id, data) => request(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Conversations
  getConversations: () => request('/conversations'),
  getConversation: (id) => request(`/conversations/${id}/messages`),
  sendMessage: (id, body) => request(`/conversations/${id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }),

  // Dashboard
  getDashboardSummary: () => request('/dashboard/summary'),

  // Public (simulated external triggers, used by the Settings "test tools" panel)
  simulateBooking: (data) => request('/public/book', { method: 'POST', body: JSON.stringify(data) }),
  simulateInboundSms: (data) => request('/public/inbound-sms', { method: 'POST', body: JSON.stringify(data) }),
  simulateMissedCall: (data) => request('/public/missed-call', { method: 'POST', body: JSON.stringify(data) }),
};
