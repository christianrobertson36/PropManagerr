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
  LicenceKey,
  LicencePayload,
  NotificationRecord,
  NotificationPayload,
  NotificationReadLog,
  DeletedRecord,
  ComplianceUpdate,
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

const APP_VERSION = '1.0.0';

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
  if (numeric === null || numeric === undefined || Number.isNaN(numeric)) return '£' + '0.00';
  return '£' + numeric.toFixed(2);
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  async function remove(property: Property) {
    const confirmed = window.confirm('Are you sure you want to delete property "' + property.address + '"? This cannot currently be undone.');
    if (!confirmed) return;
    await api.deleteProperty(property.id);
    await refresh();
    await offerUndoDelete('property "' + property.address + '"', 'properties', property.id, refresh);
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

      {editing && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 md:col-span-3">
          <p className="font-semibold text-rose-900">Danger zone</p>
          <p className="mt-1">Delete this property from inside the edit panel only.</p>
          <Button type="button" variant="danger" onClick={() => void remove(editing)}>Delete property</Button>
        </div>
      )}

      <Table
        columns={['Address', 'City', 'Postcode', 'Status', 'Rent', 'Actions']}
        rows={data.properties.map(property => [
          property.address,
          property.city,
          property.postcode,
          property.status,
          money(property.monthly_rent),
          <Actions onEdit={() => startEdit(property)} onDelete={() => remove(property)} />,
        ])}
      />
    </CrudLayout>
  );
}

function buildAgreementBody(tenant: Tenant) {
  const propertyAddress = tenant.property?.address || 'the property linked to this tenancy';
  const rent = tenant.property?.monthly_rent ? money(tenant.property.monthly_rent) : '[rent amount]';
  const leaseStart = dateOnly(tenant.lease_start) || '[lease start date]';
  const leaseEnd = dateOnly(tenant.lease_end) || '[lease end date]';

  return [
    'TENANCY AGREEMENT',
    '',
    'Landlord: Lee Robertson',
    'Tenant: ' + tenant.name,
    'Property: ' + propertyAddress,
    'Rent: ' + rent + ' per month',
    'Tenancy start: ' + leaseStart,
    'Tenancy end: ' + leaseEnd,
    '',
    '1. The tenant agrees to occupy the property as their home and to keep the property in good condition.',
    '2. The tenant agrees to pay rent on time and to report maintenance issues promptly.',
    '3. The landlord will maintain the property in line with applicable landlord responsibilities.',
    '4. This draft should be reviewed before sending for tenant signature.',
    '',
    'Landlord-approved signature marker: Lee Robertson',
    'Tenant signature: ______________________________',
    'Date: ______________________________',
  ].join('\n');
}

function agreementText(agreement: any) {
  return agreement?.agreement_body || 'No agreement wording saved yet.';
}

function agreementFileName(agreement: any) {
  const version = agreement?.agreement_version ? 'v' + agreement.agreement_version : 'draft';
  const tenant = String(agreement?.tenant_name_snapshot || 'tenant').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'tenant';
  return `tenancy-agreement-${tenant}-${version}.txt`;
}


function auditDate(value: any) {
  if (!value) return 'Not recorded yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function auditText(value: any, fallback = 'Not recorded yet') {
  const text = value === null || value === undefined ? '' : String(value).trim();
  return text || fallback;
}

function AgreementAuditTrail({ agreement }: { agreement: any }) {
  const savedDocument = auditText(agreement?.signed_document_url, 'Not saved yet');

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
      <p className="font-semibold text-slate-900">Agreement audit trail</p>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div><span className="font-medium text-slate-700">Created:</span> {auditDate(agreement?.created_at)}</div>
        <div><span className="font-medium text-slate-700">Sent/manual sent:</span> {auditDate(agreement?.sent_at)}</div>
        <div><span className="font-medium text-slate-700">DocuSign envelope:</span> {auditText(agreement?.docusign_envelope_id, 'Not sent via DocuSign')}</div>
        <div><span className="font-medium text-slate-700">Signed:</span> {auditDate(agreement?.signed_at)}</div>
        <div className="md:col-span-2">
          <span className="font-medium text-slate-700">Saved document:</span>{' '}
          {agreement?.signed_document_url ? (
            <a className="font-medium text-emerald-700 hover:text-emerald-800" href={agreement.signed_document_url} target="_blank" rel="noreferrer">Open saved document</a>
          ) : savedDocument}
        </div>
        <div className="md:col-span-2"><span className="font-medium text-slate-700">Notes:</span> {auditText(agreement?.notes, 'No notes saved yet')}</div>
      </div>
    </div>
  );
}
function escapeHtml(value: string) {
  const chars: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, char => chars[char] || char);
}

