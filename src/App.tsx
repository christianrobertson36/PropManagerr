import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, ClipboardList, FileText, Home, LogOut, Receipt, ShieldCheck, Users, Wrench } from 'lucide-react';
import { api } from './api';
import type { DashboardData, Page, PaymentStatus, RentPayment, User } from './types';

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

function dateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

const pageConfig: { page: Page; label: string; icon: React.ComponentType<{ className?: string }>; adminOnly?: boolean }[] = [
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
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-emerald-600 flex items-center justify-center"><Building2 className="text-white" /></div>
          <div><h1 className="text-2xl font-bold text-slate-900">PropManager UK</h1><p className="text-sm text-slate-500">Landlord and tenant portal</p></div>
        </div>
        {error && <p className="rounded-lg bg-red-50 text-red-700 px-3 py-2 text-sm">{error}</p>}
        <label className="block text-sm font-medium text-slate-700">Email<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="block text-sm font-medium text-slate-700">Password<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button disabled={loading} className="w-full rounded-lg bg-emerald-600 text-white py-2.5 font-semibold hover:bg-emerald-700 disabled:opacity-60">{loading ? 'Signing in...' : 'Sign in'}</button>
      </form>
    </main>
  );
}

function Stat({ label, value, icon: Icon }: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return <div className="rounded-xl bg-white border border-slate-200 p-5 shadow-sm"><div className="flex justify-between"><div><p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</p><p className="text-2xl font-bold text-slate-900 mt-1">{value}</p></div><Icon className="text-emerald-600" /></div></div>;
}

function Dashboard({ data, user }: { data: DashboardData; user: User }) {
  const paid = data.rentPayments.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const outstanding = data.rentPayments.filter(p => p.status !== 'paid').reduce((s, p) => s + p.amount, 0);
  const openRepairs = data.maintenanceTickets.filter(t => t.status !== 'resolved').length;
  const expiring = data.documents.filter(d => { const days = daysUntil(d.expiry_date); return days !== null && days <= 90; });

  return <div className="space-y-6">
    <div className="grid gap-4 md:grid-cols-4">
      <Stat label="Rent received" value={`£${paid.toLocaleString()}`} icon={Receipt} />
      <Stat label="Outstanding" value={`£${outstanding.toLocaleString()}`} icon={AlertTriangle} />
      <Stat label="Open repairs" value={String(openRepairs)} icon={Wrench} />
      <Stat label={user.role === 'admin' ? 'Properties' : 'My home'} value={String(data.properties.length)} icon={Building2} />
    </div>
    <section className="rounded-xl bg-white border border-slate-200 p-5">
      <h2 className="font-semibold text-slate-900 mb-3">Compliance reminders</h2>
      <div className="space-y-2">
        {expiring.length === 0 ? <p className="text-sm text-slate-500">No documents expiring in the next 90 days.</p> : expiring.map(d => {
          const days = daysUntil(d.expiry_date);
          return <div key={d.id} className="flex justify-between rounded-lg bg-slate-50 p-3 text-sm"><span>{d.name}</span><strong className={days !== null && days < 0 ? 'text-red-600' : 'text-amber-600'}>{days !== null && days < 0 ? `${Math.abs(days)} days overdue` : `${days} days left`}</strong></div>;
        })}
      </div>
    </section>
  </div>;
}

