import { useEffect, useMemo, useState } from 'react';
import type { ComponentType, FormEvent, ReactNode } from 'react';
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  Receipt,
  ShieldCheck,
  Users,
  Wrench,
} from 'lucide-react';
import { api } from './api';
import { Sidebar } from './components/Sidebar';
import { Stat } from './components/Stat';
import { TenantPortal } from './pages/TenantPortalPage';
import type {
  AdminAccount,
  AdminAccountPayload,
  DocumentPayload,
  ExpensePayload,
  PropertyPayload,
  RentPaymentUpdate,
  TenantPayload,
} from './api';
import type {
  DashboardData,
  DocType,
  DocumentRecord,
  Expense,
  Page,
  PaymentStatus,
  Property,
  PropertyStatus,
  RentPayment,
  Tenant,
  User,
} from './types';

type PageConfig = {
  page: Page;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const APP_VERSION = 'v22';

const emptyDashboard: DashboardData = {
  properties: [],
  tenants: [],
  rentPayments: [],
  maintenanceTickets: [],
  documents: [],
  expenses: [],
};

const pageConfig: PageConfig[] = [
  { page: 'dashboard', label: 'Dashboard', icon: Home },
  { page: 'properties', label: 'Properties', icon: Building2, adminOnly: true },
  { page: 'tenants', label: 'Tenants', icon: Users, adminOnly: true },
  { page: 'rent', label: 'Rent', icon: Receipt },
  { page: 'maintenance', label: 'Repairs', icon: Wrench },
  { page: 'documents', label: 'Documents', icon: FileText },
  { page: 'expenses', label: 'Expenses', icon: ClipboardList, adminOnly: true },
  { page: 'admin', label: 'Admin', icon: ShieldCheck, adminOnly: true },
];

function dateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function money(value: number | string | null | undefined): string {
  const numeric = typeof value === 'string' ? Number(value) : value;
  if (numeric === null || numeric === undefined || Number.isNaN(numeric)) return '£0.00';
  return `£${numeric.toFixed(2)}`;
}

function fieldValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        type={type}
        value={value}
        required={required}
        onChange={event => onChange(event.target.value)}
      />
    </label>
  );
}

function Select<T extends string>({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: T | '';
  onChange: (value: T | '') => void;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <select
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        value={value}
        onChange={event => onChange(event.target.value as T | '')}
      >
        {children}
      </select>
    </label>
  );
}