function downloadAgreementText(agreement: any) {
  const blob = new Blob([agreementText(agreement)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = agreementFileName(agreement);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function copyAgreementText(agreement: any) {
  const text = agreementText(agreement);
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function printAgreementText(agreement: any) {
  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) return;

  const title = agreement?.agreement_title || 'Tenancy Agreement';
  const status = agreement?.status || 'draft';
  const version = agreement?.agreement_version || '';
  const body = escapeHtml(agreementText(agreement));

  printWindow.document.write(`<!doctype html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111827; margin: 40px; line-height: 1.55; }
    .meta { margin-bottom: 24px; padding: 12px; border: 1px solid #d1d5db; background: #f9fafb; font-size: 13px; }
    pre { white-space: pre-wrap; font-family: Arial, sans-serif; font-size: 14px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">Version: ${escapeHtml(String(version))} &nbsp; | &nbsp; Status: ${escapeHtml(status)}</div>
  <pre>${body}</pre>
</body>
</html>`);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}


async function offerUndoDelete(label: string, table: string, id: string, refreshAfter: () => Promise<void>) {
  const undo = window.confirm('Deleted ' + label + '.\n\nUndo delete now?');
  if (!undo) return;

  try {
    await api.restoreDeletedRecord(table, id);
    await refreshAfter();
    window.alert('Restored ' + label + '.');
  } catch (err) {
    window.alert(err instanceof Error ? 'Could not restore: ' + err.message : 'Could not restore deleted record.');
  }
}

function Tenants({ data, refresh }: { data: DashboardData; refresh: () => Promise<void> }) {
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState<TenantPayload>({ property_id: '', name: '', email: '', phone: '', lease_start: null, lease_end: null, payment_status: 'pending' });
  const [agreementsByTenant, setAgreementsByTenant] = useState<Record<string, any[]>>({});
  const [agreementLoading, setAgreementLoading] = useState(false);
  const [agreementError, setAgreementError] = useState('');
  const [savingAgreementId, setSavingAgreementId] = useState<string | null>(null);
  const [previewAgreement, setPreviewAgreement] = useState<any | null>(null);
  const [editingAgreement, setEditingAgreement] = useState<any | null>(null);
  const [agreementBodyDraft, setAgreementBodyDraft] = useState('');
  const [agreementNotice, setAgreementNotice] = useState('');
  const [docusignStatus, setDocusignStatus] = useState<any | null>(null);
  const [portalAccounts, setPortalAccounts] = useState<AdminAccount[]>([]);
  const [creatingPortalTenantId, setCreatingPortalTenantId] = useState<string | null>(null);
  const [previewTenant, setPreviewTenant] = useState<Tenant | null>(null);
  const [tenantPropertyFilter, setTenantPropertyFilter] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [showTenantSetupTools, setShowTenantSetupTools] = useState(false);
  const [legacyAgreementFile, setLegacyAgreementFile] = useState<File | null>(null);
  const [legacyAgreementSaving, setLegacyAgreementSaving] = useState(false);
  const agreementStatuses = ['draft', 'sent', 'signed', 'voided', 'expired'];

  async function loadTenantAgreements() {
    setAgreementLoading(true);
    setAgreementError('');
    try {
      const agreements = await api.listTenancyAgreements();
      const grouped = agreements.reduce<Record<string, any[]>>((acc, agreement) => {
        if (!acc[agreement.tenant_id]) acc[agreement.tenant_id] = [];
        acc[agreement.tenant_id].push(agreement);
        return acc;
      }, {});
      Object.values(grouped).forEach(rows => rows.sort((a, b) => Number(b.agreement_version || 0) - Number(a.agreement_version || 0)));
      setAgreementsByTenant(grouped);
    } catch (err) {
      setAgreementError(err instanceof Error ? err.message : 'Could not load tenancy agreements');
    } finally {
      setAgreementLoading(false);
    }
  }

  async function loadDocuSignStatus() {
    try {
      const status = await api.docusignStatus();
      setDocusignStatus(status);
    } catch (err) {
      setDocusignStatus({ ready: false, missing: ['DocuSign status unavailable'] });
    }
  }

  async function loadPortalAccounts() {
    try {
      const accounts = await api.listAdminAccounts();
      setPortalAccounts(accounts);
    } catch (err) {
      setPortalAccounts([]);
    }
  }

  useEffect(() => {
    void loadTenantAgreements();
    void loadDocuSignStatus();
    void loadPortalAccounts();
  }, []);

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

  async function remove(tenant: Tenant) {
    const confirmed = window.confirm('Are you sure you want to delete tenant "' + tenant.name + '"? This cannot currently be undone.');
    if (!confirmed) return;
    await api.deleteTenant(tenant.id);
    await refresh();
    await loadTenantAgreements();
    await offerUndoDelete('tenant "' + tenant.name + '"', 'tenants', tenant.id, async () => {
      await refresh();
      await loadTenantAgreements();
    });
  }

  async function createAgreement(tenant: Tenant) {
    setSavingAgreementId(tenant.id);
    setAgreementError('');
    try {
      await api.createTenancyAgreement({
        tenant_id: tenant.id,
        agreement_title: 'Tenancy Agreement',
        status: 'draft',
        landlord_name: 'Lee Robertson',
        landlord_signed: true,
        agreement_body: buildAgreementBody(tenant),
        notes: 'Created from tenant record. Landlord-approved signature marker only; send for tenant signing before relying on this agreement.',
      });
      await loadTenantAgreements();
    } catch (err) {
      setAgreementError(err instanceof Error ? err.message : 'Could not create tenancy agreement');
    } finally {
      setSavingAgreementId(null);
    }
  }


  async function saveLegacyAgreement(tenant: Tenant) {
    if (!legacyAgreementFile) {
      window.alert('Choose the tenant paper agreement file first.');
      return;
    }

    setLegacyAgreementSaving(true);
    setAgreementError('');
    setAgreementNotice('');
    try {
      const upload = await api.uploadDocument(legacyAgreementFile);
      const title = 'Legacy paper tenancy agreement - ' + tenant.name;
      await api.createDocument({
        tenant_id: tenant.id,
        property_id: tenant.property_id || null,
        name: title,
        doc_type: 'tenancy_agreement',
        expiry_date: null,
        file_url: upload.file_url,
      });
      await api.createTenancyAgreement({
        tenant_id: tenant.id,
        agreement_title: 'Legacy paper tenancy agreement',
        status: 'signed',
        landlord_name: 'Lee Robertson',
        landlord_signed: true,
        agreement_body: 'Legacy paper tenancy agreement uploaded to Documents. Original file: ' + upload.original_name,
        signed_at: new Date().toISOString(),
        signed_document_url: upload.file_url,
        notes: 'Legacy paper agreement uploaded by admin. Digital agreement can be created separately later.',
      });
      setLegacyAgreementFile(null);
      setAgreementNotice('Legacy paper agreement uploaded and linked to this tenant.');
      await Promise.all([loadTenantAgreements(), refresh()]);
    } catch (err) {
      setAgreementError(err instanceof Error ? err.message : 'Could not save legacy agreement');
    } finally {
      setLegacyAgreementSaving(false);
    }
  }

  async function updateAgreementStatus(agreementId: string, status: string) {
    setSavingAgreementId(agreementId);
    setAgreementError('');
    try {
      const payload: any = { status };
      if (status === 'sent') payload.sent_at = new Date().toISOString();
      if (status === 'signed') payload.signed_at = new Date().toISOString();
      await api.updateTenancyAgreement(agreementId, payload);
      await loadTenantAgreements();
    } catch (err) {
      setAgreementError(err instanceof Error ? err.message : 'Could not update tenancy agreement');
    } finally {
      setSavingAgreementId(null);
    }
  }

  function startEditAgreementBody(agreement: any) {
    setEditingAgreement(agreement);
    setAgreementBodyDraft(agreement.agreement_body || '');
  }

  async function saveAgreementBody() {
    if (!editingAgreement) return;
    setSavingAgreementId(editingAgreement.id);
    setAgreementError('');
    setAgreementNotice('');
    try {
      await api.updateTenancyAgreement(editingAgreement.id, { agreement_body: agreementBodyDraft });
      setEditingAgreement(null);
      setAgreementBodyDraft('');
      setAgreementNotice('Agreement wording saved.');
      await loadTenantAgreements();
    } catch (err) {
      setAgreementError(err instanceof Error ? err.message : 'Could not save agreement wording');
    } finally {
      setSavingAgreementId(null);
    }
  }

  async function copyAgreement(agreement: any) {
    setAgreementError('');
    setAgreementNotice('');
    try {
      await copyAgreementText(agreement);
      setAgreementNotice('Agreement text copied.');
    } catch (err) {
      setAgreementError(err instanceof Error ? err.message : 'Could not copy agreement text');
    }
  }


  async function checkDocuSignSignedCopy(agreement: any) {
    setSavingAgreementId(agreement.id);
    setAgreementError('');
    setAgreementNotice('');
    try {
      const result = await api.completeTenancyAgreementFromDocuSign(agreement.id);
      if (result.completed) {
        setAgreementNotice('Signed DocuSign document downloaded, saved to Documents and agreement marked as signed.');
        setPreviewAgreement(null);
        await Promise.all([loadTenantAgreements(), refresh()]);
      } else {
        setAgreementNotice('DocuSign envelope status: ' + (result.envelope_status || 'not completed') + '. Try again after the tenant has signed.');
      }
    } catch (err) {
      setAgreementError(err instanceof Error ? err.message : 'Could not check DocuSign signed copy');
    } finally {
      setSavingAgreementId(null);
    }
  }

  async function saveAgreementAsDocument(agreement: any) {
    const confirmed = window.confirm('Save this tenancy agreement as a tenant document? This creates a Documents record and stores the current wording as the saved agreement file.');
    if (!confirmed) return;

    setSavingAgreementId(agreement.id);
    setAgreementError('');
    setAgreementNotice('');
    try {
      await api.saveTenancyAgreementAsDocument(agreement.id);
      setAgreementNotice('Agreement saved to Documents.');
      setPreviewAgreement(null);
      await Promise.all([loadTenantAgreements(), refresh()]);
    } catch (err) {
      setAgreementError(err instanceof Error ? err.message : 'Could not save agreement as document');
    } finally {
      setSavingAgreementId(null);
    }
  }

  async function prepareSendForSigning(agreement: any) {
    setSavingAgreementId(agreement.id);
    setAgreementError('');
    setAgreementNotice('');

    try {
      const result = await api.sendTenancyAgreementViaDocuSign(agreement.id);
      setAgreementNotice('Sent via DocuSign. Envelope ID: ' + (result.envelope_id || 'created') + '.');
      await loadTenantAgreements();
      await loadDocuSignStatus();
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not send via DocuSign';
      const fallback = window.confirm(message + '\n\nUse manual signing fallback instead? This will mark the agreement as sent so you can download/print/copy it for tenant signing.');
      if (!fallback) {
        setAgreementError(message);
        setSavingAgreementId(null);
        return;
      }
    }

    try {
      await api.updateTenancyAgreement(agreement.id, {
        status: 'sent',
        sent_at: new Date().toISOString(),
        notes: 'Prepared for manual signing. DocuSign send was not completed.',
      });
      setAgreementNotice('Marked as sent manually. Download, print or copy the agreement and send it to the tenant.');
      await loadTenantAgreements();
    } catch (err) {
      setAgreementError(err instanceof Error ? err.message : 'Could not prepare agreement for signing');
    } finally {
      setSavingAgreementId(null);
    }
  }

  function agreementPanel(tenant: Tenant) {
    const agreements = agreementsByTenant[tenant.id] || [];
    if (!agreements.length) {
      return (
        <div className="min-w-72 space-y-2">
          <div className="text-xs text-slate-500">No agreement yet</div>
          <Button variant="secondary" disabled={savingAgreementId === tenant.id} onClick={() => createAgreement(tenant)}>
            {savingAgreementId === tenant.id ? 'Creating...' : 'Create agreement'}
          </Button>
        </div>
      );
    }

    return (
      <div className="min-w-80 space-y-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          Landlord-approved signature marker: <span className="font-semibold">Lee Robertson</span>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
          {docusignStatus?.ready ? 'DocuSign is configured. Use Send via DocuSign to email the tenant for signing.' : 'DocuSign setup missing: ' + ((docusignStatus?.missing || ['not checked']).join(', ')) + '. Manual fallback is still available.'}
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p className="font-semibold text-slate-900">DocuSign setup guide</p>
          <p className="mt-1">Manual signing still works while DocuSign is missing. Add the demo or live DocuSign values in TrueNAS only when you are ready to test automatic signing.</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2">
            {['DOCUSIGN_INTEGRATION_KEY', 'DOCUSIGN_USER_ID', 'DOCUSIGN_ACCOUNT_ID', 'DOCUSIGN_PRIVATE_KEY', 'DOCUSIGN_BASE_URL=https://demo.docusign.net', 'DOCUSIGN_OAUTH_BASE_URL=account-d.docusign.com'].map(item => (
              <code key={item} className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">{item}</code>
            ))}
          </div>
          {!docusignStatus?.ready && (
            <p className="mt-2 text-amber-700">Missing now: {(docusignStatus?.missing || ['not checked']).join(', ')}</p>
          )}
          <p className="mt-2 text-slate-500">Paste the private key into TrueNAS as one line using \n between certificate lines. Keep these keys out of GitHub.</p>
        </div>
        {agreements.map(agreement => (
          <div key={agreement.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium text-slate-800">v{agreement.agreement_version} - {agreement.agreement_title}</div>
                <div className="text-xs text-slate-500">
                  Tenant snapshot: {agreement.tenant_name_snapshot || tenant.name}
                </div>
                <div className="text-xs text-slate-500">
                  Property: {agreement.property_address_snapshot || tenant.property?.address || '-'}
                </div>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{agreement.status}</span>
            </div>
            {agreement.docusign_envelope_id && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                DocuSign envelope: {agreement.docusign_envelope_id}
              </div>
            )}
            {agreement.status === 'signed' && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
                Signed version: keep wording locked. Create a new version if terms change.
              </div>
            )}
            {agreement.status === 'signed' && !agreement.signed_document_url && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-800">
                Signed but no saved document link yet. Save the signed copy to Documents so the tenant can view it.
              </div>
            )}
            {agreement.status === 'sent' && !agreement.signed_document_url && (
              <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs text-blue-800">
                Sent for manual signing. Save the signed return copy as a document, then mark this agreement as signed.
              </div>
            )}
            {agreement.signed_document_url && (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-800">
                Saved in Documents. Tenants can view it from the Documents area.
              </div>
            )}
            <AgreementAuditTrail agreement={agreement} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setPreviewAgreement(agreement)}>Preview</Button>
              <Button variant="secondary" onClick={() => printAgreementText(agreement)}>Print</Button>
              <Button variant="secondary" onClick={() => downloadAgreementText(agreement)}>Download</Button>
              <Button variant="secondary" onClick={() => void copyAgreement(agreement)}>Copy text</Button>
              <Button variant="primary" disabled={savingAgreementId === agreement.id || agreement.status === 'signed'} onClick={() => void prepareSendForSigning(agreement)}>
                {agreement.docusign_envelope_id ? 'Sent via DocuSign' : agreement.status === 'sent' ? 'Sent manually' : 'Send via DocuSign'}
              </Button>
              {agreement.docusign_envelope_id && agreement.status !== 'signed' && (
                <Button variant="secondary" disabled={savingAgreementId === agreement.id} onClick={() => void checkDocuSignSignedCopy(agreement)}>
                  {savingAgreementId === agreement.id ? 'Checking...' : 'Check signed DocuSign copy'}
                </Button>
              )}
              <Button variant="secondary" disabled={savingAgreementId === agreement.id} onClick={() => void saveAgreementAsDocument(agreement)}>
                {savingAgreementId === agreement.id ? 'Saving doc...' : agreement.signed_document_url ? 'Saved to Docs' : 'Save as document'}
              </Button>
              <Button variant="secondary" disabled={agreement.status === 'signed'} onClick={() => startEditAgreementBody(agreement)}>
                {agreement.status === 'signed' ? 'Signed locked' : 'Edit wording'}
              </Button>
              {agreementStatuses.map(status => (
                <Button
                  key={status}
                  variant={agreement.status === status ? 'primary' : 'secondary'}
                  disabled={savingAgreementId === agreement.id || agreement.status === status}
                  onClick={() => updateAgreementStatus(agreement.id, status)}
                >
                  {status}
                </Button>
              ))}
              <Button variant="secondary" disabled={savingAgreementId === tenant.id} onClick={() => createAgreement(tenant)}>
                New version
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function tenantPortalAccounts(tenant: Tenant) {
    return portalAccounts.filter(account => account.role === 'tenant' && account.tenant_id === tenant.id);
  }

  async function copyTenantPortalSetup(tenant: Tenant) {
    const linkedAccounts = tenantPortalAccounts(tenant);
    const linkedAccount = linkedAccounts[0];
    const details = [
      'PropManagerr tenant portal setup',
      'URL: ' + window.location.origin,
      'Tenant: ' + tenant.name,
      'Tenant email: ' + (tenant.email || 'Missing - add tenant email first'),
      'Login email: ' + (linkedAccount?.email || tenant.email || 'Create a linked tenant account first'),
      linkedAccount ? 'Portal login: linked to tenant account' : 'Portal login: not linked yet - create one in Admin > Admin Accounts',
      'Password: set or reset this in Admin > Admin Accounts before sending to tenant.',
    ].join('\n');

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(details);
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = details;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    window.alert('Tenant portal setup details copied.');
  }

  async function createTenantPortalLogin(tenant: Tenant) {
    if (!tenant.email) {
      window.alert('Add the tenant email before creating a portal login.');
      return;
    }

    setCreatingPortalTenantId(tenant.id);
    try {
      const result = await api.createTenantPortalAccount(tenant.id);
      await loadPortalAccounts();

      const setup = [
        'PropManagerr tenant portal login',
        'URL: ' + window.location.origin,
        'Tenant: ' + tenant.name,
        'Login email: ' + result.account.email,
        result.temporary_password ? 'Temporary password: ' + result.temporary_password : 'Password: account already existed - reset in Admin > Admin Accounts if needed.',
      ].join('\n');

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(setup);
      }

      window.alert(result.existing ? 'Portal login already exists. Setup details copied where possible.' : 'Portal login created. Temporary login details copied.');
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not create tenant portal login');
    } finally {
      setCreatingPortalTenantId(null);
    }
  }

  function tenantPortalPanel(tenant: Tenant) {
    const linkedAccounts = tenantPortalAccounts(tenant);
    const activeAccount = linkedAccounts.find(account => account.active) || null;
    const inactiveAccount = linkedAccounts.find(account => !account.active) || null;

    return (
      <div className="min-w-56 space-y-2 text-xs">
        {activeAccount ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">
            <p className="font-semibold">Portal login linked</p>
            <p>{activeAccount.email}</p>
          </div>
        ) : inactiveAccount ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-800">
            <p className="font-semibold">Portal login inactive</p>
            <p>{inactiveAccount.email}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700">
            <p className="font-semibold">No portal login linked</p>
            <p>Create one in Admin &gt; Admin Accounts.</p>
          </div>
        )}
        {!tenant.email && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700">Tenant email missing.</div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPreviewTenant(tenant)}>View portal</Button>
          {!activeAccount && !inactiveAccount && (
            <Button variant="primary" disabled={creatingPortalTenantId === tenant.id || !tenant.email} onClick={() => void createTenantPortalLogin(tenant)}>
              {!tenant.email ? 'Email needed' : creatingPortalTenantId === tenant.id ? 'Creating...' : 'Create login'}
            </Button>
          )}
          <Button variant="secondary" onClick={() => void copyTenantPortalSetup(tenant)}>Copy setup</Button>
        </div>
      </div>
    );
  }

  const tenantPreviewUser = previewTenant ? ({
    id: 'tenant-preview-' + previewTenant.id,
    name: previewTenant.name || 'Tenant preview',
    email: previewTenant.email || '',
    role: 'tenant',
    tenant_id: previewTenant.id,
  } as any) : null;

  const tenantOptions = data.tenants.filter(tenant => {
    const tenantPropertyId = tenant.property_id || tenant.property?.id || '';
    return !tenantPropertyFilter || tenantPropertyId === tenantPropertyFilter;
  });
  const selectedTenant = selectedTenantId ? data.tenants.find(tenant => tenant.id === selectedTenantId) || null : null;
  const filteredTenants = tenantOptions;
  const selectedTenantProperty = tenantPropertyFilter ? data.properties.find(property => property.id === tenantPropertyFilter) || null : null;
  const selectedTenantAgreements = selectedTenant ? agreementsByTenant[selectedTenant.id] || [] : [];
  const selectedTenantRent = selectedTenant ? data.rentPayments.filter(payment => payment.tenant_id === selectedTenant.id) : [];
  const selectedTenantDocuments = selectedTenant ? data.documents.filter(document => document.tenant_id === selectedTenant.id || Boolean(selectedTenant.property_id && document.property_id === selectedTenant.property_id)) : [];
  const selectedTenantRepairs = selectedTenant ? data.maintenanceTickets.filter(ticket => ticket.tenant_id === selectedTenant.id || Boolean(selectedTenant.property_id && ticket.property_id === selectedTenant.property_id)) : [];
  const selectedTenantPortalAccounts = selectedTenant ? tenantPortalAccounts(selectedTenant) : [];
  const selectedTenantHasActivePortal = selectedTenantPortalAccounts.some(account => account.active);

  return (
    <CrudLayout title={editing ? 'Edit tenant' : 'Add tenant'} onSubmit={submit} onCancel={reset} editing={Boolean(editing)}>
      <Select<string> label="Property" value={fieldValue(form.property_id)} onChange={value => setForm({ ...form, property_id: value || null })}>
        <option value="">Unassigned</option>
        {data.properties.map(property => <option key={property.id} value={property.id}>{property.address}</option>)}
      </Select>
      <Input label="Name" value={fieldValue(form.name)} onChange={value => setForm({ ...form, name: value })} required />
      <Input label="Email" value={fieldValue(form.email)} onChange={value => setForm({ ...form, email: value })} type="email" />
      <Input label="Mobile number" value={fieldValue(form.phone)} onChange={value => setForm({ ...form, phone: value })} />
      <Input label="Lease start" value={fieldValue(form.lease_start)} onChange={value => setForm({ ...form, lease_start: value || null })} type="date" />
      <Input label="Lease end" value={fieldValue(form.lease_end)} onChange={value => setForm({ ...form, lease_end: value || null })} type="date" />
      <Select<PaymentStatus> label="Payment status" value={(form.payment_status as PaymentStatus) || 'pending'} onChange={value => setForm({ ...form, payment_status: value || 'pending' })}>
        <option value="pending">Pending</option>
        <option value="paid">Paid</option>
        <option value="overdue">Overdue</option>
      </Select>

      {editing && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 md:col-span-3">
          <p className="font-semibold text-rose-900">Danger zone</p>
          <p className="mt-1">Delete this tenant from inside the edit panel only.</p>
          <Button type="button" variant="danger" onClick={() => void remove(editing)}>Delete tenant</Button>
        </div>
      )}

      {previewAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Agreement preview</h3>
                <p className="text-sm text-slate-500">Version {previewAgreement.agreement_version} - {previewAgreement.status}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => printAgreementText(previewAgreement)}>Print</Button>
                <Button variant="secondary" onClick={() => downloadAgreementText(previewAgreement)}>Download</Button>
                <Button variant="secondary" onClick={() => void copyAgreement(previewAgreement)}>Copy text</Button>
                <Button variant="primary" disabled={savingAgreementId === previewAgreement.id || previewAgreement.status === 'signed'} onClick={() => void prepareSendForSigning(previewAgreement)}>
                  {previewAgreement.docusign_envelope_id ? 'Sent via DocuSign' : previewAgreement.status === 'sent' ? 'Sent manually' : 'Send via DocuSign'}
                </Button>
                {previewAgreement.docusign_envelope_id && previewAgreement.status !== 'signed' && (
                  <Button variant="secondary" disabled={savingAgreementId === previewAgreement.id} onClick={() => void checkDocuSignSignedCopy(previewAgreement)}>
                    {savingAgreementId === previewAgreement.id ? 'Checking...' : 'Check signed DocuSign copy'}
                  </Button>
                )}
                <Button variant="secondary" disabled={savingAgreementId === previewAgreement.id} onClick={() => void saveAgreementAsDocument(previewAgreement)}>
                  {savingAgreementId === previewAgreement.id ? 'Saving doc...' : previewAgreement.signed_document_url ? 'Saved to Docs' : 'Save as document'}
                </Button>
                <Button variant="secondary" onClick={() => setPreviewAgreement(null)}>Close</Button>
              </div>
            </div>

            <div className="mb-4 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2">
              <div><span className="font-medium text-slate-700">Tenant:</span> {previewAgreement.tenant_name_snapshot || '-'}</div>
              <div><span className="font-medium text-slate-700">Landlord:</span> {previewAgreement.landlord_name || 'Lee Robertson'}</div>
              <div><span className="font-medium text-slate-700">Property:</span> {previewAgreement.property_address_snapshot || '-'}</div>
              <div><span className="font-medium text-slate-700">Status:</span> {previewAgreement.status}</div>
              <div><span className="font-medium text-slate-700">DocuSign envelope:</span> {previewAgreement.docusign_envelope_id || 'Not sent yet'}</div>
            </div>

            {previewAgreement.status === 'signed' && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Signed agreement: keep this version as the record. Create a new version for any changed terms.
              </div>
            )}
            {previewAgreement.status !== 'signed' && (
              <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                {docusignStatus?.ready ? 'DocuSign is configured. Click Send via DocuSign to email this agreement to the tenant.' : 'DocuSign setup is missing: ' + ((docusignStatus?.missing || ['not checked']).join(', ')) + '. You can still use Download, Print or Copy text for manual signing.'}
              </div>
            )}

            {previewAgreement.signed_document_url && (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                This agreement has been saved to Documents.
              </div>
            )}

            <AgreementAuditTrail agreement={previewAgreement} />

            <pre className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800 shadow-inner">
              {agreementText(previewAgreement)}
            </pre>
          </div>
        </div>
      )}

      {previewTenant && tenantPreviewUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[85vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-slate-50 p-5 shadow-xl">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Tenant portal preview</h3>
                <p className="text-sm text-slate-500">Previewing what {previewTenant.name} can see. This does not log in as the tenant or change data.</p>
              </div>
              <Button variant="secondary" onClick={() => setPreviewTenant(null)}>Close preview</Button>
            </div>
            <TenantPortal data={data} user={tenantPreviewUser} refresh={refresh} />
          </div>
        </div>
      )}

      {editingAgreement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Edit agreement wording</h3>
                <p className="text-sm text-slate-500">Signed agreements should stay locked. Create a new version for changed terms.</p>
              </div>
              <Button variant="secondary" onClick={() => setEditingAgreement(null)}>Close</Button>
            </div>
            <textarea
              className="min-h-96 w-full rounded-lg border border-slate-300 p-3 text-sm leading-6 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={agreementBodyDraft}
              onChange={event => setAgreementBodyDraft(event.target.value)}
            />
            <div className="mt-4 flex gap-2">
              <Button onClick={saveAgreementBody} disabled={savingAgreementId === editingAgreement.id}>
                {savingAgreementId === editingAgreement.id ? 'Saving...' : 'Save wording'}
              </Button>
              <Button variant="secondary" onClick={() => setEditingAgreement(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      <Card title="Tenant list">
        <div className="grid gap-4 md:grid-cols-3">
          <Select<string> label="Show property" value={tenantPropertyFilter} onChange={value => { setTenantPropertyFilter(value || ''); setSelectedTenantId(''); setShowTenantSetupTools(false); setLegacyAgreementFile(null); }}>
            <option value="">All properties</option>
            {data.properties.map(property => <option key={property.id} value={property.id}>{property.address}</option>)}
          </Select>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:col-span-2">
            <p className="font-medium text-slate-900">{tenantPropertyFilter ? selectedTenantProperty?.address || 'Selected property' : 'All properties'}</p>
            <p>{filteredTenants.length} of {data.tenants.length} tenants shown.</p>
            <p className="text-xs text-slate-500">Click Open tenant to view that tenant's full record, tenancy tools, legacy upload, digital agreement and portal setup.</p>
          </div>
        </div>
      </Card>

      {!selectedTenant && (
        <Table
          columns={['Name', 'Email', 'Property', 'Lease end', 'Status', 'Open', 'Actions']}
          rows={filteredTenants.map(tenant => [
            tenant.name,
            tenant.email,
            <div className="min-w-48 text-sm"><p className="font-medium text-slate-800">{tenant.property?.address || 'Unassigned'}</p><p className="text-xs text-slate-500">Connected property</p></div>,
            dateOnly(tenant.lease_end) || '-',
            tenant.payment_status,
            <Button variant="primary" onClick={() => { setSelectedTenantId(tenant.id); setShowTenantSetupTools(true); setLegacyAgreementFile(null); }}>Open tenant</Button>,
            <Actions onEdit={() => startEdit(tenant)} onDelete={() => remove(tenant)} />,
          ])}
        />
      )}

      {selectedTenant && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Tenant record</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-900">{selectedTenant.name}</h2>
                <p className="mt-1 text-sm text-slate-600">{selectedTenant.property?.address || 'No property assigned'} - {selectedTenant.email || 'No email saved'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => { setSelectedTenantId(''); setShowTenantSetupTools(false); setLegacyAgreementFile(null); }}>Back to tenant list</Button>
                <Button variant="secondary" onClick={() => startEdit(selectedTenant)}>Edit tenant</Button>
                <Button variant="primary" onClick={() => setPreviewTenant(selectedTenant)}>View tenant portal</Button>
              </div>
            </div>
          </div>

          <Card title="Tenant summary">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Tenant</p>
                <p className="font-semibold text-slate-900">{selectedTenant.name}</p>
                <p className="text-slate-600">{selectedTenant.email || 'No email saved'}</p>
                <p className="text-slate-600">{selectedTenant.phone || 'No mobile number saved'}</p>
                <p className="mt-1 text-xs text-slate-500">Mobile number ready for alerts/SMS later. Free browser push will use device permission instead.</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Connected property</p>
                <p className="font-semibold text-slate-900">{selectedTenant.property?.address || 'Unassigned'}</p>
                <p className="text-slate-600">Lease: {dateOnly(selectedTenant.lease_start) || '-'} to {dateOnly(selectedTenant.lease_end) || '-'}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Records</p>
                <p className="text-slate-700">Agreements: {selectedTenantAgreements.length}</p>
                <p className="text-slate-700">Rent: {selectedTenantRent.length}</p>
                <p className="text-slate-700">Docs: {selectedTenantDocuments.length} - Requests: {selectedTenantRepairs.length}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="text-xs uppercase tracking-wide text-slate-500">Portal</p>
                <p className={selectedTenantHasActivePortal ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>{selectedTenantHasActivePortal ? 'Login active' : 'Login not active'}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => void copyTenantPortalSetup(selectedTenant)}>Copy setup</Button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Tenancy options">
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              These tools are now inside the single tenant record. Use legacy upload for an existing paper agreement, or digital agreement when you are ready to create/send a new agreement.
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-slate-900">Legacy agreement upload</p>
                <p className="mt-1 text-slate-600">Upload a scan, photo, PDF or document for an agreement that already exists outside the system.</p>
                <input
                  className="mt-3 block w-full text-sm text-slate-700"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt"
                  onChange={event => setLegacyAgreementFile(event.target.files?.[0] || null)}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button variant="primary" disabled={!legacyAgreementFile || legacyAgreementSaving} onClick={() => void saveLegacyAgreement(selectedTenant)}>
                    {legacyAgreementSaving ? 'Saving...' : 'Save legacy agreement'}
                  </Button>
                  {legacyAgreementFile && <span className="text-xs text-slate-500">{legacyAgreementFile.name}</span>}
                </div>
                {agreementNotice && <div className="mt-3 text-xs text-emerald-700">{agreementNotice}</div>}
                {agreementError && <div className="mt-3 text-xs text-rose-600">{agreementError}</div>}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-slate-900">Digital agreement</p>
                <p className="mt-1 text-slate-600">Create, preview, print, download or send a digital agreement for this tenant.</p>
                <div className="mt-3">
                  {agreementLoading ? <div className="text-xs text-slate-500">Loading agreements...</div> : agreementPanel(selectedTenant)}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-slate-900">Tenant portal</p>
                <p className="mt-1 text-slate-600">Create or check portal login access for this tenant.</p>
                <div className="mt-3">{tenantPortalPanel(selectedTenant)}</div>
              </div>
            </div>
          </Card>
        </div>
      )}
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

  async function remove(payment: RentPayment) {
    const label = (payment.tenant?.name || 'tenant') + ' rent payment due ' + (dateOnly(payment.due_date) || 'unknown date');
    const confirmed = window.confirm('Are you sure you want to delete ' + label + '? This cannot currently be undone.');
    if (!confirmed) return;
    await api.deleteRentPayment(payment.id);
    await refresh();
    await offerUndoDelete(label, 'rent_payments', payment.id, refresh);
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
              <Button type="button" variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="button" variant="danger" onClick={() => void remove(editing)}>Delete payment</Button>
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
          user.role === 'admin' ? <Actions onEdit={() => startEdit(payment)} onDelete={() => remove(payment)} /> : '-',
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

  async function deleteTicket(ticket: MaintenanceTicket) {
    const confirmed = window.confirm('Are you sure you want to delete repair ticket "' + ticket.title + '"? This cannot currently be undone.');
    if (!confirmed) return;
    await api.deleteMaintenanceTicket(ticket.id);
    await refresh();
    await offerUndoDelete('repair ticket "' + ticket.title + '"', 'maintenance_tickets', ticket.id, refresh);
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
              <Button type="button" variant="secondary" onClick={resetEdit}>Cancel</Button>
              <Button type="button" variant="danger" onClick={() => void deleteTicket(editing)}>Delete repair</Button>
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
            <Actions onEdit={() => startEdit(ticket)} onDelete={() => deleteTicket(ticket)} />,
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

  function setDocumentType(value: DocType | '') {
    const nextType = value || 'other';

    if (nextType === 'tenancy_agreement' && documentAudience !== 'tenant') {
      setDocumentAudience('tenant');
      setForm({
        ...form,
        doc_type: nextType,
        tenant_id: form.tenant_id || '',
        property_id: tenantPropertyId(form.tenant_id || '') || form.property_id || '',
      });
      return;
    }

    setForm({ ...form, doc_type: nextType });
  }

  function tenantOptionLabel(tenant: Tenant) {
    const propertyName = tenant.property?.address || propertyAddress(tenant.property_id || tenant.property?.id);
    return tenant.name + (propertyName && propertyName !== 'All properties' ? ' - ' + propertyName : '');
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

  async function remove(document: DocumentRecord) {
    const confirmed = window.confirm('Are you sure you want to delete document "' + document.name + '"? Tenants will no longer see it. This cannot currently be undone.');
    if (!confirmed) return;

    setDocumentError('');
    setDeletingDocumentId(document.id);

    try {
      await api.deleteDocument(document.id);
      if (editing?.id === document.id) reset();
      await refresh();
      await offerUndoDelete('document "' + document.name + '"', 'documents', document.id, refresh);
    } catch (err) {
      setDocumentError(err instanceof Error ? err.message : 'Could not delete document');
    } finally {
      setDeletingDocumentId(null);
    }
  }
  function documentTypeLabel(document: DocumentRecord) {
    if (document.doc_type === 'tenancy_agreement') return 'Signed tenancy agreement';
    return String(document.doc_type || 'other').replace(/_/g, ' ');
  }

  function documentGroup(document: DocumentRecord) {
    if (document.doc_type === 'tenancy_agreement') return 'tenancy';
    if (document.tenant_id) return 'tenant';
    if (document.property_id || document.property?.id) return 'property';
    return 'general';
  }

  function expiryTone(document: DocumentRecord) {
    const days = daysUntil(document.expiry_date);
    if (days === null) return { label: 'No expiry', className: 'border-slate-200 bg-slate-50 text-slate-600' };
    if (days < 0) return { label: 'Expired ' + Math.abs(days) + 'd ago', className: 'border-rose-200 bg-rose-50 text-rose-700' };
    if (days <= 30) return { label: 'Expires in ' + days + 'd', className: 'border-amber-200 bg-amber-50 text-amber-800' };
    return { label: 'Expires ' + dateOnly(document.expiry_date), className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }

  function sortedDocuments(rows: DocumentRecord[]) {
    return [...rows].sort((a, b) => {
      const aExpiry = a.expiry_date ? new Date(a.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
      const bExpiry = b.expiry_date ? new Date(b.expiry_date).getTime() : Number.MAX_SAFE_INTEGER;
      return aExpiry - bExpiry || String(a.name).localeCompare(String(b.name));
    });
  }

  const documentGroups = {
    tenancy: sortedDocuments(visibleDocuments.filter(document => documentGroup(document) === 'tenancy')),
    tenant: sortedDocuments(visibleDocuments.filter(document => documentGroup(document) === 'tenant')),
    property: sortedDocuments(visibleDocuments.filter(document => documentGroup(document) === 'property')),
    general: sortedDocuments(visibleDocuments.filter(document => documentGroup(document) === 'general')),
  };

  const expiringSoonCount = visibleDocuments.filter(document => {
    const days = daysUntil(document.expiry_date);
    return days !== null && days >= 0 && days <= 60;
  }).length;

  const expiredCount = visibleDocuments.filter(document => {
    const days = daysUntil(document.expiry_date);
    return days !== null && days < 0;
  }).length;

  function DocumentCard({ document }: { document: DocumentRecord }) {
    const group = documentGroup(document);
    const expiry = expiryTone(document);
    const propertyLabel = document.property?.address || propertyAddress(document.property_id);
    const tenantLabel = document.tenant?.name || tenantName(document.tenant_id);
    const isTenantDocument = group === 'tenant' || group === 'tenancy';
    const isPropertyDocument = group === 'property';

    const accent =
      group === 'tenancy'
        ? 'border-emerald-200 bg-emerald-50/60'
        : group === 'tenant'
          ? 'border-violet-200 bg-violet-50/60'
          : group === 'property'
            ? 'border-sky-200 bg-sky-50/60'
            : 'border-slate-200 bg-white';

    const badge =
      group === 'tenancy'
        ? 'bg-emerald-100 text-emerald-800'
        : group === 'tenant'
          ? 'bg-violet-100 text-violet-800'
          : group === 'property'
            ? 'bg-sky-100 text-sky-800'
            : 'bg-slate-100 text-slate-700';

    return (
      <div className={'rounded-xl border p-4 shadow-sm ' + accent}>
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={'rounded-full px-2.5 py-1 text-xs font-semibold capitalize ' + badge}>{documentTypeLabel(document)}</span>
              <span className={'rounded-full border px-2.5 py-1 text-xs font-medium ' + expiry.className}>{expiry.label}</span>
            </div>
            <h3 className="text-base font-semibold text-slate-950">{document.name}</h3>
            <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Property file</p>
                <p className="font-medium text-slate-900">{propertyLabel}</p>
                <p className="text-xs text-slate-500">{isPropertyDocument ? 'Permanent property record' : isTenantDocument ? 'Linked at upload/current tenant property' : 'General document'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tenant scope</p>
                <p className="font-medium text-slate-900">{tenantLabel}</p>
                <p className="text-xs text-slate-500">{isTenantDocument ? 'Person/tenancy-specific' : 'Visible to all relevant tenants'}</p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {document.file_url ? (
              <a className="inline-flex min-h-10 items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100" href={api.documentFileUrl(document.file_url)} target="_blank" rel="noreferrer">
                {document.doc_type === 'tenancy_agreement' ? 'Open signed agreement' : 'View file'}
              </a>
            ) : (
              <span className="inline-flex min-h-10 items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">No file uploaded</span>
            )}
            {user.role === 'admin' && <Button variant="secondary" onClick={() => startEdit(document)}>Edit</Button>}
          </div>
        </div>
      </div>
    );
  }

  function DocumentSection({ title, helper, rows }: { title: string; helper: string; rows: DocumentRecord[] }) {
    if (rows.length === 0) return null;
    return (
      <Card title={title + ' (' + rows.length + ')'}>
        <p className="mb-4 text-sm text-slate-600">{helper}</p>
        <div className="space-y-3">
          {rows.map(document => <DocumentCard key={document.id} document={document} />)}
        </div>
      </Card>
    );
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
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 md:col-span-3">
            <p className="font-semibold text-blue-950">Attach this document to the right place</p>
            <p className="mt-1">Use Property for permanent house records like EPC, gas safety and EICR. Use Tenant for person or tenancy records like agreements, ID/right-to-rent and deposit paperwork. Tenants can change, but the property file stays stable.</p>
          </div>

          <Select<'all' | 'property' | 'tenant'> label="Attach document to" value={documentAudience} onChange={setAudience}>
            <option value="all">General - visible to all tenants</option>
            <option value="property">Property - permanent property record</option>
            <option value="tenant">Tenant - person/tenancy record</option>
          </Select>

          {documentAudience === 'tenant' && (
            <Select<string> label={form.doc_type === 'tenancy_agreement' ? 'Tenant for tenancy agreement' : 'Tenant'} value={fieldValue(form.tenant_id)} onChange={setDocumentTenant}>
              <option value="">Choose tenant</option>
              {data.tenants.map(tenant => <option key={tenant.id} value={tenant.id}>{tenantOptionLabel(tenant)}</option>)}
            </Select>
          )}

          {documentAudience === 'property' && (
            <Select<string> label="Property" value={fieldValue(form.property_id)} onChange={setDocumentProperty}>
              <option value="">Choose property</option>
              {data.properties.map(property => {
                const tenantCount = data.tenants.filter(tenant => (tenant.property_id || tenant.property?.id) === property.id).length;
                return <option key={property.id} value={property.id}>{property.address}{tenantCount ? ' - ' + tenantCount + ' tenant' + (tenantCount === 1 ? '' : 's') : ''}</option>;
              })}
            </Select>
          )}

          {documentAudience === 'tenant' && form.property_id && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Linked property: <span className="font-medium text-emerald-950">{propertyAddress(form.property_id)}</span>
            </div>
          )}

          {form.doc_type === 'tenancy_agreement' && documentAudience === 'tenant' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Tenancy agreements are tenant-linked. Choose the tenant above and the property link is filled automatically.
            </div>
          )}

          {documentAudience === 'all' && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              This document will be visible to every tenant. It will not be tied to one property or one tenant.
            </div>
          )}

          <Input label="Name" value={fieldValue(form.name)} onChange={value => setForm({ ...form, name: value })} required />
          <Select<DocType> label="Document type" value={(form.doc_type as DocType) || 'other'} onChange={setDocumentType}>
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
        {editing && (

          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 md:col-span-3">

            <p className="font-semibold text-rose-900">Danger zone</p>

            <p className="mt-1">Delete this document from inside the edit panel only.</p>

            <Button type="button" variant="danger" disabled={deletingDocumentId === editing.id} onClick={() => void remove(editing)}>

              {deletingDocumentId === editing.id ? 'Deleting...' : 'Delete document'}

            </Button>

          </div>

        )}

        </CrudLayout>
      )}

      <div className="grid gap-4 md:grid-cols-4" aria-label="Document library summary">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total documents</p>
          <p className="mt-2 text-2xl font-bold text-slate-950">{visibleDocuments.length}</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Property records</p>
          <p className="mt-2 text-2xl font-bold text-sky-950">{documentGroups.property.length}</p>
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Tenant records</p>
          <p className="mt-2 text-2xl font-bold text-violet-950">{documentGroups.tenant.length + documentGroups.tenancy.length}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Needs attention</p>
          <p className="mt-2 text-2xl font-bold text-amber-950">{expiredCount + expiringSoonCount}</p>
          <p className="text-xs text-amber-700">{expiredCount} expired · {expiringSoonCount} expiring soon</p>
        </div>
      </div>

      {visibleDocuments.length === 0 ? (
        <Card title="Document library">
          <p className="text-sm text-slate-600">No documents found.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          <DocumentSection title="Tenancy agreements" helper="Signed agreements and tenancy paperwork linked to a specific tenant." rows={documentGroups.tenancy} />
          <DocumentSection title="Tenant documents" helper="Person or tenancy-specific files. These are useful when tenants change or move." rows={documentGroups.tenant} />
          <DocumentSection title="Property documents" helper="Permanent property file: EPC, gas safety, EICR and house-level compliance documents." rows={documentGroups.property} />
          <DocumentSection title="General documents" helper="Shared guidance, policies and files visible to all relevant tenants." rows={documentGroups.general} />
        </div>
      )}
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

  async function remove(expense: Expense) {
    const label = expense.description || expense.category || 'expense record';
    if (!window.confirm('Are you sure you want to delete expense "' + label + '"? This cannot currently be undone.')) return;
    setFormError('');
    try {
      await api.deleteExpense(expense.id);
      await refresh();
      await offerUndoDelete('expense "' + label + '"', 'expenses', expense.id, refresh);
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
            {editing && <Button type="button" variant="secondary" onClick={reset}>Cancel</Button>}
            {editing && <Button type="button" variant="danger" onClick={() => void remove(editing)}>Delete expense</Button>}
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
          <Actions onEdit={() => startEdit(expense)} onDelete={() => remove(expense)} />,
        ])}
      />
    </div>
  );
}

function LicenceManagement() {
  const [licences, setLicences] = useState<LicenceKey[]>([]);
  const [form, setForm] = useState<LicencePayload>({ customer_email: '', customer_name: '', max_activations: 1, expires_at: '', notes: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  async function loadLicences() {
    const rows = await api.listLicences();
    setLicences(rows);
  }

  useEffect(() => {
    loadLicences().catch(err => setError(err instanceof Error ? err.message : 'Could not load licences'));
  }, []);

  async function createLicence(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError('');

    try {
      await api.createLicence({
        customer_email: form.customer_email || null,
        customer_name: form.customer_name || null,
        max_activations: Math.max(1, Number(form.max_activations || 1)),
        expires_at: form.expires_at || null,
        notes: form.notes || null,
      });
      setForm({ customer_email: '', customer_name: '', max_activations: 1, expires_at: '', notes: '' });
      await loadLicences();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create licence');
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(licence: LicenceKey, status: 'active' | 'revoked') {
    try {
      await api.updateLicence(licence.id, { status });
      await loadLicences();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not update licence');
    }
  }

  return (
    <div className="space-y-6">
      <Card title="Licence management">
        <form onSubmit={createLicence} className="grid gap-4 md:grid-cols-3">
          <Input label="Customer name" value={fieldValue(form.customer_name)} onChange={value => setForm({ ...form, customer_name: value })} />
          <Input label="Customer email" type="email" value={fieldValue(form.customer_email)} onChange={value => setForm({ ...form, customer_email: value })} />
          <Input label="Max activations" type="number" value={String(form.max_activations || 1)} onChange={value => setForm({ ...form, max_activations: Number(value || 1) })} />
          <Input label="Expires at (optional)" type="date" value={fieldValue(form.expires_at)} onChange={value => setForm({ ...form, expires_at: value || null })} />
          <Input label="Notes" value={fieldValue(form.notes)} onChange={value => setForm({ ...form, notes: value })} />
          <div className="flex items-end">
            <Button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create licence'}</Button>
          </div>
        </form>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      </Card>

      <Table
        columns={['Licence key', 'Customer', 'Status', 'Activations', 'Expires', 'Actions']}
        rows={licences.map(licence => [
          <code className="rounded bg-slate-100 px-2 py-1 text-xs">{licence.license_key}</code>,
          <div>
            <div>{licence.customer_name || '-'}</div>
            <div className="text-xs text-slate-500">{licence.customer_email || '-'}</div>
          </div>,
          licence.status,
          `${licence.active_activations ?? 0} / ${licence.max_activations}`,
          licence.expires_at ? dateOnly(licence.expires_at) : '-',
          <div className="flex gap-2">
            {licence.status === 'active' ? (
              <Button variant="secondary" onClick={() => setStatus(licence, 'revoked')}>Revoke</Button>
            ) : (
              <Button variant="secondary" onClick={() => setStatus(licence, 'active')}>Reactivate</Button>
            )}
          </div>,
        ])}
      />
    </div>
  );
}


function AdminSafetyChecks() {
  const [checkingHealth, setCheckingHealth] = useState(false);
  const webBuildVersion = 'v69';
  const [healthStatus, setHealthStatus] = useState<'not_checked' | 'ok' | 'error'>('not_checked');
  const [healthMessage, setHealthMessage] = useState('Not checked in this browser session.');
  const [apiBuildVersion, setApiBuildVersion] = useState('not checked');

  async function checkHealth() {
    setCheckingHealth(true);
    setHealthStatus('not_checked');
    setHealthMessage('Checking API health...');
    setApiBuildVersion('checking');
    try {
      const result = await api.health();
      if (result?.ok) {
        setHealthStatus('ok');
        setApiBuildVersion(result.version || 'unknown');
        setHealthMessage('API health check passed' + (result.version ? ' - ' + result.version : '') + '.');
      } else {
        setHealthStatus('error');
        setApiBuildVersion('unavailable');
        setHealthMessage('API replied, but did not return ok=true.');
      }
    } catch (err) {
      setHealthStatus('error');
      setApiBuildVersion('unavailable');
      setHealthMessage(err instanceof Error ? err.message : 'API health check failed.');
    } finally {
      setCheckingHealth(false);
    }
  }

  useEffect(() => {
    void checkHealth();
  }, []);

  const checks = [
    {
      label: 'Current deployed tags',
      value: 'Web ' + webBuildVersion + ' / API ' + apiBuildVersion,
      tone: 'info',
    },
    {
      label: 'Backup reminder',
      value: 'Use Backup / Export tools before big edits, imports or public launch work.',
      tone: 'ok',
    },
    {
      label: 'Default admin password',
      value: 'Change admin@propmanager.local / ChangeMe123! before sharing or public use.',
      tone: 'warn',
    },
    {
      label: 'JWT secret',
      value: 'Use a long unique JWT_SECRET in TrueNAS before exposing the app outside your network.',
      tone: 'warn',
    },
    {
      label: 'Restore/import safety',
      value: 'Exports are enabled. Restore/import is intentionally not enabled yet.',
      tone: 'ok',
    },
  ];

  function toneClasses(tone: string) {
    if (tone === 'ok') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    if (tone === 'warn') return 'border-amber-200 bg-amber-50 text-amber-800';
    return 'border-blue-200 bg-blue-50 text-blue-800';
  }

  return (
    <Card title="Admin safety checks">
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 md:flex-row md:items-center">
          <div>
            <p className="font-semibold text-slate-900">API health</p>
            <p className={healthStatus === 'ok' ? 'text-emerald-700' : healthStatus === 'error' ? 'text-rose-700' : 'text-slate-600'}>{healthMessage}</p>
          </div>
          <Button variant="secondary" disabled={checkingHealth} onClick={() => void checkHealth()}>
            {checkingHealth ? 'Checking...' : 'Check API health'}
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {checks.map(check => (
            <div key={check.label} className={'rounded-lg border p-3 text-sm ' + toneClasses(check.tone)}>
              <p className="font-semibold">{check.label}</p>
              <p className="mt-1">{check.value}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">These checks are reminders only. They do not change settings or expose secrets.</p>
      </div>
    </Card>
  );
}

function BackupExportTools() {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function downloadFile(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function csvValue(value: unknown) {
    if (value === null || value === undefined) return '';
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return '"' + text.replace(/"/g, '""') + '"';
  }

  function rowsToCsv(rows: any[]) {
    if (!rows.length) return '';
    const columns = Array.from(new Set(rows.flatMap(row => Object.keys(row || {}))));
    return [columns.join(','), ...rows.map(row => columns.map(column => csvValue(row?.[column])).join(','))].join('\n');
  }

  async function downloadJsonExport() {
    setExporting(true);
    setError('');
    setNotice('');
    try {
      const backup = await api.adminExport();
      const date = new Date().toISOString().slice(0, 10);
      downloadFile('propmanagerr-backup-' + date + '.json', JSON.stringify(backup, null, 2), 'application/json;charset=utf-8');
      setNotice('JSON backup exported. Store it somewhere safe.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export backup');
    } finally {
      setExporting(false);
    }
  }

  async function downloadCsvExport() {
    setExporting(true);
    setError('');
    setNotice('');
    try {
      const backup: any = await api.adminExport();
      const tables = backup.tables || {};
      const date = new Date().toISOString().slice(0, 10);
      const content = Object.entries(tables)
        .map(([name, rows]) => '# ' + name + '\n' + rowsToCsv(Array.isArray(rows) ? rows : []))
        .join('\n\n');
      downloadFile('propmanagerr-export-' + date + '.csv', content, 'text/csv;charset=utf-8');
      setNotice('CSV export downloaded. JSON is best for full backup; CSV is best for viewing.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export CSV');
    } finally {
      setExporting(false);
    }
  }

  return (
    <Card title="Backup / Export tools">
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          Export a read-only backup of properties, tenants, rent, repairs, documents, expenses and tenancy agreements before making bigger changes.
        </div>
        {error && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        {notice && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
        <div className="flex flex-wrap gap-2">
          <Button disabled={exporting} onClick={() => void downloadJsonExport()}>
            {exporting ? 'Exporting...' : 'Download JSON backup'}
          </Button>
          <Button variant="secondary" disabled={exporting} onClick={() => void downloadCsvExport()}>
            Download CSV view
          </Button>
        </div>
        <p className="text-xs text-slate-500">Restore/import is intentionally not enabled yet. This is export-only for safety.</p>
      </div>
    </Card>
  );
}

function TrashBin() {
  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [permanentlyDeletingId, setPermanentlyDeletingId] = useState<string | null>(null);

  async function loadTrash() {
    setLoading(true);
    setError('');
    try {
      const rows = await api.listTrash();
      setRecords(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load trash');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTrash();
  }, []);

  async function restore(record: DeletedRecord) {
    const confirmed = window.confirm('Restore "' + record.name + '" from ' + record.table + '?');
    if (!confirmed) return;

    setRestoringId(record.table + ':' + record.id);
    setError('');
    try {
      await api.restoreDeletedRecord(record.table, record.id);
      await loadTrash();
      window.alert('Restored "' + record.name + '". Refreshing dashboard data now.');
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore deleted record');
    } finally {
      setRestoringId(null);
    }
  }

  async function permanentlyDelete(record: DeletedRecord) {
    const typed = window.prompt('This will permanently delete "' + record.name + '" from ' + friendlyTable(record.table) + '.\n\nThis cannot be undone. Type DELETE to confirm.');
    if (typed !== 'DELETE') return;

    const key = record.table + ':' + record.id;
    setPermanentlyDeletingId(key);
    setError('');

    try {
      await api.permanentlyDeleteTrashRecord(record.table, record.id, typed);
      await loadTrash();
      window.alert('Permanently deleted "' + record.name + '".');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not permanently delete record');
    } finally {
      setPermanentlyDeletingId(null);
    }
  }

  function friendlyTable(table: string) {
    return table.replace(/_/g, ' ');
  }

  return (
    <Card title="Trash / Recently deleted">
      <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-slate-600">Restore deleted properties, tenants, rent payments, repairs, documents and expenses.</p>
          <p className="mt-1 text-xs text-slate-500">Use Restore to recover items. Use Permanently delete only when you are sure the record is no longer needed.</p>
        </div>
        <Button variant="secondary" disabled={loading} onClick={() => void loadTrash()}>
          {loading ? 'Refreshing...' : 'Refresh trash'}
        </Button>
      </div>

      {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {records.length === 0 ? (
        <p className="text-sm text-slate-600">Trash is empty.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Type</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Name</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Deleted</th>
                <th className="px-3 py-2 text-left font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {records.map(record => {
                const key = record.table + ':' + record.id;
                return (
                  <tr key={key}>
                    <td className="px-3 py-2 capitalize text-slate-600">{friendlyTable(record.table)}</td>
                    <td className="px-3 py-2 font-medium text-slate-900">{record.name || record.id}</td>
                    <td className="px-3 py-2 text-slate-600">{dateOnly(record.deleted_at)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" disabled={restoringId === key || permanentlyDeletingId === key} onClick={() =>
void restore(record)}>
                          {restoringId === key ? 'Restoring...' : 'Restore'}
                        </Button>
                        <Button variant="danger" disabled={restoringId === key || permanentlyDeletingId === key} onClick={() =>
void permanentlyDelete(record)}>
                          {permanentlyDeletingId === key ? 'Deleting forever...' : 'Permanently delete'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function LoginActivity() {
  const [rows, setRows] = useState<LoginAudit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setRows(await api.listLoginAudit());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load login activity');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function when(value: string) {
    if (!value) return '-';
    return new Date(value).toLocaleString();
  }

  return (
    <Card title="Login activity">
      <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-slate-600">Shows the latest 100 login attempts, including successful and failed logins.</p>
          <p className="mt-1 text-xs text-slate-500">Useful for checking whether tenants have signed in.</p>
        </div>
        <Button variant="secondary" disabled={loading} onClick={() => void load()}>
          {loading ? 'Refreshing...' : 'Refresh logins'}
        </Button>
      </div>

      {error && <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      <Table
        columns={['When', 'Email', 'Result', 'Role', 'Tenant', 'IP']}
        rows={rows.map(row => [
          when(row.created_at),
          row.email,
          row.success ? 'Success' : 'Failed' + (row.failure_reason ? ' - ' + row.failure_reason : ''),
          row.role || '-',
          row.tenant_name || row.tenant_id || '-',
          row.ip_address || '-',
        ])}
      />
    </Card>
  );
}

function NotificationCentre() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [notificationError, setNotificationError] = useState('');
  const [broadcast, setBroadcast] = useState<NotificationPayload>({
    audience: 'tenant',
    title: '',
    body: '',
    type: 'broadcast',
    link_page: 'dashboard',
  });
  const [readLogsByNotification, setReadLogsByNotification] = useState<Record<string, NotificationReadLog[]>>({});

  async function loadNotifications() {
    setLoadingNotifications(true);
    setNotificationError('');
    try {
      const rows = await api.listNotifications();
      setNotifications(rows);
    } catch (err) {
      setNotificationError(err instanceof Error ? err.message : 'Could not load notifications');
    } finally {
      setLoadingNotifications(false);
    }
  }

  useEffect(() => {
    void loadNotifications();
  }, []);

  const unreadCount = notifications.filter(notification => !notification.read_at).length;

  async function markRead(notification: NotificationRecord) {
    try {
      const updated = await api.markNotificationRead(notification.id);
      setNotifications(rows => rows.map(row => row.id === updated.id ? updated : row));
    } catch (err) {
      setNotificationError(err instanceof Error ? err.message : 'Could not mark notification read');
    }
  }

  async function markAllRead() {
    try {
      await api.markAllNotificationsRead();
      await loadNotifications();
    } catch (err) {
      setNotificationError(err instanceof Error ? err.message : 'Could not mark notifications read');
    }
  }

  async function toggleSavedNotification(notification: NotificationRecord) {
    try {
      const updated = await api.saveAdminNotification(notification.id, !notification.saved_at);
      setNotifications(rows => rows.map(row => row.id === updated.id ? { ...row, saved_at: updated.saved_at } : row));
    } catch (err) {
      setNotificationError(err instanceof Error ? err.message : 'Could not save notification');
    }
  }

  async function loadReadLogs(notification: NotificationRecord) {
    try {
      const rows = await api.listNotificationReadLogs(notification.id);
      setReadLogsByNotification(current => ({ ...current, [notification.id]: rows }));
    } catch (err) {
      setNotificationError(err instanceof Error ? err.message : 'Could not load read logs');
    }
  }

  async function sendBroadcast(event: FormEvent) {
    event.preventDefault();
    setNotificationError('');

    try {
      await api.createAdminNotification({
        ...broadcast,
        title: String(broadcast.title || '').trim(),
        body: String(broadcast.body || '').trim(),
      });
      setBroadcast({ audience: 'tenant', title: '', body: '', type: 'broadcast', link_page: 'dashboard' });
      await loadNotifications();
    } catch (err) {
      setNotificationError(err instanceof Error ? err.message : 'Could not send notification');
    }
  }

  return (
    <div className="space-y-6">
      {notificationError && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {notificationError}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Unread</p>
          <p className="mt-2 text-3xl font-bold text-emerald-950">{unreadCount}</p>
          <p className="text-sm text-emerald-800">Alerts needing attention</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Stored alerts</p>
          <p className="mt-2 text-3xl font-bold text-sky-950">{notifications.length}</p>
          <p className="text-sm text-sky-800">Latest 100 notification records</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Browser push</p>
          <p className="mt-2 text-lg font-bold text-amber-950">Next stage</p>
          <p className="text-sm text-amber-800">v91 can add free Web Push opt-in per device.</p>
        </div>
      </div>

      <Card title="Send tenant message">
        <form onSubmit={sendBroadcast} className="grid gap-4 md:grid-cols-3">
          <Select<'admin' | 'tenant' | 'all'> label="Send to" value={broadcast.audience || 'tenant'} onChange={value => setBroadcast({ ...broadcast, audience: value || 'tenant' })}>
            <option value="tenant">All tenants</option>
            <option value="admin">Admin only</option>
            <option value="all">Everyone</option>
          </Select>
          <Input label="Title" value={fieldValue(broadcast.title)} onChange={value => setBroadcast({ ...broadcast, title: value })} required />
          <Input label="Open page" value={fieldValue(broadcast.link_page)} onChange={value => setBroadcast({ ...broadcast, link_page: value || null })} />
          <label className="block text-sm font-medium text-slate-700 md:col-span-3">
            Message
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              value={broadcast.body || ''}
              onChange={event => setBroadcast({ ...broadcast, body: event.target.value })}
              required
            />
          </label>
          <div className="md:col-span-3">
            <Button type="submit">Send in-app notification</Button>
          </div>
        </form>
      </Card>

      <Card title="Saved admin messages">
        {notifications.filter(notification => notification.saved_at).length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No saved messages yet.</p>
        ) : (
          <div className="space-y-3">
            {notifications.filter(notification => notification.saved_at).map(notification => (
              <div key={notification.id} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="font-semibold text-amber-950">{notification.title}</p>
                <p className="mt-1 text-sm text-amber-800">{notification.body}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Notification inbox">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-slate-600">
            {loadingNotifications ? 'Loading notifications...' : unreadCount + ' unread notification' + (unreadCount === 1 ? '' : 's')}
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void loadNotifications()}>Refresh</Button>
            <Button variant="secondary" disabled={!unreadCount} onClick={() => void markAllRead()}>Mark all read</Button>
          </div>
        </div>

        {notifications.length === 0 ? (
          <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">No notifications yet.</p>
        ) : (
          <div className="space-y-3">
            {notifications.map(notification => (
              <div key={notification.id} className={'rounded-xl border p-4 ' + (notification.read_at ? 'border-slate-200 bg-white' : 'border-emerald-200 bg-emerald-50')}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="mb-2 flex flex-wrap gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{notification.type}</span>
                      <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{notification.audience}</span>
                      {!notification.read_at && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">Unread</span>}
                    </div>
                    <p className="font-semibold text-slate-950">{notification.title}</p>
                    <p className="mt-1 text-sm text-slate-700">{notification.body}</p>
                    <p className="mt-2 text-xs text-slate-500">{new Date(notification.created_at).toLocaleString()}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {notification.link_page && <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">Page: {notification.link_page}</span>}
                    <Button variant="secondary" onClick={() => void toggleSavedNotification(notification)}>{notification.saved_at ? 'Unsave' : 'Save'}</Button>
                    <Button variant="secondary" onClick={() => void loadReadLogs(notification)}>Read logs</Button>
                    {!notification.read_at && <Button variant="secondary" onClick={() => void markRead(notification)}>Mark read</Button>}
                  </div>
                </div>
                {readLogsByNotification[notification.id] && (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                    <p className="mb-2 font-semibold text-slate-800">Tenant read/delete log</p>
                    {readLogsByNotification[notification.id].length === 0 ? (
                      <p>No tenant has read this message yet.</p>
                    ) : (
                      <div className="space-y-1">
                        {readLogsByNotification[notification.id].map(log => (
                          <p key={log.id}>
                            {log.tenant_name || log.user_name || log.user_email || 'Unknown user'}
                            {log.read_at ? ' read ' + new Date(log.read_at).toLocaleString() : ' not read'}
                            {log.deleted_at ? ' · deleted/hidden ' + new Date(log.deleted_at).toLocaleString() : ''}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

type AdminSection = 'overview' | 'accounts' | 'backup' | 'licences' | 'notifications';

function Admin({ data }: { data: DashboardData; refresh: () => Promise<void> }) {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [form, setForm] = useState<AdminAccountPayload>({ name: '', email: '', password: '', role: 'tenant', tenant_id: null, active: true });
  const [resettingPasswordId, setResettingPasswordId] = useState<string | null>(null);
  const [adminSection, setAdminSection] = useState<AdminSection>('overview');

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

  async function resetAccountPassword(account: AdminAccount) {
    const password = window.prompt('Enter a new password for ' + account.email + ', or leave blank to generate one.');
    if (password === null) return;

    const confirmed = window.confirm('Reset password for ' + account.email + '?');
    if (!confirmed) return;

    setResettingPasswordId(account.id);
    try {
      const result = await api.adminResetPassword(account.id, password);
      window.alert('Password reset for ' + result.account.email + '. New password: ' + result.temporary_password);
      await loadAccounts();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setResettingPasswordId(null);
    }
  }

  const adminSections: { id: AdminSection; label: string; helper: string }[] = [
    { id: 'overview', label: 'Overview', helper: 'Safety checks and login activity' },
    { id: 'accounts', label: 'Accounts', helper: 'Admin and tenant login accounts' },
    { id: 'backup', label: 'Backup & trash', helper: 'Exports, restore and permanent delete' },
    { id: 'licences', label: 'Licences', helper: 'Desktop licence keys' },
    { id: 'notifications', label: 'Notifications', helper: 'Messages, alerts and free push plan' },
  ];

  const accountsPanel = (
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
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => startEdit(account)}>Edit</Button>
            <Button variant="secondary" disabled={resettingPasswordId === account.id} onClick={() => void resetAccountPassword(account)}>
              {resettingPasswordId === account.id ? 'Resetting...' : 'Reset password'}
            </Button>
          </div>,
        ])}
      />
    </CrudLayout>
  );

  return (
    <div className="space-y-6">
      <Card title="Admin centre">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {adminSections.map(section => (
            <button
              key={section.id}
              type="button"
              onClick={() => setAdminSection(section.id)}
              className={
                'rounded-lg border p-3 text-left text-sm transition ' +
                (adminSection === section.id
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50')
              }
            >
              <span className="block font-semibold">{section.label}</span>
              <span className="mt-1 block text-xs text-slate-500">{section.helper}</span>
            </button>
          ))}
        </div>
      </Card>

      {adminSection === 'overview' && (
        <div className="space-y-6">
          <AdminSafetyChecks />
          <LoginActivity />
        </div>
      )}

      {adminSection === 'accounts' && accountsPanel}

      {adminSection === 'backup' && (
        <div className="space-y-6">
          <BackupExportTools />
          <TrashBin />
        </div>
      )}

      {adminSection === 'licences' && <LicenceManagement />}

      {adminSection === 'notifications' && <NotificationCentre />}
    </div>
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

function Actions({ onEdit }: { onEdit: () => void; onDelete?: () => void }) {
  return (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={onEdit}>Edit</Button>
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
    if (user.role === 'tenant' && page === 'dashboard') content = <TenantPortal data={data} user={user} refresh={refresh} />;
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




