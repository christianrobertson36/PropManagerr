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
  city?: string;
  postcode?: string;
  status?: string;
  monthly_rent?: number;
  bedrooms?: number;
  property_type?: string;
};

export type TenantPayload = {
  property_id?: string | null;
  name?: string;
  email?: string;
  phone?: string;
  lease_start?: string | null;
  lease_end?: string | null;
  payment_status?: string;
};

export type ExpensePayload = {
  property_id?: string | null;
  date?: string;
  category?: string;
  description?: string;
  amount?: number;
};

export type DocumentPayload = {
  property_id?: string | null;
  tenant_id?: string | null;
  name?: string;
  doc_type?: string;
  expiry_date?: string | null;
  file_url?: string;
};

export type DocumentUploadResponse = {
  file_url: string;
  original_name: string;
};

export type AdminAccount = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'tenant';
  tenant_id: string | null;
  active: boolean;
  tenant?: { id: string; name: string; email?: string } | null;
};

export type AdminAccountPayload = {
  name?: string;
  email?: string;
  password?: string;
  role?: 'admin' | 'tenant';
  tenant_id?: string | null;
  active?: boolean;
};

export type ComplianceUpdate = {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  effective_date: string | null;
  last_checked: string;
  severity: 'info' | 'important' | 'required';
};

function documentFileUrl(fileUrl: string | null | undefined): string {
  if (!fileUrl) return '#';
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
    return fileUrl;
  }
  if (fileUrl.startsWith('/')) {
    return `${API_URL}${fileUrl}`;
  }
  return `${API_URL}/${fileUrl}`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
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
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
}

export const api = {
  documentFileUrl,

  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: User }>('/auth/me'),
  dashboard: () => request<DashboardData>('/dashboard'),
  complianceUpdates: () => request<ComplianceUpdate[]>('/compliance/updates'),

  createTicket: (
    ticket: Pick<MaintenanceTicket, 'title' | 'description' | 'property_id' | 'urgency'>
  ) =>
    request<MaintenanceTicket>('/maintenance', {
      method: 'POST',
      body: JSON.stringify(ticket),
    }),

  listAdminAccounts: () => request<AdminAccount[]>('/admin/accounts'),

  createAdminAccount: (account: AdminAccountPayload) =>
    request<AdminAccount>('/admin/accounts', {
      method: 'POST',
      body: JSON.stringify(account),
    }),

  updateAdminAccount: (id: string, account: AdminAccountPayload) =>
    request<AdminAccount>(`/admin/accounts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(account),
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

  createDocument: (document: DocumentPayload) =>
    request('/documents', {
      method: 'POST',
      body: JSON.stringify(document),
    }),

  updateDocument: (id: string, document: DocumentPayload) =>
    request(`/documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(document),
    }),

  deleteDocument: (id: string) =>
    request(`/documents/${id}`, {
      method: 'DELETE',
    }),

  uploadDocument: async (file: File): Promise<DocumentUploadResponse> => {
    const token = localStorage.getItem('pm_token');
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_URL}/documents/upload`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }

    return res.json();
  },
};
