import { useEffect, useMemo, useState } from 'react';
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
import type { AdminAccount, DocumentPayload } from './api';
import type {
  DashboardData,
  DocumentRecord,
  DocType,
  Page,
  PaymentStatus,
  Property,
  PropertyStatus,
  RentPayment,
  Tenant,
  User,
} from './types';

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function dateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

const pageConfig: {
  page: Page;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}[] = [
  { page: 'dashboard', label: 'Dashboard', icon: Home },
  { page: 'properties', label: 'Properties', icon: Building2, adminOnly: true },
  { page: 'tenants', label: 'Tenants', icon: Users, adminOnly: true },
  { page: 'rent', label: 'Rent', icon: Receipt },
  { page: 'maintenance', label: 'Repairs', icon: Wrench },
  { page: 'documents', label: 'Documents', icon: FileText },
  { page: 'expenses', label: 'Expenses', icon: ClipboardList, adminOnly: true },
  { page: 'admin', label: 'Admin', icon: ShieldCheck, adminOnly: true },
];

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [email, setEmail] = useState('admin@propmanager.local');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
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
    <div className="min-h-screen grid place-items-center bg-slate-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">PropManager UK</h1>
          <p className="text-sm text-slate-500">Landlord and tenant portal</p>
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}

        <label className="block text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </label>

        <label className="block text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-lg border px-3 py-2"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
        </label>

        <button className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm border flex items-center gap-4">
      <Icon className="w-8 h-8 text-emerald-600" />
      <div>
        <p className="text-sm text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function Dashboard({ data }: { data: DashboardData; user: User }) {
  const paid = data.rentPayments
    .filter(p => p.status === 'paid')
    .reduce((s, p) => s + p.amount, 0);
  const outstanding = data.rentPayments
    .filter(p => p.status !== 'paid')
    .reduce((s, p) => s + p.amount, 0);
  const openRepairs = data.maintenanceTickets.filter(t => t.status !== 'resolved').length;
  const expiring = data.documents.filter(d => {
    const days = daysUntil(d.expiry_date);
    return days !== null && days <= 90;
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Rent paid" value={`£${paid}`} icon={Receipt} />
        <Stat label="Outstanding" value={`£${outstanding}`} icon={AlertTriangle} />
        <Stat label="Open repairs" value={String(openRepairs)} icon={Wrench} />
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm border">
        <h2 className="text-lg font-bold text-slate-900 mb-3">Compliance reminders</h2>
        {expiring.length === 0 ? (
          <p className="text-sm text-slate-500">No documents expiring in the next 90 days.</p>
        ) : (
          <div className="space-y-2">
            {expiring.map(d => {
              const days = daysUntil(d.expiry_date);
              return (
                <div key={d.id} className="rounded-lg border p-3 flex justify-between">
                  <span>{d.name}</span>
                  <strong className="text-amber-700">
                    {days !== null && days < 0
                      ? `${Math.abs(days)} days overdue`
                      : `${days} days left`}
                  </strong>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TenantPortal({ data, user }: { data: DashboardData; user: User }) {
  const tenant =
    data.tenants.find(t => t.id === user.tenant_id) ||
    data.tenants[0] ||
    null;
  const property = tenant?.property || data.properties[0] || null;
  const rentPaid = data.rentPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const rentOutstanding = data.rentPayments
    .filter(p => p.status !== 'paid')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const openRepairs = data.maintenanceTickets.filter(t => t.status !== 'resolved').length;
  const nextRent = data.rentPayments
    .filter(p => p.status !== 'paid')
    .slice()
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-white p-5 shadow-sm border">
        <h2 className="text-xl font-bold text-slate-900">Welcome, {user.name}</h2>
        <p className="text-sm text-slate-500">Your tenant portal for rent, documents and repairs.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Rent paid" value={`£${rentPaid}`} icon={Receipt} />
        <Stat label="Outstanding" value={`£${rentOutstanding}`} icon={AlertTriangle} />
        <Stat label="Open repairs" value={String(openRepairs)} icon={Wrench} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white p-5 shadow-sm border">
          <h2 className="font-bold text-slate-900 mb-3">My property</h2>
          {property ? (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-slate-600">Address:</span> {property.address}</p>
              <p><span className="font-medium text-slate-600">City:</span> {property.city || '-'}</p>
              <p><span className="font-medium text-slate-600">Postcode:</span> {property.postcode || '-'}</p>
              <p><span className="font-medium text-slate-600">Type:</span> {property.property_type || '-'}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No property assigned yet.</p>
          )}
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm border">
          <h2 className="font-bold text-slate-900 mb-3">My tenancy</h2>
          {tenant ? (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-slate-600">Tenant:</span> {tenant.name}</p>
              <p><span className="font-medium text-slate-600">Email:</span> {tenant.email || '-'}</p>
              <p><span className="font-medium text-slate-600">Lease start:</span> {dateOnly(tenant.lease_start) || '-'}</p>
              <p><span className="font-medium text-slate-600">Lease end:</span> {dateOnly(tenant.lease_end) || '-'}</p>
              <p><span className="font-medium text-slate-600">Payment status:</span> {tenant.payment_status || '-'}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No tenancy details found.</p>
          )}
        </div>
      </div>

      <div className="rounded-xl bg-white p-5 shadow-sm border">
        <h2 className="font-bold text-slate-900 mb-3">Next rent due</h2>
        {nextRent ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-2xl font-bold text-slate-900">£{nextRent.amount}</p>
              <p className="text-sm text-slate-500">Due {dateOnly(nextRent.due_date)} · {nextRent.status}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No outstanding rent payments.</p>
        )}
      </div>

      <DataTable
        title="My rent history"
        rows={data.rentPayments.map(p => ({
          amount: `£${p.amount}`,
          due: dateOnly(p.due_date),
          paid: dateOnly(p.paid_date) || '-',
          status: p.status,
        }))}
      />

      <DataTable
        title="My documents"
        rows={data.documents.map(d => ({
          name: d.name,
          type: d.doc_type,
          expiry: dateOnly(d.expiry_date) || '-',
          file: d.file_url ? (
            <a
              href={api.documentFileUrl(d.file_url)}
              target="_blank"
              rel="noreferrer"
              className="rounded bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200"
            >
              View
            </a>
          ) : 'Not uploaded',
        }))}
      />

      <DataTable
        title="My repairs"
        rows={data.maintenanceTickets.map(t => ({
          title: t.title,
          property: t.property?.address || t.property_id,
          urgency: t.urgency,
          status: t.status,
          created: dateOnly(t.created_at),
        }))}
      />
    </div>
  );
}

function DataTable({ title, rows }: { title: string; rows: Record<string, any>[] }) {
  const keys = rows[0] ? Object.keys(rows[0]) : [];

  return (
    <div className="rounded-xl bg-white shadow-sm border overflow-hidden">
      <div className="p-4 border-b">
        <h2 className="font-bold text-slate-900">{title}</h2>
      </div>

      {rows.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No records found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                {keys.map(k => (
                  <th key={k} className="px-4 py-3 text-left font-semibold">
                    {k.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t">
                  {keys.map(k => (
                    <td key={k} className="px-4 py-3 align-top">
                      {r[k]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Maintenance({ data, refresh }: { data: DashboardData; refresh: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [propertyId, setPropertyId] = useState(data.properties[0]?.id || '');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await api.createTicket({ title, description, property_id: propertyId, urgency: 'medium' });
    setTitle('');
    setDescription('');
    refresh();
  }

  return (
    <div className="space-y-5">
      <DataTable
        title="Repair tickets"
        rows={data.maintenanceTickets.map(t => ({
          title: t.title,
          property: t.property?.address || t.property_id,
          urgency: t.urgency,
          status: t.status,
        }))}
      />

      <div className="rounded-xl bg-white p-5 shadow-sm border">
        <h2 className="font-bold text-slate-900 mb-4">Report a repair</h2>
        <form onSubmit={submit} className="space-y-3">
          <input
            required
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
          <textarea
            required
            className="w-full rounded-lg border px-3 py-2"
            placeholder="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={propertyId}
            onChange={e => setPropertyId(e.target.value)}
          >
            {data.properties.map(p => (
              <option key={p.id} value={p.id}>
                {p.address}
              </option>
            ))}
          </select>
          <button className="w-full rounded-lg bg-emerald-600 text-white py-2 font-semibold">
            Submit
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [page, setPage] = useState<Page>('dashboard');
  const [error, setError] = useState('');

  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [propertyAddress, setPropertyAddress] = useState('');
  const [propertyCity, setPropertyCity] = useState('');
  const [propertyPostcode, setPropertyPostcode] = useState('');
  const [propertyStatus, setPropertyStatus] = useState<PropertyStatus>('active');
  const [propertyRent, setPropertyRent] = useState('');
  const [propertyBedrooms, setPropertyBedrooms] = useState('');
  const [propertyType, setPropertyType] = useState('');

  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [showTenantForm, setShowTenantForm] = useState(false);
  const [tenantName, setTenantName] = useState('');
  const [tenantEmail, setTenantEmail] = useState('');
  const [tenantPhone, setTenantPhone] = useState('');
  const [tenantPropertyId, setTenantPropertyId] = useState('');
  const [tenantLeaseStart, setTenantLeaseStart] = useState('');
  const [tenantLeaseEnd, setTenantLeaseEnd] = useState('');
  const [tenantPaymentStatus, setTenantPaymentStatus] = useState<PaymentStatus>('pending');

  const [editingPayment, setEditingPayment] = useState<RentPayment | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPaidDate, setEditPaidDate] = useState('');
  const [editStatus, setEditStatus] = useState<PaymentStatus>('pending');

  const [editingDocument, setEditingDocument] = useState<DocumentRecord | null>(null);
  const [showDocumentForm, setShowDocumentForm] = useState(false);
  const [documentName, setDocumentName] = useState('');
  const [documentType, setDocumentType] = useState<DocType>('gas_safety');
  const [documentPropertyId, setDocumentPropertyId] = useState('');
  const [documentTenantId, setDocumentTenantId] = useState('');
  const [documentExpiryDate, setDocumentExpiryDate] = useState('');
  const [documentFileUrl, setDocumentFileUrl] = useState('');
  const [documentUploading, setDocumentUploading] = useState(false);

  const [adminAccounts, setAdminAccounts] = useState<AdminAccount[]>([]);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [accountName, setAccountName] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountRole, setAccountRole] = useState<'admin' | 'tenant'>('tenant');
  const [accountTenantId, setAccountTenantId] = useState('');
  const [accountActive, setAccountActive] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(false);

  const visiblePages = useMemo(
    () => pageConfig.filter(p => user?.role === 'admin' || !p.adminOnly),
    [user]
  );

  async function load() {
    try {
      setData(await api.dashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load data');
    }
  }

  function startAddProperty() {
    setEditingProperty(null);
    setPropertyAddress('');
    setPropertyCity('');
    setPropertyPostcode('');
    setPropertyStatus('active');
    setPropertyRent('');
    setPropertyBedrooms('1');
    setPropertyType('House');
    setShowPropertyForm(true);
  }

  function startEditProperty(property: Property) {
    setEditingProperty(property);
    setPropertyAddress(property.address || '');
    setPropertyCity(property.city || '');
    setPropertyPostcode(property.postcode || '');
    setPropertyStatus(property.status);
    setPropertyRent(String(property.monthly_rent ?? ''));
    setPropertyBedrooms(String(property.bedrooms ?? '1'));
    setPropertyType(property.property_type || 'House');
    setShowPropertyForm(true);
  }

  async function saveProperty(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      address: propertyAddress,
      city: propertyCity,
      postcode: propertyPostcode,
      status: propertyStatus,
      monthly_rent: Number(propertyRent),
      bedrooms: Number(propertyBedrooms),
      property_type: propertyType,
    };

    try {
      if (editingProperty) await api.updateProperty(editingProperty.id, payload);
      else await api.createProperty(payload);
      setShowPropertyForm(false);
      setEditingProperty(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function deleteProperty(id: string) {
    if (!confirm('Delete this property?')) return;
    try {
      await api.deleteProperty(id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function startAddTenant() {
    setEditingTenant(null);
    setTenantName('');
    setTenantEmail('');
    setTenantPhone('');
    setTenantPropertyId(data?.properties[0]?.id || '');
    setTenantLeaseStart('');
    setTenantLeaseEnd('');
    setTenantPaymentStatus('pending');
    setShowTenantForm(true);
  }

  function startEditTenant(tenant: Tenant) {
    setEditingTenant(tenant);
    setTenantName(tenant.name || '');
    setTenantEmail(tenant.email || '');
    setTenantPhone(tenant.phone || '');
    setTenantPropertyId(tenant.property_id || '');
    setTenantLeaseStart(dateOnly(tenant.lease_start));
    setTenantLeaseEnd(dateOnly(tenant.lease_end));
    setTenantPaymentStatus(tenant.payment_status || 'pending');
    setShowTenantForm(true);
  }

  async function saveTenant(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: tenantName,
      email: tenantEmail,
      phone: tenantPhone,
      property_id: tenantPropertyId || null,
      lease_start: tenantLeaseStart || null,
      lease_end: tenantLeaseEnd || null,
      payment_status: tenantPaymentStatus,
    };

    try {
      if (editingTenant) await api.updateTenant(editingTenant.id, payload);
      else await api.createTenant(payload);
      setShowTenantForm(false);
      setEditingTenant(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function deleteTenant(id: string) {
    if (!confirm('Delete this tenant?')) return;
    try {
      await api.deleteTenant(id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function startEditPayment(payment: RentPayment) {
    setEditingPayment(payment);
    setEditAmount(String(payment.amount));
    setEditDueDate(dateOnly(payment.due_date));
    setEditPaidDate(dateOnly(payment.paid_date));
    setEditStatus(payment.status);
  }

  async function saveEditPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPayment) return;

    try {
      await api.updatePayment(editingPayment.id, {
        amount: Number(editAmount),
        due_date: editDueDate,
        paid_date: editPaidDate || null,
        status: editStatus,
      });
      setEditingPayment(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Update failed');
    }
  }

  async function deleteRentPayment(id: string) {
    if (!confirm('Delete this rent payment?')) return;
    try {
      await api.deleteRentPayment(id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  function startAddDocument() {
    setEditingDocument(null);
    setDocumentName('');
    setDocumentType('gas_safety');
    setDocumentPropertyId(data?.properties[0]?.id || '');
    setDocumentTenantId('');
    setDocumentExpiryDate('');
    setDocumentFileUrl('');
    setShowDocumentForm(true);
  }

  function startEditDocument(document: DocumentRecord) {
    setEditingDocument(document);
    setDocumentName(document.name || '');
    setDocumentType(document.doc_type || 'gas_safety');
    setDocumentPropertyId(document.property_id || '');
    setDocumentTenantId(document.tenant_id || '');
    setDocumentExpiryDate(dateOnly(document.expiry_date));
    setDocumentFileUrl(document.file_url || '');
    setShowDocumentForm(true);
  }

  async function uploadDocumentFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setDocumentUploading(true);

    try {
      const uploaded = await api.uploadDocument(file);
      setDocumentFileUrl(uploaded.file_url);

      if (!documentName) {
        setDocumentName(uploaded.original_name);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setDocumentUploading(false);
      e.target.value = '';
    }
  }

  async function saveDocument(e: React.FormEvent) {
    e.preventDefault();
    const payload: DocumentPayload = {
      property_id: documentPropertyId || null,
      tenant_id: documentTenantId || null,
      name: documentName,
      doc_type: documentType,
      expiry_date: documentExpiryDate || null,
      file_url: documentFileUrl,
    };

    try {
      if (editingDocument) await api.updateDocument(editingDocument.id, payload);
      else await api.createDocument(payload);
      setShowDocumentForm(false);
      setEditingDocument(null);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function deleteDocument(id: string) {
    if (!confirm('Delete this document?')) return;
    try {
      await api.deleteDocument(id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function loadAdminAccounts() {
    if (user?.role !== 'admin') return;

    setAccountsLoading(true);
    try {
      setAdminAccounts(await api.listAdminAccounts());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to load accounts');
    } finally {
      setAccountsLoading(false);
    }
  }

  function startAddAccount() {
    setEditingAccount(null);
    setAccountName('');
    setAccountEmail('');
    setAccountPassword('');
    setAccountRole('tenant');
    setAccountTenantId(data?.tenants[0]?.id || '');
    setAccountActive(true);
    setShowAccountForm(true);
  }

  function startEditAccount(account: AdminAccount) {
    setEditingAccount(account);
    setAccountName(account.name || '');
    setAccountEmail(account.email || '');
    setAccountPassword('');
    setAccountRole(account.role || 'tenant');
    setAccountTenantId(account.tenant_id || '');
    setAccountActive(Boolean(account.active));
    setShowAccountForm(true);
  }

  async function saveAccount(e: React.FormEvent) {
    e.preventDefault();

    const payload = {
      name: accountName,
      email: accountEmail,
      role: accountRole,
      tenant_id: accountRole === 'tenant' ? accountTenantId || null : null,
      active: accountActive,
      ...(accountPassword ? { password: accountPassword } : {}),
    };

    try {
      if (editingAccount) await api.updateAdminAccount(editingAccount.id, payload);
      else await api.createAdminAccount({ ...payload, password: accountPassword });
      setShowAccountForm(false);
      setEditingAccount(null);
      await loadAdminAccounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed');
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('pm_token');
    if (token) {
      api
        .me()
        .then(r => {
          setUser(r.user);
          load();
        })
        .catch(() => localStorage.removeItem('pm_token'));
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user]);

  useEffect(() => {
    if (user?.role === 'admin' && page === 'admin') {
      loadAdminAccounts();
    }
  }, [user, page]);

  if (!user) return <Login onLogin={setUser} />;

  if (!data) {
    return <div className="min-h-screen grid place-items-center text-slate-600">Loading PropManager...</div>;
  }

  const content =
    page === 'dashboard' ? (
      user.role === 'tenant' ? (
        <TenantPortal data={data} user={user} />
      ) : (
        <Dashboard data={data} user={user} />
      )
    ) : page === 'properties' ? (
      <div className="space-y-4">
        <button onClick={startAddProperty} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          Add Property
        </button>
        <DataTable
          title="Properties"
          rows={data.properties.map(p => ({
            address: p.address,
            city: p.city,
            postcode: p.postcode,
            type: p.property_type,
            bedrooms: p.bedrooms,
            rent: `£${p.monthly_rent}`,
            status: p.status,
            actions: (
              <div className="flex gap-2">
                <button onClick={() => startEditProperty(p)} className="rounded bg-slate-700 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800">Edit</button>
                <button onClick={() => deleteProperty(p.id)} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700">Delete</button>
              </div>
            ),
          }))}
        />
      </div>
    ) : page === 'tenants' ? (
      <div className="space-y-4">
        <button onClick={startAddTenant} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
          Add Tenant
        </button>
        <DataTable
          title="Tenants"
          rows={data.tenants.map(t => ({
            name: t.name,
            email: t.email,
            phone: t.phone,
            property: t.property?.address || '-',
            lease_start: dateOnly(t.lease_start) || '-',
            lease_end: dateOnly(t.lease_end) || '-',
            status: t.payment_status,
            actions: (
              <div className="flex gap-2">
                <button onClick={() => startEditTenant(t)} className="rounded bg-slate-700 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800">Edit</button>
                <button onClick={() => deleteTenant(t.id)} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700">Delete</button>
              </div>
            ),
          }))}
        />
      </div>
    ) : page === 'rent' ? (
      <DataTable
        title="Rent payments"
        rows={data.rentPayments.map(p => ({
          tenant: p.tenant?.name || p.tenant_id,
          property: p.property?.address || p.property_id,
          amount: `£${p.amount}`,
          due: dateOnly(p.due_date),
          paid: dateOnly(p.paid_date) || '-',
          status: p.status,
          actions: user.role === 'admin' ? (
            <div className="flex gap-2">
              <button onClick={() => startEditPayment(p)} className="rounded bg-slate-700 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800">Edit</button>
              <button onClick={() => deleteRentPayment(p.id)} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700">Delete</button>
            </div>
          ) : null,
        }))}
      />
    ) : page === 'maintenance' ? (
      <Maintenance data={data} refresh={load} />
    ) : page === 'documents' ? (
      <div className="space-y-4">
        {user.role === 'admin' && (
          <button onClick={startAddDocument} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Add Document
          </button>
        )}
        <DataTable
          title="Documents & compliance"
          rows={data.documents.map(d => ({
            name: d.name,
            type: d.doc_type,
            property: d.property?.address || d.property_id,
            tenant: d.tenant?.name || '-',
            expiry: dateOnly(d.expiry_date) || '-',
            file: d.file_url ? (
              <a
                href={api.documentFileUrl(d.file_url)}
                target="_blank"
                rel="noreferrer"
                className="rounded bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200"
              >
                View
              </a>
            ) : 'Not uploaded',
            actions: user.role === 'admin' ? (
              <div className="flex gap-2">
                <button onClick={() => startEditDocument(d)} className="rounded bg-slate-700 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800">Edit</button>
                <button onClick={() => deleteDocument(d.id)} className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700">Delete</button>
              </div>
            ) : null,
          }))}
        />
      </div>
    ) : page === 'expenses' ? (
      <DataTable
        title="Expenses"
        rows={data.expenses.map(e => ({
          date: e.date,
          category: e.category,
          property: e.property?.address || 'General',
          amount: `£${e.amount}`,
          description: e.description,
        }))}
      />
    ) : (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Tenant login accounts</h2>
            <p className="text-sm text-slate-500">Create and edit login accounts linked to tenant records.</p>
          </div>
          <button onClick={startAddAccount} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            Add Login Account
          </button>
        </div>

        {accountsLoading ? (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500 shadow-sm border">Loading accounts...</p>
        ) : (
          <DataTable
            title="Login accounts"
            rows={adminAccounts.map(a => ({
              name: a.name,
              email: a.email,
              role: a.role,
              tenant: a.tenant?.name || '-',
              active: a.active ? 'Yes' : 'No',
              actions: (
                <button onClick={() => startEditAccount(a)} className="rounded bg-slate-700 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800">Edit</button>
              ),
            }))}
          />
        )}
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="w-64 bg-slate-950 text-white hidden md:flex flex-col">
        <div className="p-5 flex items-center gap-3 border-b border-slate-800">
          <Building2 className="text-emerald-400" />
          <strong>PropManagerr</strong>
        </div>
        <nav className="p-3 space-y-1 flex-1">
          {visiblePages.map(({ page: p, label, icon: Icon }) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${page === p ? 'bg-emerald-600' : 'text-slate-300 hover:bg-slate-800'}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-5 py-3 text-xs text-slate-400">
          Version v16
        </div>
      </aside>

      <main className="flex-1">
        <header className="bg-white border-b px-5 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{pageConfig.find(p => p.page === page)?.label}</h1>
            <p className="text-sm text-slate-500">Signed in as {user.name} ({user.role})</p>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem('pm_token');
              setUser(null);
            }}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </header>

        {error && <p className="m-5 rounded-lg bg-red-50 text-red-700 p-3">{error}</p>}
        <div className="p-5">{content}</div>
      </main>

      {showPropertyForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={saveProperty} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900">{editingProperty ? 'Edit property' : 'Add property'}</h2>
            <input required className="w-full rounded-lg border px-3 py-2" placeholder="Address" value={propertyAddress} onChange={e => setPropertyAddress(e.target.value)} />
            <input required className="w-full rounded-lg border px-3 py-2" placeholder="City" value={propertyCity} onChange={e => setPropertyCity(e.target.value)} />
            <input required className="w-full rounded-lg border px-3 py-2" placeholder="Postcode" value={propertyPostcode} onChange={e => setPropertyPostcode(e.target.value)} />
            <input required className="w-full rounded-lg border px-3 py-2" placeholder="Property type" value={propertyType} onChange={e => setPropertyType(e.target.value)} />
            <input required type="number" className="w-full rounded-lg border px-3 py-2" placeholder="Bedrooms" value={propertyBedrooms} onChange={e => setPropertyBedrooms(e.target.value)} />
            <input required type="number" step="0.01" className="w-full rounded-lg border px-3 py-2" placeholder="Monthly rent" value={propertyRent} onChange={e => setPropertyRent(e.target.value)} />
            <select className="w-full rounded-lg border px-3 py-2" value={propertyStatus} onChange={e => setPropertyStatus(e.target.value as PropertyStatus)}>
              <option value="active">Active</option>
              <option value="vacant">Vacant</option>
              <option value="maintenance">Maintenance</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowPropertyForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Save</button>
            </div>
          </form>
        </div>
      )}

      {showTenantForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={saveTenant} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900">{editingTenant ? 'Edit tenant' : 'Add tenant'}</h2>
            <input required className="w-full rounded-lg border px-3 py-2" placeholder="Name" value={tenantName} onChange={e => setTenantName(e.target.value)} />
            <input required type="email" className="w-full rounded-lg border px-3 py-2" placeholder="Email" value={tenantEmail} onChange={e => setTenantEmail(e.target.value)} />
            <input className="w-full rounded-lg border px-3 py-2" placeholder="Phone" value={tenantPhone} onChange={e => setTenantPhone(e.target.value)} />
            <select className="w-full rounded-lg border px-3 py-2" value={tenantPropertyId} onChange={e => setTenantPropertyId(e.target.value)}>
              <option value="">No property assigned</option>
              {data.properties.map(p => (
                <option key={p.id} value={p.id}>{p.address}</option>
              ))}
            </select>
            <label className="block text-sm font-medium text-slate-700">
              Lease start
              <input type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={tenantLeaseStart} onChange={e => setTenantLeaseStart(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Lease end
              <input type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={tenantLeaseEnd} onChange={e => setTenantLeaseEnd(e.target.value)} />
            </label>
            <select className="w-full rounded-lg border px-3 py-2" value={tenantPaymentStatus} onChange={e => setTenantPaymentStatus(e.target.value as PaymentStatus)}>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowTenantForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Save</button>
            </div>
          </form>
        </div>
      )}

      {editingPayment && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={saveEditPayment} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Edit rent payment</h2>
            <label className="block text-sm font-medium text-slate-700">
              Amount
              <input required type="number" step="0.01" className="mt-1 w-full rounded-lg border px-3 py-2" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Due date
              <input required type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Paid date
              <input type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={editPaidDate} onChange={e => setEditPaidDate(e.target.value)} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Status
              <select className="mt-1 w-full rounded-lg border px-3 py-2" value={editStatus} onChange={e => setEditStatus(e.target.value as PaymentStatus)}>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingPayment(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Save</button>
            </div>
          </form>
        </div>
      )}

      {showDocumentForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={saveDocument} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900">{editingDocument ? 'Edit document' : 'Add document'}</h2>
            <input required className="w-full rounded-lg border px-3 py-2" placeholder="Document name" value={documentName} onChange={e => setDocumentName(e.target.value)} />
            <select className="w-full rounded-lg border px-3 py-2" value={documentType} onChange={e => setDocumentType(e.target.value as DocType)}>
              <option value="tenancy_agreement">Tenancy agreement</option>
              <option value="gas_safety">Gas safety</option>
              <option value="epc">EPC</option>
              <option value="eicr">EICR</option>
              <option value="deposit_protection">Deposit protection</option>
              <option value="right_to_rent">Right to rent</option>
              <option value="smoke_co_alarm">Smoke/CO alarm</option>
              <option value="other">Other</option>
            </select>
            <select className="w-full rounded-lg border px-3 py-2" value={documentPropertyId} onChange={e => setDocumentPropertyId(e.target.value)}>
              <option value="">No property</option>
              {data.properties.map(p => (
                <option key={p.id} value={p.id}>{p.address}</option>
              ))}
            </select>
            <select className="w-full rounded-lg border px-3 py-2" value={documentTenantId} onChange={e => setDocumentTenantId(e.target.value)}>
              <option value="">No tenant</option>
              {data.tenants.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <label className="block text-sm font-medium text-slate-700">
              Expiry date
              <input type="date" className="mt-1 w-full rounded-lg border px-3 py-2" value={documentExpiryDate} onChange={e => setDocumentExpiryDate(e.target.value)} />
            </label>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">File</label>
              <div className="flex items-center gap-2">
                <label className={`cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold text-white ${documentUploading ? 'bg-slate-400' : 'bg-slate-700 hover:bg-slate-800'}`}>
                  {documentUploading ? 'Uploading...' : 'Upload file'}
                  <input
                    type="file"
                    className="hidden"
                    onChange={uploadDocumentFile}
                    disabled={documentUploading}
                  />
                </label>
                <input
                  className="flex-1 rounded-lg border px-3 py-2 text-sm"
                  placeholder="File URL"
                  value={documentFileUrl}
                  onChange={e => setDocumentFileUrl(e.target.value)}
                />
              </div>
              {documentFileUrl && (
                <p className="text-xs text-slate-500">Uploaded: {documentFileUrl}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowDocumentForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Save</button>
            </div>
          </form>
        </div>
      )}


      {showAccountForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={saveAccount} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900">{editingAccount ? 'Edit login account' : 'Add login account'}</h2>
            <input required className="w-full rounded-lg border px-3 py-2" placeholder="Name" value={accountName} onChange={e => setAccountName(e.target.value)} />
            <input required type="email" className="w-full rounded-lg border px-3 py-2" placeholder="Email / login" value={accountEmail} onChange={e => setAccountEmail(e.target.value)} />
            <input
              required={!editingAccount}
              type="password"
              className="w-full rounded-lg border px-3 py-2"
              placeholder={editingAccount ? 'New password (leave blank to keep current)' : 'Password'}
              value={accountPassword}
              onChange={e => setAccountPassword(e.target.value)}
            />
            <select className="w-full rounded-lg border px-3 py-2" value={accountRole} onChange={e => setAccountRole(e.target.value as 'admin' | 'tenant')}>
              <option value="tenant">Tenant</option>
              <option value="admin">Admin</option>
            </select>
            {accountRole === 'tenant' && (
              <select required className="w-full rounded-lg border px-3 py-2" value={accountTenantId} onChange={e => setAccountTenantId(e.target.value)}>
                <option value="">Select tenant</option>
                {data.tenants.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={accountActive} onChange={e => setAccountActive(e.target.checked)} />
              Active account
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowAccountForm(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Save</button>
            </div>
          </form>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950 text-white flex overflow-x-auto">
        {visiblePages.map(({ page: p, icon: Icon }) => (
          <button key={p} onClick={() => setPage(p)} className={`p-3 ${page === p ? 'text-emerald-400' : 'text-slate-400'}`}>
            <Icon />
          </button>
        ))}
      </nav>
    </div>
  );
}
