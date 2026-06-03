import type { DashboardData, MaintenanceTicket, User } from './types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export interface LoginResponse {
  token: string;
  user: User;
}

export type RentPaymentUpdate = {
  amount?: number;
  due_date?: string;
  paid_date?: string | null;
  status?: string;
  payment_method?: string;
  notes?: string;
};

export type PropertyPayload = {
  address?: string;
  postcode?: string;
  type?: string;
  bedrooms?: number;
  rent_amount?: number;
  notes?: string;
};

export type TenantPayload = {
  property_id?: string | null;
  name?: string;
  email?: string;
  phone?: string;
  tenancy_start?: string | null;
  tenancy_end?: string | null;
  rent_amount?: number;
  deposit_amount?: number;
  deposit_scheme?: string;
  notes?: string;
};

export type ExpensePayload = {
  property_id?: string | null;
  date?: string;
  category?: string;
  description?: string;
  amount?: number;
  supplier?: string;
  receipt_url?: string;
  notes?: string;
};

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

  createProperty: (property: PropertyPayload) =>
    request('/properties', {
      method: 'POST',
      body: JSON.stringify(property),
    }),

  updateProperty: (id: string, property: PropertyPayload) =>
    request(`/properties/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(property),
    }),

  deleteProperty: (id: string) =>
    request(`/properties/${id}`, {
      method: 'DELETE',
    }),

  createTenant: (tenant: TenantPayload) =>
    request('/tenants', {
      method: 'POST',
      body: JSON.stringify(tenant),
    }),

  updateTenant: (id: string, tenant: TenantPayload) =>
    request(`/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(tenant),
    }),

  deleteTenant: (id: string) =>
    request(`/tenants/${id}`, {
      method: 'DELETE',
    }),

  updatePayment: (id: string, payment: RentPaymentUpdate) =>
    request(`/rent-payments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payment),
    }),

  deleteRentPayment: (id: string) =>
    request(`/rent-payments/${id}`, {
      method: 'DELETE',
    }),

  createExpense: (expense: ExpensePayload) =>
    request('/expenses', {
      method: 'POST',
      body: JSON.stringify(expense),
    }),

  updateExpense: (id: string, expense: ExpensePayload) =>
    request(`/expenses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(expense),
    }),

  deleteExpense: (id: string) =>
    request(`/expenses/${id}`, {
      method: 'DELETE',
    }),
};