function Button({
  children,
  type = 'button',
  onClick,
  variant = 'primary',
  disabled = false,
}: {
  children: ReactNode;
  type?: 'button' | 'submit';
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) {
  const classes = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60 ${classes[variant]}`}
    >
      {children}
    </button>
  );
}

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('admin@propmanager.local');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await api.login(email, password);
      localStorage.setItem('pm_token', result.token);
      onLogin(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-600 p-3 text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">PropManagerr</h1>
            <p className="text-sm text-slate-500">Landlord and tenant portal</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Input label="Email" value={email} onChange={setEmail} type="email" required />
          <Input label="Password" value={password} onChange={setPassword} type="password" required />
          <Button type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </div>
      </form>
    </main>
  );
}

function Dashboard({ data }: { data: DashboardData; user: User }) {
  const paid = data.rentPayments.filter(payment => payment.status === 'paid').reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = data.rentPayments.filter(payment => payment.status !== 'paid').reduce((sum, payment) => sum + payment.amount, 0);
  const openRepairs = data.maintenanceTickets.filter(ticket => ticket.status !== 'resolved').length;
  const expiring = data.documents.filter(document => {
    const days = daysUntil(document.expiry_date);
    return days !== null && days <= 90;
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Properties" value={String(data.properties.length)} icon={Building2} />
        <Stat label="Rent paid" value={money(paid)} icon={Receipt} />
        <Stat label="Outstanding" value={money(outstanding)} icon={AlertTriangle} />
        <Stat label="Open repairs" value={String(openRepairs)} icon={Wrench} />
      </div>

      <Card title="Compliance reminders">
        {expiring.length === 0 ? (
          <p className="text-sm text-slate-600">No documents expiring in the next 90 days.</p>
        ) : (
          <div className="space-y-2">
            {expiring.map(document => {
              const days = daysUntil(document.expiry_date);
              return (
                <div key={document.id} className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <span className="font-medium text-amber-900">{document.name}</span>
                  <span className="text-amber-700">
                    {days !== null && days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function Properties({ data, refresh }: { data: DashboardData; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<Property | null>(null);
  const [form, setForm] = useState<PropertyPayload>({
    address: '',
    city: '',
    postcode: '',
    status: 'active',
    monthly_rent: 0,
    bedrooms: 0,
    property_type: '',
  });

  function startEdit(property: Property) {
    setEditing(property);
    setForm({
      address: property.address,
      city: property.city,
      postcode: property.postcode,
      status: property.status,
      monthly_rent: property.monthly_rent,
      bedrooms: property.bedrooms,
      property_type: property.property_type,
    });
  }

  function reset() {
    setEditing(null);
    setForm({ address: '', city: '', postcode: '', status: 'active', monthly_rent: 0, bedrooms: 0, property_type: '' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (editing) await api.updateProperty(editing.id, form);
    else await api.createProperty(form);
    reset();
    await refresh();
  }

  async function remove(id: string) {
    await api.deleteProperty(id);
    await refresh();
  }

  return (
    <CrudLayout title={editing ? 'Edit property' : 'Add property'} onSubmit={submit} onCancel={reset} editing={Boolean(editing)}>
      <Input label="Address" value={fieldValue(form.address)} onChange={value => setForm({ ...form, address: value })} required />
      <Input label="City" value={fieldValue(form.city)} onChange={value => setForm({ ...form, city: value })} />
      <Input label="Postcode" value={fieldValue(form.postcode)} onChange={value => setForm({ ...form, postcode: value })} />
      <Select<PropertyStatus> label="Status" value={(form.status as PropertyStatus) || 'active'} onChange={value => setForm({ ...form, status: value || 'active' })}>
        <option value="active">Active</option>
        <option value="vacant">Vacant</option>
        <option value="maintenance">Maintenance</option>
      </Select>
      <Input label="Monthly rent" type="number" value={fieldValue(form.monthly_rent)} onChange={value => setForm({ ...form, monthly_rent: Number(value) })} />
      <Input label="Bedrooms" type="number" value={fieldValue(form.bedrooms)} onChange={value => setForm({ ...form, bedrooms: Number(value) })} />
      <Input label="Property type" value={fieldValue(form.property_type)} onChange={value => setForm({ ...form, property_type: value })} />

      <Table
        columns={['Address', 'City', 'Postcode', 'Status', 'Rent', 'Actions']}
        rows={data.properties.map(property => [
          property.address,
          property.city,
          property.postcode,
          property.status,
          money(property.monthly_rent),
          <Actions onEdit={() => startEdit(property)} onDelete={() => remove(property.id)} />,
        ])}
      />
    </CrudLayout>
  );
}

function Tenants({ data, refresh }: { data: DashboardData; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState<TenantPayload>({ property_id: '', name: '', email: '', phone: '', lease_start: null, lease_end: null, payment_status: 'pending' });

  function startEdit(tenant: Tenant) {
    setEditing(tenant);
    setForm({
      property_id: tenant.property_id,
      name: tenant.name,
      email: tenant.email,
      phone: tenant.phone,
      lease_start: dateOnly(tenant.lease_start) || null,
      lease_end: dateOnly(tenant.lease_end) || null,
      payment_status: tenant.payment_status,
    });
  }

  function reset() {
    setEditing(null);
    setForm({ property_id: '', name: '', email: '', phone: '', lease_start: null, lease_end: null, payment_status: 'pending' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { ...form, property_id: form.property_id || null, lease_start: form.lease_start || null, lease_end: form.lease_end || null };
    if (editing) await api.updateTenant(editing.id, payload);
    else await api.createTenant(payload);
    reset();
    await refresh();
  }

  async function remove(id: string) {
    await api.deleteTenant(id);
    await refresh();
  }

  return (
    <CrudLayout title={editing ? 'Edit tenant' : 'Add tenant'} onSubmit={submit} onCancel={reset} editing={Boolean(editing)}>
      <Select<string> label="Property" value={fieldValue(form.property_id)} onChange={value => setForm({ ...form, property_id: value || null })}>
        <option value="">Unassigned</option>
        {data.properties.map(property => <option key={property.id} value={property.id}>{property.address}</option>)}
      </Select>
      <Input label="Name" value={fieldValue(form.name)} onChange={value => setForm({ ...form, name: value })} required />
      <Input label="Email" value={fieldValue(form.email)} onChange={value => setForm({ ...form, email: value })} type="email" />
      <Input label="Phone" value={fieldValue(form.phone)} onChange={value => setForm({ ...form, phone: value })} />
      <Input label="Lease start" value={fieldValue(form.lease_start)} onChange={value => setForm({ ...form, lease_start: value || null })} type="date" />
      <Input label="Lease end" value={fieldValue(form.lease_end)} onChange={value => setForm({ ...form, lease_end: value || null })} type="date" />
      <Select<PaymentStatus> label="Payment status" value={(form.payment_status as PaymentStatus) || 'pending'} onChange={value => setForm({ ...form, payment_status: value || 'pending' })}>
        <option value="pending">Pending</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
      </Select>

      <Table
        columns={['Name', 'Email', 'Property', 'Lease end', 'Status', 'Actions']}
        rows={data.tenants.map(tenant => [
          tenant.name,
          tenant.email,
          tenant.property?.address || '-',
          dateOnly(tenant.lease_end) || '-',
          tenant.payment_status,
          <Actions onEdit={() => startEdit(tenant)} onDelete={() => remove(tenant.id)} />,
        ])}
      />
    </CrudLayout>
  );
}

function Rent({ data, refresh, user }: { data: DashboardData; refresh: () => Promise<void>; user: User }) {
  const [editing, setEditing] = useState<RentPayment | null>(null);
  const [form, setForm] = useState<RentPaymentUpdate>({ amount: 0, due_date: '', paid_date: null, status: 'pending', payment_method: '', notes: '' });
  const rentPayments = user.role === 'tenant'
    ? data.rentPayments.filter(payment => payment.tenant_id === user.tenant_id)
    : data.rentPayments;

  function startEdit(payment: RentPayment) {
    setEditing(payment);
    setForm({
      amount: payment.amount,
      due_date: dateOnly(payment.due_date),
      paid_date: dateOnly(payment.paid_date) || null,
      status: payment.status,
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    await api.updatePayment(editing.id, { ...form, paid_date: form.paid_date || null });
    setEditing(null);
    await refresh();
  }

  async function remove(id: string) {
    await api.deleteRentPayment(id);
    await refresh();
  }

  return (
    <div className="space-y-6">
      {editing && user.role === 'admin' && (
        <Card title="Edit rent payment">
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-3">
            <Input label="Amount" type="number" value={fieldValue(form.amount)} onChange={value => setForm({ ...form, amount: Number(value) })} />
            <Input label="Due date" type="date" value={fieldValue(form.due_date)} onChange={value => setForm({ ...form, due_date: value })} />
            <Input label="Paid date" type="date" value={fieldValue(form.paid_date)} onChange={value => setForm({ ...form, paid_date: value || null })} />
            <Select<PaymentStatus> label="Status" value={(form.status as PaymentStatus) || 'pending'} onChange={value => setForm({ ...form, status: value || 'pending' })}>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </Select>
            <div className="flex items-end gap-2 md:col-span-2">
              <Button type="submit">Save</Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Table
        columns={['Tenant', 'Property', 'Amount', 'Due', 'Paid', 'Status', 'Actions']}
        rows={rentPayments.map(payment => [
          payment.tenant?.name || payment.tenant_id,
          payment.property?.address || payment.property_id,
          money(payment.amount),
          dateOnly(payment.due_date),
          dateOnly(payment.paid_date) || '-',
          payment.status,
          user.role === 'admin' ? <Actions onEdit={() => startEdit(payment)} onDelete={() => remove(payment.id)} /> : '-',
        ])}
      />
    </div>
  );
}

function Maintenance({ data, refresh, user }: { data: DashboardData; refresh: () => Promise<void>; user: User }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [propertyId, setPropertyId] = useState(data.properties[0]?.id || '');

  useEffect(() => {
    if (!propertyId && data.properties[0]?.id) setPropertyId(data.properties[0].id);
  }, [data.properties, propertyId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await api.createTicket({ title, description, property_id: propertyId, urgency: 'medium' });
    setTitle('');
    setDescription('');
    await refresh();
  }

  const visibleTickets = user.role === 'tenant'
    ? data.maintenanceTickets.filter(ticket => ticket.tenant_id === user.tenant_id || ticket.property_id === data.tenants.find(tenant => tenant.id === user.tenant_id)?.property_id)
    : data.maintenanceTickets;

  return (
    <div className="space-y-6">
      <Card title="Report a repair">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <Input label="Title" value={title} onChange={setTitle} required />
          <Select<string> label="Property" value={propertyId} onChange={value => setPropertyId(value)}>
            {data.properties.map(property => <option key={property.id} value={property.id}>{property.address}</option>)}
          </Select>
          <label className="block text-sm font-medium text-slate-700 md:col-span-2">
            Description
            <textarea
              className="mt-1 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={description}
              onChange={event => setDescription(event.target.value)}
              required
            />
          </label>
          <div className="md:col-span-2">
            <Button type="submit" disabled={!propertyId}>Submit repair</Button>
          </div>
        </form>
      </Card>

      <Table
        columns={['Title', 'Property', 'Urgency', 'Status', 'Created']}
        rows={visibleTickets.map(ticket => [
          ticket.title,
          ticket.property?.address || ticket.property_id,
          ticket.urgency,
          ticket.status,
          dateOnly(ticket.created_at),
        ])}
      />
    </div>
  );
}

function Documents({ data, refresh, user }: { data: DashboardData; refresh: () => Promise<void>; user: User }) {
  const [editing, setEditing] = useState<DocumentRecord | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<DocumentPayload>({ property_id: '', tenant_id: '', name: '', doc_type: 'other', expiry_date: null, file_url: '' });
  const visibleDocuments = user.role === 'tenant'
    ? data.documents.filter(document => document.tenant_id === user.tenant_id || document.property_id === data.tenants.find(tenant => tenant.id === user.tenant_id)?.property_id)
    : data.documents;

  function startEdit(document: DocumentRecord) {
    setEditing(document);
    setForm({
      property_id: document.property_id || '',
      tenant_id: document.tenant_id || '',
      name: document.name,
      doc_type: document.doc_type,
      expiry_date: dateOnly(document.expiry_date) || null,
      file_url: document.file_url || '',
    });
  }

  function reset() {
    setEditing(null);
    setFile(null);
    setForm({ property_id: '', tenant_id: '', name: '', doc_type: 'other', expiry_date: null, file_url: '' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    let fileUrl = form.file_url || '';
    if (file) {
      const uploaded = await api.uploadDocument(file);
      fileUrl = uploaded.file_url;
    }
    const payload = {
      ...form,
      property_id: form.property_id || null,
      tenant_id: form.tenant_id || null,
      expiry_date: form.expiry_date || null,
      file_url: fileUrl,
    };
    if (editing) await api.updateDocument(editing.id, payload);
    else await api.createDocument(payload);
    reset();
    await refresh();
  }

  async function remove(id: string) {
    await api.deleteDocument(id);
    await refresh();
  }

  return (
    <div className="space-y-6">
      {user.role === 'admin' && (
        <CrudLayout title={editing ? 'Edit document' : 'Add document'} onSubmit={submit} onCancel={reset} editing={Boolean(editing)} hideTable>
          <Select<string> label="Property" value={fieldValue(form.property_id)} onChange={value => setForm({ ...form, property_id: value || null })}>
            <option value="">No property</option>
            {data.properties.map(property => <option key={property.id} value={property.id}>{property.address}</option>)}
          </Select>
          <Select<string> label="Tenant" value={fieldValue(form.tenant_id)} onChange={value => setForm({ ...form, tenant_id: value || null })}>
            <option value="">No tenant</option>
            {data.tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
          </Select>
          <Input label="Name" value={fieldValue(form.name)} onChange={value => setForm({ ...form, name: value })} required />
          <Select<DocType> label="Document type" value={(form.doc_type as DocType) || 'other'} onChange={value => setForm({ ...form, doc_type: value || 'other' })}>
            <option value="tenancy_agreement">Tenancy agreement</option>
            <option value="gas_safety">Gas safety</option>
            <option value="epc">EPC</option>
            <option value="eicr">EICR</option>
            <option value="deposit_protection">Deposit protection</option>
            <option value="right_to_rent">Right to rent</option>
            <option value="smoke_co_alarm">Smoke/CO alarm</option>
            <option value="other">Other</option>
          </Select>
          <Input label="Expiry date" type="date" value={fieldValue(form.expiry_date)} onChange={value => setForm({ ...form, expiry_date: value || null })} />
          <label className="block text-sm font-medium text-slate-700">
            Upload file
            <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" type="file" onChange={event => setFile(event.target.files?.[0] || null)} />
          </label>
        </CrudLayout>
      )}

      <Table
        columns={['Name', 'Type', 'Property', 'Tenant', 'Expiry', 'File', 'Actions']}
        rows={visibleDocuments.map(document => [
          document.name,
          document.doc_type,
          document.property?.address || '-',
          document.tenant?.name || '-',
          dateOnly(document.expiry_date) || '-',
          document.file_url ? <a key={`${document.id}-file`} className="font-medium text-emerald-700 hover:underline" href={api.documentFileUrl(document.file_url)} target="_blank" rel="noreferrer">View</a> : 'Not uploaded',
          user.role === 'admin' ? <Actions onEdit={() => startEdit(document)} onDelete={() => remove(document.id)} /> : '-',
        ])}
      />
    </div>
  );
}

function Expenses({ data, refresh }: { data: DashboardData; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpensePayload>({ property_id: '', date: dateOnly(new Date().toISOString()), category: '', description: '', amount: 0 });

  function startEdit(expense: Expense) {
    setEditing(expense);
    setForm({ property_id: expense.property_id || '', date: dateOnly(expense.date), category: expense.category, description: expense.description, amount: expense.amount });
  }

  function reset() {
    setEditing(null);
    setForm({ property_id: '', date: dateOnly(new Date().toISOString()), category: '', description: '', amount: 0 });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { ...form, property_id: form.property_id || null };
    if (editing) await api.updateExpense(editing.id, payload);
    else await api.createExpense(payload);
    reset();
    await refresh();
  }

  async function remove(id: string) {
    await api.deleteExpense(id);
    await refresh();
  }

  return (
    <CrudLayout title={editing ? 'Edit expense' : 'Add expense'} onSubmit={submit} onCancel={reset} editing={Boolean(editing)}>
      <Select<string> label="Property" value={fieldValue(form.property_id)} onChange={value => setForm({ ...form, property_id: value || null })}>
        <option value="">No property</option>
        {data.properties.map(property => <option key={property.id} value={property.id}>{property.address}</option>)}
      </Select>
      <Input label="Date" type="date" value={fieldValue(form.date)} onChange={value => setForm({ ...form, date: value })} />
      <Input label="Category" value={fieldValue(form.category)} onChange={value => setForm({ ...form, category: value })} required />
      <Input label="Description" value={fieldValue(form.description)} onChange={value => setForm({ ...form, description: value })} />
      <Input label="Amount" type="number" value={fieldValue(form.amount)} onChange={value => setForm({ ...form, amount: Number(value) })} />

      <Table
        columns={['Date', 'Property', 'Category', 'Description', 'Amount', 'Actions']}
        rows={data.expenses.map(expense => [
          dateOnly(expense.date),
          expense.property?.address || '-',
          expense.category,
          expense.description,
          money(expense.amount),
          <Actions onEdit={() => startEdit(expense)} onDelete={() => remove(expense.id)} />,
        ])}
      />
    </CrudLayout>
  );
}

function Admin({ data }: { data: DashboardData; refresh: () => Promise<void> }) {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [form, setForm] = useState<AdminAccountPayload>({ name: '', email: '', password: '', role: 'tenant', tenant_id: null, active: true });

  async function loadAccounts() {
    const rows = await api.listAdminAccounts();
    setAccounts(rows);
  }

  useEffect(() => {
    loadAccounts().catch(console.error);
  }, []);

  function startEdit(account: AdminAccount) {
    setEditing(account);
    setForm({ name: account.name, email: account.email, password: '', role: account.role, tenant_id: account.tenant_id, active: account.active });
  }

  function reset() {
    setEditing(null);
    setForm({ name: '', email: '', password: '', role: 'tenant', tenant_id: null, active: true });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const payload = { ...form, tenant_id: form.role === 'tenant' ? form.tenant_id || null : null };
    if (editing && !payload.password) delete payload.password;
    if (editing) await api.updateAdminAccount(editing.id, payload);
    else await api.createAdminAccount(payload);
    reset();
    await loadAccounts();
  }

  return (
    <CrudLayout title={editing ? 'Edit login account' : 'Add login account'} onSubmit={submit} onCancel={reset} editing={Boolean(editing)}>
      <Input label="Name" value={fieldValue(form.name)} onChange={value => setForm({ ...form, name: value })} required />
      <Input label="Email" type="email" value={fieldValue(form.email)} onChange={value => setForm({ ...form, email: value })} required />
      <Input label={editing ? 'New password (leave blank to keep)' : 'Password'} type="password" value={fieldValue(form.password)} onChange={value => setForm({ ...form, password: value })} required={!editing} />
      <Select<'admin' | 'tenant'> label="Role" value={form.role || 'tenant'} onChange={value => setForm({ ...form, role: value || 'tenant' })}>
        <option value="admin">Admin</option>
        <option value="tenant">Tenant</option>
      </Select>
      <Select<string> label="Linked tenant" value={fieldValue(form.tenant_id)} onChange={value => setForm({ ...form, tenant_id: value || null })}>
        <option value="">No tenant</option>
        {data.tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
      </Select>

      <Table
        columns={['Name', 'Email', 'Role', 'Tenant', 'Active', 'Actions']}
        rows={accounts.map(account => [
          account.name,
          account.email,
          account.role,
          account.tenant?.name || '-',
          account.active ? 'Yes' : 'No',
          <Button variant="secondary" onClick={() => startEdit(account)}>Edit</Button>,
        ])}
      />
    </CrudLayout>
  );
}

function CrudLayout({
  title,
  onSubmit,
  onCancel,
  editing,
  hideTable = false,
  children,
}: {
  title: string;
  onSubmit: (event: FormEvent) => void;
  onCancel: () => void;
  editing: boolean;
  hideTable?: boolean;
  children: ReactNode;
}) {
  const childArray = useMemo(() => {
    const nodes = Array.isArray(children) ? children : [children];
    return nodes.filter(Boolean);
  }, [children]);
  const fields = hideTable ? childArray : childArray.slice(0, -1);
  const table = hideTable ? null : childArray[childArray.length - 1];

  return (
    <div className="space-y-6">
      <Card title={title}>
        <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
          {fields}
          <div className="flex items-end gap-2 md:col-span-3">
            <Button type="submit">{editing ? 'Save changes' : 'Add'}</Button>
            {editing && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
          </div>
        </form>
      </Card>
      {table}
    </div>
  );
}

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={onEdit}>Edit</Button>
      <Button variant="danger" onClick={onDelete}>Delete</Button>
    </div>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: ReactNode[][] }) {
  return (
    <Card title="Records">
      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">No records found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr>
                {columns.map(column => (
                  <th key={column} className="px-3 py-2 text-left font-semibold text-slate-700">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className="px-3 py-2 align-top text-slate-700">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<DashboardData>(emptyDashboard);
  const [page, setPage] = useState<Page>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const visiblePages = pageConfig.filter(item => !item.adminOnly || user?.role === 'admin');

  async function refresh() {
    const dashboard = await api.dashboard();
    setData(dashboard);
  }

  useEffect(() => {
    async function boot() {
      const token = localStorage.getItem('pm_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const result = await api.me();
        setUser(result.user);
        await refresh();
      } catch {
        localStorage.removeItem('pm_token');
      } finally {
        setLoading(false);
      }
    }

    boot().catch(console.error);
  }, []);

  useEffect(() => {
    if (user?.role === 'tenant' && page === 'properties') setPage('dashboard');
  }, [page, user]);

  async function handleLogin(nextUser: User) {
    setUser(nextUser);
    await refresh();
  }

  function logout() {
    localStorage.removeItem('pm_token');
    setUser(null);
    setData(emptyDashboard);
    setPage('dashboard');
  }

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">Loading PropManagerr...</main>;
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  let content: ReactNode;
  try {
    if (user.role === 'tenant' && page === 'dashboard') content = <TenantPortal data={data} user={user} />;
    else if (page === 'dashboard') content = <Dashboard data={data} user={user} />;
    else if (page === 'properties') content = <Properties data={data} refresh={refresh} />;
    else if (page === 'tenants') content = <Tenants data={data} refresh={refresh} />;
    else if (page === 'rent') content = <Rent data={data} refresh={refresh} user={user} />;
    else if (page === 'maintenance') content = <Maintenance data={data} refresh={refresh} user={user} />;
    else if (page === 'documents') content = <Documents data={data} refresh={refresh} user={user} />;
    else if (page === 'expenses') content = <Expenses data={data} refresh={refresh} />;
    else if (page === 'admin') content = <Admin data={data} refresh={refresh} />;
  } catch (err) {
    content = (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
        {err instanceof Error ? err.message : 'Something went wrong'}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar visiblePages={visiblePages} currentPage={page} onPageChange={setPage} version={APP_VERSION} />
      <main className="flex-1 p-6">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{visiblePages.find(item => item.page === page)?.label || 'Dashboard'}</h1>
            <p className="text-sm text-slate-500">Signed in as {user.name} ({user.role})</p>
          </div>
          <Button variant="secondary" onClick={logout}>
            <span className="inline-flex items-center gap-2"><LogOut className="h-4 w-4" /> Sign out</span>
          </Button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {content}
      </main>
    </div>
  );
}
