export type Role = 'admin' | 'tenant';
export type PropertyStatus = 'active' | 'vacant' | 'maintenance';
export type PaymentStatus = 'paid' | 'overdue' | 'pending';
export type Urgency = 'low' | 'medium' | 'high';
export type TicketStatus = 'open' | 'in_progress' | 'resolved';
export type DocType = 'tenancy_agreement' | 'gas_safety' | 'epc' | 'eicr' | 'deposit_protection' | 'right_to_rent' | 'smoke_co_alarm' | 'other';
export type Page = 'dashboard' | 'properties' | 'tenants' | 'rent' | 'maintenance' | 'documents' | 'expenses' | 'admin';

export interface User { id: string; name: string; email: string; role: Role; tenant_id?: string | null; }
export interface Property { id: string; address: string; city: string; postcode: string; status: PropertyStatus; monthly_rent: number; bedrooms: number; property_type: string; }
export interface Tenant { id: string; user_id?: string | null; name: string; email: string; phone: string; property_id: string | null; lease_start: string | null; lease_end: string | null; payment_status: PaymentStatus; property?: Property; }
export interface RentPayment { id: string; tenant_id: string; property_id: string; amount: number; due_date: string; paid_date: string | null; status: PaymentStatus; tenant?: Tenant; property?: Property; }
export interface MaintenanceTicket { id: string; title: string; description: string; property_id: string; tenant_id?: string | null; urgency: Urgency; status: TicketStatus; created_at: string; updated_at?: string; property?: Property; tenant?: Tenant; }
export interface DocumentRecord { id: string; property_id: string; tenant_id?: string | null; name: string; doc_type: DocType; expiry_date: string | null; file_url: string | null; property?: Property; tenant?: Tenant; }
export interface Expense { id: string; property_id: string | null; category: string; amount: number; date: string; description: string; property?: Property; }
export interface DashboardData { properties: Property[]; tenants: Tenant[]; rentPayments: RentPayment[]; maintenanceTickets: MaintenanceTicket[]; documents: DocumentRecord[]; expenses: Expense[]; }
