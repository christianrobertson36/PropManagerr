import { useEffect, useMemo, useState } from 'react';
import type { ComponentType, FormEvent, ReactNode } from 'react';
import {
  AlertTriangle,
  Building2,
  ClipboardList,
  FileText,
  Home,
  LogOut, Moon,
  Receipt,
  ShieldCheck, Sun,
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
  ComplianceUpdate,
  DocumentPayload,
  ExpensePayload,
  PropertyPayload,
  RentPaymentPayload,
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
  MaintenanceTicket,
  TicketStatus,
  Urgency,
  Tenant,
  User,
} from './types';

type PageConfig = {
  page: Page;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const APP_VERSION = '1.0.1';
const LICENSE_API_URL = 'http://192.168.1.177:8080/api';
const LICENSE_KEY_STORAGE = 'pm_license_key';
const LICENSE_TOKEN_STORAGE = 'pm_license_activation_token';
const LICENSE_DEVICE_STORAGE = 'pm_license_device_id';

function desktopDeviceId() {
  const existing = localStorage.getItem(LICENSE_DEVICE_STORAGE);
  if (existing) return existing;
  const next = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(LICENSE_DEVICE_STORAGE, next);
  return next;
}

async function postLicense<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${LICENSE_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || `Licence server returned HTTP ${response.status}`);
  }

  return data as T;
}

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


function LicenseActivation({
  onActivate,
  error,
  loading,
}: {
  onActivate: (licenseKey: string) => Promise<void>;
  error: string;
  loading: boolean;
}) {
  const [licenseKey, setLicenseKey] = useState(localStorage.getItem(LICENSE_KEY_STORAGE) || '');

  async function submit(event: FormEvent) {
    event.preventDefault();
    await onActivate(licenseKey);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">PropManagerr Local SQLite</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Activate your licence</h1>
          <p className="mt-2 text-sm text-slate-500">
            This copy needs an online licence check before it can be used.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <Input label="Licence key" value={licenseKey} onChange={setLicenseKey} required />
          <Button type="submit" disabled={loading || !licenseKey.trim()}>
            {loading ? 'Activating...' : 'Activate licence'}
          </Button>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Device ID: {desktopDeviceId()}
        </p>
      </form>
    </main>
  );
}

