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
    };
  }
}
