export {};

declare global {
  interface Window {
    propmanagerrLocal?: {
      health: () => Promise<unknown>;
      login: (email: string, password: string) => Promise<unknown>;
      dashboard: (user: unknown) => Promise<unknown>;
      complianceUpdates: () => Promise<unknown>;

      createProperty: (property: unknown) => Promise<unknown>;
      updateProperty: (id: string, property: unknown) => Promise<unknown>;
      deleteProperty: (id: string) => Promise<unknown>;

      createTenant: (tenant: unknown) => Promise<unknown>;
      updateTenant: (id: string, tenant: unknown) => Promise<unknown>;
      deleteTenant: (id: string) => Promise<unknown>;

      createPayment: (payment: unknown) => Promise<unknown>;
      updatePayment: (id: string, payment: unknown) => Promise<unknown>;
      deleteRentPayment: (id: string) => Promise<unknown>;

      createExpense: (expense: unknown) => Promise<unknown>;
      updateExpense: (id: string, expense: unknown) => Promise<unknown>;
      deleteExpense: (id: string) => Promise<unknown>;

      createTicket: (ticket: unknown) => Promise<unknown>;
      updateMaintenanceTicket: (id: string, ticket: unknown) => Promise<unknown>;
      deleteMaintenanceTicket: (id: string) => Promise<unknown>;

      uploadDocument: (payload: unknown) => Promise<unknown>;
      createDocument: (document: unknown) => Promise<unknown>;
      updateDocument: (id: string, document: unknown) => Promise<unknown>;
      deleteDocument: (id: string) => Promise<unknown>;

      listAdminAccounts: () => Promise<unknown>;
      createAdminAccount: (account: unknown) => Promise<unknown>;
      updateAdminAccount: (id: string, account: unknown) => Promise<unknown>;
    deleteAdminAccount: (id: string) => Promise<unknown>;
    };
  }
}