function Dashboard({ data }: { data: DashboardData; user: User }) {
  const [updates, setUpdates] = useState<ComplianceUpdate[]>([]);
  const [updatesError, setUpdatesError] = useState('');

  const paidPayments = data.rentPayments.filter(payment => payment.status === 'paid');
  const outstandingPayments = data.rentPayments.filter(payment => payment.status !== 'paid');
  const overduePayments = data.rentPayments.filter(payment => payment.status === 'overdue');
  const pendingPayments = data.rentPayments.filter(payment => payment.status === 'pending');
  const paid = paidPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const outstanding = outstandingPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const overdueAmount = overduePayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalExpected = paid + outstanding;
  const collectionRate = totalExpected > 0 ? Math.round((paid / totalExpected) * 100) : 0;
  const totalMonthlyRent = data.properties.reduce((sum, property) => sum + Number(property.monthly_rent || 0), 0);
  const activeProperties = data.properties.filter(property => property.status === 'active').length;
  const vacantProperties = data.properties.filter(property => property.status === 'vacant').length;
  const openRepairs = data.maintenanceTickets.filter(ticket => ticket.status !== 'resolved').length;
  const expiring = data.documents
    .filter(document => {
      const days = daysUntil(document.expiry_date);
      return days !== null && days <= 90;
    })
    .sort((a, b) => (daysUntil(a.expiry_date) || 0) - (daysUntil(b.expiry_date) || 0));
  const urgentCompliance = expiring.filter(document => {
    const days = daysUntil(document.expiry_date);
    return days !== null && days <= 30;
  }).length;
  const recentRepairs = [...data.maintenanceTickets]
    .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
    .slice(0, 5);
  const propertySnapshot = data.properties.slice(0, 6);

  useEffect(() => {
    let cancelled = false;

    api.complianceUpdates()
      .then(rows => {
        if (!cancelled) setUpdates(rows);
      })
      .catch(err => {
        if (!cancelled) setUpdatesError(err instanceof Error ? err.message : 'Could not load compliance updates');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function updateBadgeClass(severity: ComplianceUpdate['severity']) {
    if (severity === 'required') return 'bg-rose-100 text-rose-700';
    if (severity === 'important') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-700';
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-300">Portfolio overview</p>
            <h2 className="mt-2 text-3xl font-bold">Landlord dashboard</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Track rent, repairs, compliance documents and legal updates from one place.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-2xl font-bold">{activeProperties}</p>
              <p className="text-xs text-slate-300">Active</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-2xl font-bold">{vacantProperties}</p>
              <p className="text-xs text-slate-300">Vacant</p>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur">
              <p className="text-2xl font-bold">{collectionRate}%</p>
              <p className="text-xs text-slate-300">Collected</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat label="Monthly rent roll" value={money(totalMonthlyRent)} icon={Building2} />
        <Stat label="Rent collected" value={money(paid)} icon={Receipt} />
        <Stat label="Outstanding" value={money(outstanding)} icon={AlertTriangle} />
        <Stat label="Open repairs" value={String(openRepairs)} icon={Wrench} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Rent collection">
            <div className="space-y-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
                <div>
                  <p className="text-sm text-slate-500">Collection rate</p>
                  <p className="text-3xl font-bold text-slate-900">{collectionRate}%</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-emerald-50 p-3 text-emerald-800">
                    <p className="font-semibold">Paid</p>
                    <p>{money(paid)}</p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3 text-amber-800">
                    <p className="font-semibold">Pending</p>
                    <p>{pendingPayments.length}</p>
                  </div>
                  <div className="rounded-lg bg-rose-50 p-3 text-rose-800">
                    <p className="font-semibold">Overdue</p>
                    <p>{money(overdueAmount)}</p>
                  </div>
                </div>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${collectionRate}%` }} />
              </div>
            </div>
          </Card>

          <Card title="Needs attention">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Overdue rent</p>
                <p className="mt-2 text-2xl font-bold text-rose-900">{overduePayments.length}</p>
                <p className="text-sm text-rose-700">payments need chasing</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Compliance</p>
                <p className="mt-2 text-2xl font-bold text-amber-900">{urgentCompliance}</p>
                <p className="text-sm text-amber-700">documents due within 30 days</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Vacant</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{vacantProperties}</p>
                <p className="text-sm text-slate-600">properties available</p>
              </div>
            </div>
          </Card>

          <Card title="Property snapshot">
            {propertySnapshot.length === 0 ? (
              <p className="text-sm text-slate-600">No properties found.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Property</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Tenant</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Rent</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-slate-700">Docs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {propertySnapshot.map(property => {
                      const tenant = data.tenants.find(row => row.property_id === property.id);
                      const docsDue = expiring.filter(document => document.property_id === property.id).length;
                      return (
                        <tr key={property.id}>
                          <td className="px-3 py-2 text-slate-800">{property.address}</td>
                          <td className="px-3 py-2 text-slate-600">{tenant?.name || '-'}</td>
                          <td className="px-3 py-2 text-slate-600">{money(property.monthly_rent)}</td>
                          <td className="px-3 py-2 text-slate-600">{property.status}</td>
                          <td className="px-3 py-2 text-slate-600">{docsDue > 0 ? `${docsDue} due` : 'OK'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Compliance reminders">
            {expiring.length === 0 ? (
              <p className="text-sm text-slate-600">No documents expiring in the next 90 days.</p>
            ) : (
              <div className="space-y-2">
                {expiring.slice(0, 6).map(document => {
                  const days = daysUntil(document.expiry_date);
                  const overdue = days !== null && days < 0;
                  return (
                    <div key={document.id} className={`flex items-center justify-between rounded-lg border p-3 text-sm ${overdue ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
                      <div>
                        <p className={`font-medium ${overdue ? 'text-rose-900' : 'text-amber-900'}`}>{document.name}</p>
                        <p className={overdue ? 'text-rose-700' : 'text-amber-700'}>{document.property?.address || document.tenant?.name || 'General document'}</p>
                      </div>
                      <span className={overdue ? 'text-rose-700' : 'text-amber-700'}>
                        {days !== null && days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Compliance Updates / Legal Changes">
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Official-source links for awareness only. This is not legal advice.
            </div>

            {updatesError && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {updatesError}
              </div>
            )}

            {updates.length === 0 && !updatesError ? (
              <p className="text-sm text-slate-600">Loading compliance updates...</p>
            ) : (
              <div className="space-y-3">
                {updates.map(update => (
                  <a
                    key={update.id}
                    href={update.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border border-slate-200 p-4 transition hover:border-emerald-300 hover:bg-emerald-50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{update.title}</p>
                        <p className="mt-1 text-sm text-slate-600">{update.summary}</p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-medium ${updateBadgeClass(update.severity)}`}>{update.severity}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{update.source}</span>
                      {update.effective_date && <span>Effective: {dateOnly(update.effective_date)}</span>}
                      {update.last_checked && <span>Checked: {dateOnly(update.last_checked)}</span>}
                    </div>
                  </a>
                ))}
              </div>
            )}
          </Card>

          <Card title="Recent repairs">
            {recentRepairs.length === 0 ? (
              <p className="text-sm text-slate-600">No repair tickets found.</p>
            ) : (
              <div className="space-y-3">
                {recentRepairs.map(ticket => (
                  <div key={ticket.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{ticket.title}</p>
                        <p className="text-sm text-slate-500">{ticket.property?.address || ticket.property_id}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{ticket.status}</span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Created {dateOnly(ticket.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
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
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<RentPaymentUpdate>({ amount: 0, due_date: '', paid_date: null, status: 'pending', payment_method: '', notes: '' });
  const [createForm, setCreateForm] = useState<RentPaymentPayload>({
    tenant_id: '',
    property_id: '',
    amount: 0,
    due_date: new Date().toISOString().slice(0, 10),
    paid_date: null,
    status: 'pending',
    payment_method: '',
    notes: '',
  });
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

  

  function tenantPropertyId(tenantId: string) {
    if (!tenantId) return '';
    const tenant = data.tenants.find(row => row.id === tenantId);
    return tenant?.property_id || tenant?.property?.id || '';
  }

  function resetCreatePayment() {
    setCreating(false);
    setCreateForm({
      tenant_id: '',
      property_id: '',
      amount: 0,
      due_date: new Date().toISOString().slice(0, 10),
      paid_date: null,
      status: 'pending',
      payment_method: '',
      notes: '',
    });
  }

  function selectCreateTenant(tenantId: string) {
    setCreateForm({
      ...createForm,
      tenant_id: tenantId,
      property_id: tenantPropertyId(tenantId),
    });
  }

  async function createPayment(event: FormEvent) {
    event.preventDefault();
    const propertyId = createForm.property_id || tenantPropertyId(createForm.tenant_id);
    await api.createPayment({
      ...createForm,
      tenant_id: createForm.tenant_id || null,
      property_id: propertyId || null,
      paid_date: createForm.paid_date || null,
      payment_method: createForm.payment_method || null,
      notes: createForm.notes || null,
    });
    resetCreatePayment();
    await refresh();
  }
async function remove(id: string) {
    await api.deleteRentPayment(id);
    await refresh();
  }

  return (
    <div className="space-y-6">
      {user.role === 'admin' && !creating && !editing && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)}>Add payment</Button>
        </div>
      )}

      {creating && user.role === 'admin' && (
        <Card title="Add rent payment">
          <form onSubmit={createPayment} className="grid gap-4 md:grid-cols-3">
            <Select<string> label="Tenant" value={fieldValue(createForm.tenant_id)} onChange={value => selectCreateTenant(value)}>
              <option value="">Choose tenant</option>
              {data.tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
            </Select>
            <Select<string> label="Property" value={fieldValue(createForm.property_id)} onChange={value => setCreateForm({ ...createForm, property_id: value || '' })}>
              <option value="">Choose property</option>
              {data.properties.map(property => <option key={property.id} value={property.id}>{property.address}</option>)}
            </Select>
            <Input label="Amount" type="number" value={fieldValue(createForm.amount)} onChange={value => setCreateForm({ ...createForm, amount: Number(value) })} required />
            <Input label="Due date" type="date" value={fieldValue(createForm.due_date)} onChange={value => setCreateForm({ ...createForm, due_date: value })} required />
            <Input label="Paid date" type="date" value={fieldValue(createForm.paid_date)} onChange={value => setCreateForm({ ...createForm, paid_date: value || null })} />
            <Select<PaymentStatus> label="Status" value={(createForm.status as PaymentStatus) || 'pending'} onChange={value => setCreateForm({ ...createForm, status: value || 'pending' })}>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </Select>
            <Input label="Payment method" value={fieldValue(createForm.payment_method)} onChange={value => setCreateForm({ ...createForm, payment_method: value })} />
            <Input label="Notes" value={fieldValue(createForm.notes)} onChange={value => setCreateForm({ ...createForm, notes: value })} />
            <div className="flex items-end gap-2 md:col-span-3">
              <Button type="submit" disabled={!createForm.tenant_id || !createForm.due_date}>Save payment</Button>
              <Button variant="secondary" onClick={resetCreatePayment}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

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
  const [editing, setEditing] = useState<MaintenanceTicket | null>(null);
  const [adminForm, setAdminForm] = useState({
    property_id: '',
    tenant_id: '',
    title: '',
    description: '',
    urgency: 'medium' as Urgency,
    status: 'open' as TicketStatus,
    contractor: '',
    cost: '',
    notes: '',
  });

  const currentTenant = user.role === 'tenant'
    ? data.tenants.find(tenant => tenant.id === user.tenant_id) || null
    : null;
  const tenantPropertyId = currentTenant?.property_id || currentTenant?.property?.id || '';
  const tenantProperty = tenantPropertyId
    ? data.properties.find(property => property.id === tenantPropertyId) || currentTenant?.property || null
    : null;
  const tenantFallbackProperty = user.role === 'tenant' ? tenantProperty || data.properties[0] || null : null;
  const availableProperties = user.role === 'tenant'
    ? tenantFallbackProperty ? [tenantFallbackProperty] : []
    : data.properties;

  const [propertyId, setPropertyId] = useState(availableProperties[0]?.id || '');

  useEffect(() => {
    const nextPropertyId = user.role === 'tenant'
      ? tenantFallbackProperty?.id || tenantFallbackProperty?.property_id || ''
      : data.properties[0]?.id || '';

    if (!propertyId && nextPropertyId) {
      setPropertyId(nextPropertyId);
    }
  }, [data.properties, propertyId, tenantFallbackProperty, user.role]);

  const selectedProperty = availableProperties.find(property => property.id === propertyId) || tenantFallbackProperty;
  const repairPropertyId = user.role === 'tenant'
    ? selectedProperty?.id || tenantPropertyId || propertyId
    : propertyId;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!repairPropertyId) return;

    await api.createTicket({ title, description, property_id: repairPropertyId, urgency: 'medium' });
    setTitle('');
    setDescription('');
    await refresh();
  }

  const visibleTickets = user.role === 'tenant'
    ? data.maintenanceTickets.filter(ticket => {
        const ticketPropertyId = ticket.property_id || ticket.property?.id;
        return ticket.tenant_id === user.tenant_id || Boolean(tenantPropertyId && ticketPropertyId === tenantPropertyId);
      })
    : data.maintenanceTickets;

  function ticketAddress(ticketPropertyId: string | null | undefined) {
    if (!ticketPropertyId) return '-';
    return data.properties.find(property => property.id === ticketPropertyId)?.address || ticketPropertyId;
  }

  function startEdit(ticket: MaintenanceTicket) {
    setEditing(ticket);
    setAdminForm({
      property_id: ticket.property_id || ticket.property?.id || '',
      tenant_id: ticket.tenant_id || '',
      title: ticket.title || '',
      description: ticket.description || '',
      urgency: ticket.urgency || 'medium',
      status: ticket.status || 'open',
      contractor: (ticket as MaintenanceTicket & { contractor?: string | null }).contractor || '',
      cost: fieldValue((ticket as MaintenanceTicket & { cost?: number | string | null }).cost),
      notes: (ticket as MaintenanceTicket & { notes?: string | null }).notes || '',
    });
  }

  function resetEdit() {
    setEditing(null);
    setAdminForm({
      property_id: '',
      tenant_id: '',
      title: '',
      description: '',
      urgency: 'medium',
      status: 'open',
      contractor: '',
      cost: '',
      notes: '',
    });
  }

  async function saveTicket(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;

    await api.updateMaintenanceTicket(editing.id, {
      property_id: adminForm.property_id || null,
      tenant_id: adminForm.tenant_id || null,
      title: adminForm.title,
      description: adminForm.description,
      urgency: adminForm.urgency,
      status: adminForm.status,
      contractor: adminForm.contractor || null,
      cost: adminForm.cost ? Number(adminForm.cost) : null,
      notes: adminForm.notes || null,
    });
    resetEdit();
    await refresh();
  }

  async function deleteTicket(id: string) {
    if (!confirm('Delete this repair ticket?')) return;
    await api.deleteMaintenanceTicket(id);
    await refresh();
  }

  return (
    <div className="space-y-6">
      {user.role === 'admin' && editing && (
        <Card title="Update repair ticket">
          <form onSubmit={saveTicket} className="grid gap-4 md:grid-cols-3">
            <Select<string> label="Property" value={adminForm.property_id} onChange={value => setAdminForm({ ...adminForm, property_id: value })}>
              <option value="">Choose property</option>
              {data.properties.map(property => <option key={property.id} value={property.id}>{property.address}</option>)}
            </Select>
            <Select<string> label="Tenant" value={adminForm.tenant_id} onChange={value => setAdminForm({ ...adminForm, tenant_id: value || '' })}>
              <option value="">No tenant</option>
              {data.tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
            </Select>
            <Select<Urgency> label="Urgency" value={adminForm.urgency} onChange={value => setAdminForm({ ...adminForm, urgency: value || 'medium' })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </Select>
            <Input label="Title" value={adminForm.title} onChange={value => setAdminForm({ ...adminForm, title: value })} required />
            <Select<TicketStatus> label="Status" value={adminForm.status} onChange={value => setAdminForm({ ...adminForm, status: value || 'open' })}>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="resolved">Resolved</option>
            </Select>
            <Input label="Contractor" value={adminForm.contractor} onChange={value => setAdminForm({ ...adminForm, contractor: value })} />
            <Input label="Cost" type="number" value={adminForm.cost} onChange={value => setAdminForm({ ...adminForm, cost: value })} />
            <label className="block text-sm font-medium text-slate-700 md:col-span-2">
              Description
              <textarea
                className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={adminForm.description}
                onChange={event => setAdminForm({ ...adminForm, description: event.target.value })}
                required
              />
            </label>
            <label className="block text-sm font-medium text-slate-700 md:col-span-3">
              Notes
              <textarea
                className="mt-1 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                value={adminForm.notes}
                onChange={event => setAdminForm({ ...adminForm, notes: event.target.value })}
              />
            </label>
            <div className="flex items-end gap-2 md:col-span-3">
              <Button type="submit">Save repair</Button>
              <Button variant="secondary" onClick={resetEdit}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      <Card title="Report a repair">
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
          <Input label="Title" value={title} onChange={setTitle} required />

          {user.role === 'tenant' ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">Repair address</p>
              <p>{selectedProperty?.address || 'No property assigned yet'}</p>
              {selectedProperty?.postcode && <p className="text-slate-500">{selectedProperty.postcode}</p>}
            </div>
          ) : (
            <Select<string> label="Property" value={propertyId} onChange={value => setPropertyId(value)}>
              <option value="">Choose property</option>
              {availableProperties.map(property => <option key={property.id} value={property.id}>{property.address}</option>)}
            </Select>
          )}

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
            <Button type="submit" disabled={!repairPropertyId}>Submit repair</Button>
          </div>
        </form>
      </Card>

      <Table
        columns={user.role === 'admin'
          ? ['Title', 'Property', 'Tenant', 'Urgency', 'Status', 'Created', 'Actions']
          : ['Title', 'Property', 'Urgency', 'Status', 'Created']}
        rows={visibleTickets.map(ticket => {
          const baseRow: ReactNode[] = [
            ticket.title,
            ticket.property?.address || ticketAddress(ticket.property_id),
            ticket.urgency,
            ticket.status,
            dateOnly(ticket.created_at),
          ];

          if (user.role !== 'admin') return baseRow;

          return [
            ticket.title,
            ticket.property?.address || ticketAddress(ticket.property_id),
            ticket.tenant?.name || '-',
            ticket.urgency,
            ticket.status,
            dateOnly(ticket.created_at),
            <Actions onEdit={() => startEdit(ticket)} onDelete={() => deleteTicket(ticket.id)} />,
          ];
        })}
      />
    </div>
  );
}

function Documents({ data, refresh, user }: { data: DashboardData; refresh: () => Promise<void>; user: User }) {
  const [editing, setEditing] = useState<DocumentRecord | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [documentError, setDocumentError] = useState('');
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [documentAudience, setDocumentAudience] = useState<'all' | 'property' | 'tenant'>('all');
  const [form, setForm] = useState<DocumentPayload>({ property_id: '', tenant_id: '', name: '', doc_type: 'other', expiry_date: null, file_url: '' });

  const currentTenant = user.role === 'tenant'
    ? data.tenants.find(tenant => tenant.id === user.tenant_id) || null
    : null;
  const currentTenantPropertyId = currentTenant?.property_id || currentTenant?.property?.id || '';

  const visibleDocuments = user.role === 'tenant'
    ? data.documents.filter(document => {
        const documentPropertyId = document.property_id || document.property?.id;
        const isGlobalDocument = !document.tenant_id && !documentPropertyId;
        return (
          isGlobalDocument ||
          document.tenant_id === user.tenant_id ||
          Boolean(currentTenantPropertyId && documentPropertyId === currentTenantPropertyId)
        );
      })
    : data.documents;

  function propertyAddress(propertyId: string | null | undefined) {
    if (!propertyId) return 'All properties';
    return data.properties.find(property => property.id === propertyId)?.address || propertyId;
  }

  function tenantName(tenantId: string | null | undefined) {
    if (!tenantId) return 'All tenants';
    return data.tenants.find(tenant => tenant.id === tenantId)?.name || tenantId;
  }

  function tenantPropertyId(tenantId: string | null | undefined) {
    if (!tenantId) return '';
    const tenant = data.tenants.find(row => row.id === tenantId);
    return tenant?.property_id || tenant?.property?.id || '';
  }

  function setAudience(audience: 'all' | 'property' | 'tenant' | '') {
    const nextAudience = audience || 'all';
    setDocumentAudience(nextAudience);

    if (nextAudience === 'all') {
      setForm({ ...form, tenant_id: null, property_id: null });
      return;
    }

    if (nextAudience === 'property') {
      setForm({ ...form, tenant_id: null, property_id: form.property_id || '' });
      return;
    }

    setForm({ ...form, tenant_id: form.tenant_id || '', property_id: tenantPropertyId(form.tenant_id || '') || form.property_id || '' });
  }

  function setDocumentTenant(tenantId: string) {
    const nextPropertyId = tenantPropertyId(tenantId);
    setForm({
      ...form,
      tenant_id: tenantId || null,
      property_id: nextPropertyId || null,
    });
  }

  function setDocumentProperty(propertyId: string) {
    setForm({
      ...form,
      property_id: propertyId || null,
      tenant_id: documentAudience === 'property' ? null : form.tenant_id,
    });
  }

  function startEdit(document: DocumentRecord) {
    const documentPropertyId = document.property_id || document.property?.id || '';
    const nextAudience = document.tenant_id ? 'tenant' : documentPropertyId ? 'property' : 'all';
    setEditing(document);
    setDocumentAudience(nextAudience);
    setDocumentError('');
    setForm({
      property_id: documentPropertyId,
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
    setDocumentAudience('all');
    setDocumentError('');
    setForm({ property_id: '', tenant_id: '', name: '', doc_type: 'other', expiry_date: null, file_url: '' });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setDocumentError('');

    try {
      let fileUrl = form.file_url || '';
      if (file) {
        const uploaded = await api.uploadDocument(file);
        fileUrl = uploaded.file_url;
      }

      const selectedTenantId = documentAudience === 'tenant' ? form.tenant_id || null : null;
      const selectedPropertyId = documentAudience === 'tenant'
        ? tenantPropertyId(form.tenant_id || '') || form.property_id || null
        : documentAudience === 'property'
          ? form.property_id || null
          : null;

      if (documentAudience === 'tenant' && !selectedTenantId) {
        setDocumentError('Choose a tenant, or change Share with to All tenants.');
        return;
      }

      if (documentAudience === 'property' && !selectedPropertyId) {
        setDocumentError('Choose a property, or change Share with to All tenants.');
        return;
      }

      const payload = {
        ...form,
        property_id: selectedPropertyId,
        tenant_id: selectedTenantId,
        expiry_date: form.expiry_date || null,
        file_url: fileUrl,
      };

      if (editing) await api.updateDocument(editing.id, payload);
      else await api.createDocument(payload);
      reset();
      await refresh();
    } catch (err) {
      setDocumentError(err instanceof Error ? err.message : 'Could not save document');
    }
  }

  async function remove(id: string) {
    const confirmed = window.confirm('Delete this document record? This removes it from PropManagerr and tenants will no longer see it.');
    if (!confirmed) return;

    setDocumentError('');
    setDeletingDocumentId(id);

    try {
      await api.deleteDocument(id);
      if (editing?.id === id) reset();
      await refresh();
    } catch (err) {
      setDocumentError(err instanceof Error ? err.message : 'Could not delete document');
    } finally {
      setDeletingDocumentId(null);
    }
  }

  return (
    <div className="space-y-6">
      {documentError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {documentError}
        </div>
      )}

      {user.role === 'admin' && (
        <CrudLayout title={editing ? 'Edit document' : 'Add document'} onSubmit={submit} onCancel={reset} editing={Boolean(editing)} hideTable>
          <Select<'all' | 'property' | 'tenant'> label="Share with" value={documentAudience} onChange={setAudience}>
            <option value="all">All tenants</option>
            <option value="tenant">One tenant</option>
            <option value="property">One property</option>
          </Select>

          {documentAudience === 'tenant' && (
            <Select<string> label="Tenant (auto-fills property)" value={fieldValue(form.tenant_id)} onChange={setDocumentTenant}>
              <option value="">Choose tenant</option>
              {data.tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}
            </Select>
          )}

          {documentAudience === 'property' && (
            <Select<string> label="Property" value={fieldValue(form.property_id)} onChange={setDocumentProperty}>
              <option value="">Choose property</option>
              {data.properties.map(property => <option key={property.id} value={property.id}>{property.address}</option>)}
            </Select>
          )}

          {documentAudience === 'tenant' && form.property_id && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Property auto-filled: <span className="font-medium text-slate-800">{propertyAddress(form.property_id)}</span>
            </div>
          )}

          {documentAudience === 'all' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              This document will be visible to every tenant. It will not be tied to one property or one tenant.
            </div>
          )}

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
          document.property?.address || propertyAddress(document.property_id),
          document.tenant?.name || tenantName(document.tenant_id),
          dateOnly(document.expiry_date) || '-',
          document.file_url ? <a key={`${document.id}-file`} className="font-medium text-emerald-700 hover:underline" href={api.documentFileUrl(document.file_url)} target="_blank" rel="noreferrer">View</a> : 'Not uploaded',
          user.role === 'admin' ? (
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => startEdit(document)}>Edit</Button>
              <Button variant="danger" disabled={deletingDocumentId === document.id} onClick={() => remove(document.id)}>
                {deletingDocumentId === document.id ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          ) : '-',
        ])}
      />
    </div>
  );
}

function Expenses({ data, refresh }: { data: DashboardData; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<Expense | null>(null);
  const [propertyFilter, setPropertyFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [monthFilter, setMonthFilter] = useState(dateOnly(new Date().toISOString()).slice(0, 7));
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<ExpensePayload>({
    property_id: '',
    date: dateOnly(new Date().toISOString()),
    category: '',
    description: '',
    amount: 0,
  });

  const categories = Array.from(new Set(data.expenses.map(expense => expense.category).filter(Boolean))).sort();
  const currentYear = String(new Date().getFullYear());

  const filteredExpenses = data.expenses
    .filter(expense => !propertyFilter || expense.property_id === propertyFilter)
    .filter(expense => !categoryFilter || expense.category === categoryFilter)
    .filter(expense => !monthFilter || dateOnly(expense.date).startsWith(monthFilter))
    .sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());

  const allTimeTotal = data.expenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const filteredTotal = filteredExpenses.reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const monthTotal = data.expenses
    .filter(expense => dateOnly(expense.date).startsWith(monthFilter))
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);
  const yearTotal = data.expenses
    .filter(expense => dateOnly(expense.date).startsWith(currentYear))
    .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

  const propertyTotals = data.properties
    .map(property => ({
      property,
      total: data.expenses
        .filter(expense => expense.property_id === property.id)
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    }))
    .filter(row => row.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const categoryTotals = categories
    .map(category => ({
      category,
      total: data.expenses
        .filter(expense => expense.category === category)
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  function startEdit(expense: Expense) {
    setFormError('');
    setEditing(expense);
    setForm({
      property_id: expense.property_id || '',
      date: dateOnly(expense.date),
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
    });
  }

  function reset() {
    setFormError('');
    setEditing(null);
    setForm({ property_id: '', date: dateOnly(new Date().toISOString()), category: '', description: '', amount: 0 });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    try {
      const payload = { ...form, property_id: form.property_id || null, amount: Number(form.amount || 0) };
      if (editing) await api.updateExpense(editing.id, payload);
      else await api.createExpense(payload);
      reset();
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save expense');
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this expense record?')) return;
    setFormError('');
    try {
      await api.deleteExpense(id);
      await refresh();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not delete expense');
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="This month" value={money(monthTotal)} icon={Receipt} />
        <Stat label="Year to date" value={money(yearTotal)} icon={ClipboardList} />
        <Stat label="Filtered total" value={money(filteredTotal)} icon={AlertTriangle} />
        <Stat label="All expenses" value={money(allTimeTotal)} icon={Building2} />
      </div>

      <Card title={editing ? 'Edit expense' : 'Add expense'}>
        {formError && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {formError}
          </div>
        )}
        <form onSubmit={submit} className="grid gap-4 md:grid-cols-3">
          <Select<string> label="Property" value={fieldValue(form.property_id)} onChange={value => setForm({ ...form, property_id: value || null })}>
            <option value="">No property</option>
            {data.properties.map(property => <option key={property.id} value={property.id}>{property.address}</option>)}
          </Select>
          <Input label="Date" type="date" value={fieldValue(form.date)} onChange={value => setForm({ ...form, date: value })} />
          <Input label="Amount" type="number" value={fieldValue(form.amount)} onChange={value => setForm({ ...form, amount: Number(value) })} />
          <Input label="Category" value={fieldValue(form.category)} onChange={value => setForm({ ...form, category: value })} required />
          <Input label="Description" value={fieldValue(form.description)} onChange={value => setForm({ ...form, description: value })} />
          <div className="flex items-end gap-2">
            <Button type="submit">{editing ? 'Save changes' : 'Add expense'}</Button>
            {editing && <Button variant="secondary" onClick={reset}>Cancel</Button>}
          </div>
        </form>
      </Card>

      <Card title="Expense filters">
        <div className="grid gap-4 md:grid-cols-3">
          <Select<string> label="Property" value={propertyFilter} onChange={value => setPropertyFilter(value)}>
            <option value="">All properties</option>
            {data.properties.map(property => <option key={property.id} value={property.id}>{property.address}</option>)}
          </Select>
          <Select<string> label="Category" value={categoryFilter} onChange={value => setCategoryFilter(value)}>
            <option value="">All categories</option>
            {categories.map(category => <option key={category} value={category}>{category}</option>)}
          </Select>
          <Input label="Month" type="month" value={monthFilter} onChange={setMonthFilter} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => { setPropertyFilter(''); setCategoryFilter(''); setMonthFilter(''); }}>Clear filters</Button>
          <Button variant="secondary" onClick={() => setMonthFilter(dateOnly(new Date().toISOString()).slice(0, 7))}>This month</Button>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Top properties by spend">
          {propertyTotals.length === 0 ? (
            <p className="text-sm text-slate-600">No property expenses recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {propertyTotals.map(row => (
                <div key={row.property.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                  <span className="font-medium text-slate-800">{row.property.address}</span>
                  <span className="font-semibold text-slate-900">{money(row.total)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Top categories">
          {categoryTotals.length === 0 ? (
            <p className="text-sm text-slate-600">No expense categories recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {categoryTotals.map(row => (
                <div key={row.category} className="flex items-center justify-between rounded-lg border border-slate-200 p-3 text-sm">
                  <span className="font-medium text-slate-800">{row.category}</span>
                  <span className="font-semibold text-slate-900">{money(row.total)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Table
        columns={['Date', 'Property', 'Category', 'Description', 'Amount', 'Actions']}
        rows={filteredExpenses.map(expense => [
          dateOnly(expense.date),
          expense.property?.address || '-',
          expense.category,
          expense.description || '-',
          money(expense.amount),
          <Actions onEdit={() => startEdit(expense)} onDelete={() => remove(expense.id)} />,
        ])}
      />
    </div>
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
  } async function remove(account: AdminAccount) { if (!window.confirm(`Delete login account ${account.email}?`)) return; try { await api.deleteAdminAccount(account.id); if (editing?.id === account.id) reset(); await loadAccounts(); } catch (err) { window.alert(err instanceof Error ? err.message : 'Could not delete account'); } } return (
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
          <div className="flex gap-2"> <Button variant="secondary" onClick={() => startEdit(account)}>Edit</Button> <Button variant="danger" onClick={() => remove(account)}>Delete</Button> </div>,
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
  const [error, setError] = useState(''); const [checkingUpdates, setCheckingUpdates] = useState(false); const [updateStatus, setUpdateStatus] = useState(''); const [darkMode, setDarkMode] = useState(() => localStorage.getItem('pm_theme') === 'dark'); const [licenseValid, setLicenseValid] = useState(false); const [licenseLoading, setLicenseLoading] = useState(false); const [licenseError, setLicenseError] = useState('');

  const visiblePages = pageConfig.filter(item => !item.adminOnly || user?.role === 'admin');

  async function checkStoredLicense() {
    const licenseKey = localStorage.getItem(LICENSE_KEY_STORAGE);
    const activationToken = localStorage.getItem(LICENSE_TOKEN_STORAGE);

    if (!licenseKey || !activationToken) {
      setLicenseError('Enter your licence key to activate this desktop app.');
      return false;
    }

    try {
      await postLicense('/license/check', {
        license_key: licenseKey,
        device_id: desktopDeviceId(),
        activation_token: activationToken,
        app_version: APP_VERSION,
      });
      setLicenseError('');
      return true;
    } catch (err) {
      setLicenseError(err instanceof Error ? err.message : 'Licence check failed.');
      localStorage.removeItem(LICENSE_TOKEN_STORAGE);
      return false;
    }
  }

  async function activateLicense(licenseKey: string) {
    setLicenseLoading(true);
    setLicenseError('');

    try {
      const result = await postLicense<{ ok: boolean; activation_token: string }>('/license/activate', {
        license_key: licenseKey.trim(),
        device_id: desktopDeviceId(),
        device_name: 'Windows desktop',
        app_version: APP_VERSION,
      });

      localStorage.setItem(LICENSE_KEY_STORAGE, licenseKey.trim().toUpperCase());
      localStorage.setItem(LICENSE_TOKEN_STORAGE, result.activation_token);
      setLicenseValid(true);
      setLicenseError('');
    } catch (err) {
      setLicenseError(err instanceof Error ? err.message : 'Licence activation failed.');
    } finally {
      setLicenseLoading(false);
    }
  }

  async function refresh() {
    const dashboard = await api.dashboard();
    setData(dashboard);
  }

  useEffect(() => {
    async function boot() {
      const licensed = await checkStoredLicense();
      setLicenseValid(licensed);

      if (!licensed) {
        setLoading(false);
        return;
      }

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

  function toggleDarkMode() {
    setDarkMode(current => {
      const next = !current;
      localStorage.setItem('pm_theme', next ? 'dark' : 'light');
      return next;
    });
  }

  async function checkForUpdates() {
    setCheckingUpdates(true);
    setUpdateStatus('');

    const releasesUrl = 'https://github.com/christianrobertson36/PropManagerr/releases';

    try {
      const response = await fetch('https://api.github.com/repos/christianrobertson36/PropManagerr/releases/latest', {
        headers: { Accept: 'application/vnd.github+json' },
      });

      if (response.status === 404) {
        setUpdateStatus('No GitHub release has been published yet. Opening releases page.');
        window.open(releasesUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      if (!response.ok) {
        throw new Error(`GitHub returned HTTP ${response.status}`);
      }

      const release = await response.json();
      const latestVersion = String(release.tag_name || release.name || '').replace(/^v/i, '');
      const currentVersion = String(APP_VERSION || '').replace(/^v/i, '');

      if (latestVersion && latestVersion !== currentVersion) {
        setUpdateStatus(`Update available: ${latestVersion}. Opening GitHub release.`);
        window.open(release.html_url || releasesUrl, '_blank', 'noopener,noreferrer');
      } else {
        setUpdateStatus(`You are on the current version: ${APP_VERSION}`);
      }
    } catch (err) {
      setUpdateStatus(err instanceof Error ? `Could not check for updates: ${err.message}` : 'Could not check for updates.');
    } finally {
      setCheckingUpdates(false);
    }
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

  if (!licenseValid) {
    return <LicenseActivation onActivate={activateLicense} error={licenseError} loading={licenseLoading} />;
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
    <div className={`flex min-h-screen bg-slate-100 ${darkMode ? 'pm-dark' : ''}`}>
      <style>{`
        .pm-dark { background: #0f172a; color: #e2e8f0; }
        .pm-dark .bg-white, .pm-dark .bg-slate-50 { background-color: #1e293b !important; }
        .pm-dark .bg-slate-100 { background-color: #0f172a !important; }
        .pm-dark .border-slate-100, .pm-dark .border-slate-200, .pm-dark .border-slate-300 { border-color: #334155 !important; }
        .pm-dark .text-slate-950, .pm-dark .text-slate-900, .pm-dark .text-slate-800, .pm-dark .text-slate-700 { color: #f8fafc !important; }
        .pm-dark .text-slate-600, .pm-dark .text-slate-500 { color: #cbd5e1 !important; }
        .pm-dark input, .pm-dark select, .pm-dark textarea { background: #0f172a !important; color: #f8fafc !important; border-color: #475569 !important; }
        .pm-dark table thead { background: #0f172a; }
        .pm-dark .hover\\:bg-emerald-50:hover { background-color: #064e3b !important; }
      `}</style>
      <Sidebar visiblePages={visiblePages} currentPage={page} onPageChange={setPage} version={APP_VERSION} />
      <main className="flex-1 p-6">
        <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{visiblePages.find(item => item.page === page)?.label || 'Dashboard'}</h1>
            <p className="text-sm text-slate-500">Signed in as {user.name} ({user.role})</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={toggleDarkMode}>
            <span className="inline-flex items-center gap-2">
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              {darkMode ? 'Light mode' : 'Dark mode'}
            </span>
          </Button>
          <Button variant="secondary" onClick={checkForUpdates} disabled={checkingUpdates}>
            {checkingUpdates ? 'Checking...' : 'Check for updates'}
          </Button>
          <Button variant="secondary" onClick={logout}>
            <span className="inline-flex items-center gap-2"><LogOut className="h-4 w-4" /> Sign out</span>
          </Button>
        </div>
        </div>

        {updateStatus && ( <div className="mb-4 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm text-sky-700"> {updateStatus} </div> )} {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {content}
      </main>
    </div>
  );
}