function DataTable({ title, rows }: { title: string; rows: Record<string, React.ReactNode>[] }) {
  const keys = rows[0] ? Object.keys(rows[0]) : [];

  return <section className="rounded-xl bg-white border border-slate-200 overflow-hidden">
    <div className="p-5 border-b"><h2 className="font-semibold text-slate-900">{title}</h2></div>
    {rows.length === 0 ? <p className="p-5 text-sm text-slate-500">No records found.</p> : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>{keys.map(k => <th key={k} className="text-left p-3 font-semibold capitalize">{k.replace(/_/g, ' ')}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => <tr key={i} className="border-t">{keys.map(k => <td key={k} className="p-3 text-slate-700">{r[k]}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    )}
  </section>;
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

  return <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
    <DataTable title="Repair tickets" rows={data.maintenanceTickets.map(t => ({ title: t.title, property: t.property?.address || t.property_id, urgency: t.urgency, status: t.status }))} />
    <form onSubmit={submit} className="rounded-xl bg-white border border-slate-200 p-5 space-y-3 h-fit">
      <h2 className="font-semibold">Report a repair</h2>
      <input required className="w-full rounded-lg border px-3 py-2" placeholder="Issue title" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea required className="w-full rounded-lg border px-3 py-2" placeholder="Describe the problem" value={description} onChange={e => setDescription(e.target.value)} />
      <select className="w-full rounded-lg border px-3 py-2" value={propertyId} onChange={e => setPropertyId(e.target.value)}>
        {data.properties.map(p => <option key={p.id} value={p.id}>{p.address}</option>)}
      </select>
      <button className="w-full rounded-lg bg-emerald-600 text-white py-2 font-semibold">Submit</button>
    </form>
  </div>;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [page, setPage] = useState<Page>('dashboard');
  const [error, setError] = useState('');

  const [editingPayment, setEditingPayment] = useState<RentPayment | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [editPaidDate, setEditPaidDate] = useState('');
  const [editStatus, setEditStatus] = useState<PaymentStatus>('pending');

  const visiblePages = useMemo(() => pageConfig.filter(p => user?.role === 'admin' || !p.adminOnly), [user]);

  async function load() {
    try {
      setData(await api.dashboard());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load data');
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

  useEffect(() => {
    const token = localStorage.getItem('pm_token');
    if (token) api.me().then(r => {
      setUser(r.user);
      load();
    }).catch(() => localStorage.removeItem('pm_token'));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user]);

  if (!user) return <Login onLogin={setUser} />;
  if (!data) return <div className="min-h-screen grid place-items-center text-slate-600">Loading PropManager...</div>;

  const content = page === 'dashboard' ? <Dashboard data={data} user={user} />
    : page === 'properties' ? <DataTable title="Properties" rows={data.properties.map(p => ({ address: p.address, city: p.city, postcode: p.postcode, rent: `£${p.monthly_rent}`, status: p.status }))} />
    : page === 'tenants' ? <DataTable title="Tenants" rows={data.tenants.map(t => ({ name: t.name, email: t.email, phone: t.phone, property: t.property?.address || '-', status: t.payment_status }))} />
    : page === 'rent' ? <DataTable title="Rent payments" rows={data.rentPayments.map(p => ({
        tenant: p.tenant?.name || p.tenant_id,
        property: p.property?.address || p.property_id,
        amount: `£${p.amount}`,
        due: dateOnly(p.due_date),
        paid: dateOnly(p.paid_date) || '-',
        status: p.status,
        actions: user.role === 'admin' ? (
          <div className="flex gap-2">
            <button
              onClick={() => startEditPayment(p)}
              className="rounded bg-slate-700 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
            >
              Edit
            </button>
            <button
              onClick={() => deleteRentPayment(p.id)}
              className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        ) : null
      }))} />
    : page === 'maintenance' ? <Maintenance data={data} refresh={load} />
    : page === 'documents' ? <DataTable title="Documents & compliance" rows={data.documents.map(d => ({ name: d.name, type: d.doc_type, property: d.property?.address || d.property_id, expiry: d.expiry_date || '-', file: d.file_url ? 'Uploaded' : 'Not uploaded' }))} />
    : page === 'expenses' ? <DataTable title="Expenses" rows={data.expenses.map(e => ({ date: e.date, category: e.category, property: e.property?.address || 'General', amount: `£${e.amount}`, description: e.description }))} />
    : <DataTable title="Admin tools" rows={[{ feature: 'Role based access', status: 'Enabled' }, { feature: 'Manual rent tracking', status: 'Enabled' }, { feature: 'Audit log schema', status: 'Included' }, { feature: 'TrueNAS Docker Compose', status: 'Included' }]} />;

  return <div className="min-h-screen bg-slate-100 flex">
    <aside className="w-64 bg-slate-950 text-white hidden md:flex flex-col">
      <div className="p-5 flex items-center gap-3 border-b border-slate-800"><Building2 className="text-emerald-400" /><strong>PropManager UK V6</strong></div>
      <nav className="p-3 space-y-1 flex-1">
        {visiblePages.map(({ page: p, label, icon: Icon }) => <button key={p} onClick={() => setPage(p)} className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${page === p ? 'bg-emerald-600' : 'text-slate-300 hover:bg-slate-800'}`}><Icon className="w-4 h-4" />{label}</button>)}
      </nav>
    </aside>

    <main className="flex-1">
      <header className="bg-white border-b px-5 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{pageConfig.find(p => p.page === page)?.label}</h1>
          <p className="text-sm text-slate-500">Signed in as {user.name} ({user.role})</p>
        </div>
        <button onClick={() => { localStorage.removeItem('pm_token'); setUser(null); }} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><LogOut className="w-4 h-4" />Logout</button>
      </header>

      {error && <p className="m-5 rounded-lg bg-red-50 text-red-700 p-3">{error}</p>}
      <div className="p-5">{content}</div>
    </main>

    {editingPayment && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
        <form onSubmit={saveEditPayment} className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Edit rent payment</h2>

          <label className="block text-sm font-medium text-slate-700">
            Amount
            <input
              required
              type="number"
              step="0.01"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={editAmount}
              onChange={e => setEditAmount(e.target.value)}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Due date
            <input
              required
              type="date"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={editDueDate}
              onChange={e => setEditDueDate(e.target.value)}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Paid date
            <input
              type="date"
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={editPaidDate}
              onChange={e => setEditPaidDate(e.target.value)}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Status
            <select
              className="mt-1 w-full rounded-lg border px-3 py-2"
              value={editStatus}
              onChange={e => setEditStatus(e.target.value as PaymentStatus)}
            >
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </select>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setEditingPayment(null)}
              className="rounded-lg border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    )}

    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950 text-white flex overflow-x-auto">
      {visiblePages.map(({ page: p, icon: Icon }) => <button key={p} onClick={() => setPage(p)} className={`p-3 ${page === p ? 'text-emerald-400' : 'text-slate-400'}`}><Icon /></button>)}
    </nav>
  </div>;
}
