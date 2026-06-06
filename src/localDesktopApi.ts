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

type RentPaymentPayload = RentPaymentUpdate & {
  tenant_id?: string | null;
  property_id?: string | null;
};

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

  createTenant: (tenant: TenantPayload) => localBridge().createTenant(tenant),
  updateTenant: (id: string, tenant: TenantPayload) => localBridge().updateTenant(id, tenant),
  deleteTenant: (id: string) => localBridge().deleteTenant(id),

  createPayment: (payment: RentPaymentPayload) => localBridge().createPayment(payment),
  updatePayment: (id: string, payment: RentPaymentUpdate) => localBridge().updatePayment(id, payment),
  deleteRentPayment: (id: string) => localBridge().deleteRentPayment(id),

  createExpense: (expense: ExpensePayload) => localBridge().createExpense(expense),
  updateExpense: (id: string, expense: ExpensePayload) => localBridge().updateExpense(id, expense),
  deleteExpense: (id: string) => localBridge().deleteExpense(id),

  createTicket: (ticket: Pick<MaintenanceTicket, 'title' | 'description' | 'property_id' | 'urgency'>) =>
    localBridge().createTicket(ticket),
  updateMaintenanceTicket: (id: string, ticket: MaintenanceTicketPayload) =>
    localBridge().updateMaintenanceTicket(id, ticket),
  deleteMaintenanceTicket: (id: string) => localBridge().deleteMaintenanceTicket(id),

  listAdminAccounts: async (): Promise<AdminAccount[]> =>
    (await localBridge().listAdminAccounts()) as AdminAccount[],
  createAdminAccount: (account: AdminAccountPayload) => localBridge().createAdminAccount(account),
  updateAdminAccount: (id: string, account: AdminAccountPayload) =>
    localBridge().updateAdminAccount(id, account),

  createDocument: (document: DocumentPayload) => localBridge().createDocument(document),
  updateDocument: (id: string, document: DocumentPayload) => localBridge().updateDocument(id, document),
  deleteDocument: (id: string) => localBridge().deleteDocument(id),

  uploadDocument: async (file: File): Promise<DocumentUploadResponse> => {
    const buffer = await file.arrayBuffer();
    return (await localBridge().uploadDocument({
      name: file.name,
      type: file.type,
      size: file.size,
      data: Array.from(new Uint8Array(buffer)),
    })) as DocumentUploadResponse;
  },
};
