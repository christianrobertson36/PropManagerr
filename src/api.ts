import type { DashboardData, MaintenanceTicket, User } from './types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface LoginResponse {
  token: string;
  user: User;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('pm_token');

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({
      error: 'Request failed',
    }));

    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () =>
    request<{ user: User }>('/auth/me'),

  dashboard: () =>
    request<DashboardData>('/dashboard'),

  createTicket: (
    ticket: Pick<
      MaintenanceTicket,
      'title' | 'description' | 'property_id' | 'urgency'
    >
  ) =>
    request<MaintenanceTicket>('/maintenance', {
      method: 'POST',
      body: JSON.stringify(ticket),
    }),

  updatePayment: (
    id: string,
    status: string,
    paid_date?: string | null
  ) =>
    request(`/rent-payments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, paid_date }),
    }),

  deleteRentPayment: (id: string) =>
    request(`/rent-payments/${id}`, {
      method: 'DELETE',
    }),
};
