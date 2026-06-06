import type { DashboardData, MaintenanceTicket, User } from './types';
import type {
  AdminAccount,
  AdminAccountPayload,
  ComplianceUpdate,
  DocumentPayload,
  DocumentUploadResponse,
  ExpensePayload,
  LoginResponse,
  MaintenanceTicketPayload,
  PropertyPayload,
  RentPaymentUpdate,
  TenantPayload,
} from './api';

function localBridge() {
  if (!window.propmanagerrLocal) {
    throw new Error('PropManagerr local desktop bridge is not available.');
  }
  return window.propmanagerrLocal;
}

function currentUser(): User | null {
  const raw = localStorage.getItem('pm_local_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function comingSoon(feature: string): never {
  throw new Error(`${feature} is not wired to the local desktop database yet.`);
}

export const localDesktopApi = {
  documentFileUrl: (fileUrl: string | null | undefined): string => fileUrl || '#',

  login: async (email: string, password: string): Promise<LoginResponse> => {
    const result = (await localBridge().login(email, password)) as LoginResponse;
    localStorage.setItem('pm_local_user', JSON.stringify(result.user));
    localStorage.setItem('pm_token', result.token);
    return result;
  },

  me: async (): Promise<{ user: User }> => {
    const user = currentUser();
    if (!user) throw new Error('Not signed in');
    return { user };
  },

  dashboard: async (): Promise<DashboardData> => {
    return (await localBridge().dashboard(currentUser())) as DashboardData;
  },

  complianceUpdates: async (): Promise<ComplianceUpdate[]> => {
    return (await localBridge().complianceUpdates()) as ComplianceUpdate[];
  },

  createProperty: (property: PropertyPayload) => localBridge().createProperty(property),
  updateProperty: (id: string, property: PropertyPayload) => localBridge().updateProperty(id, property),
  deleteProperty: (id: string) => localBridge().deleteProperty(id),

  createTicket: (_ticket: Pick<MaintenanceTicket, 'title' | 'description' | 'property_id' | 'urgency'>) =>
    comingSoon('Repair reporting'),
  updateMaintenanceTicket: (_id: string, _ticket: MaintenanceTicketPayload) => comingSoon('Repair editing'),
  deleteMaintenanceTicket: (_id: string) => comingSoon('Repair delete'),

  listAdminAccounts: async (): Promise<AdminAccount[]> => [],
  createAdminAccount: (_account: AdminAccountPayload) => comingSoon('Admin accounts'),
  updateAdminAccount: (_id: string, _account: AdminAccountPayload) => comingSoon('Admin accounts'),

  createTenant: (tenant: TenantPayload) => localBridge().createTenant(tenant),
  updateTenant: (id: string, tenant: TenantPayload) => localBridge().updateTenant(id, tenant),
  deleteTenant: (id: string) => localBridge().deleteTenant(id),

  updatePayment: (_id: string, _payment: RentPaymentUpdate) => comingSoon('Rent payment update'),
  deleteRentPayment: (_id: string) => comingSoon('Rent payment delete'),

  createExpense: (_expense: ExpensePayload) => comingSoon('Expense create'),
  updateExpense: (_id: string, _expense: ExpensePayload) => comingSoon('Expense update'),
  deleteExpense: (_id: string) => comingSoon('Expense delete'),

  createDocument: (_document: DocumentPayload) => comingSoon('Document create'),
  updateDocument: (_id: string, _document: DocumentPayload) => comingSoon('Document update'),
  deleteDocument: (_id: string) => comingSoon('Document delete'),
  uploadDocument: async (_file: File): Promise<DocumentUploadResponse> => comingSoon('Document upload'),
};
